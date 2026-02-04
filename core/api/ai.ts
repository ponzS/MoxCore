import type { Request, Response, Router } from 'express'
import path from 'node:path'
import { loadAiSettings, saveAiSettings, loadAiMessages, saveAiMessages, clearAiMessages, type ChatMessage, type ToolStep } from '../models/ai.js'
import { joinUrl } from '../tools/url.js'
import { openAiCompatibleListModels } from '../tools/openai.js'
import { listSkills } from '../tools/skills.js'
import { createAgentTools } from '../tools/agent-tools.js'
import { runAgentWithTools, type AgentToolEvent } from '../tools/agent-runner.js'

export function registerAiRoutes(router: Router) {
  router.get('/ai/settings', (_req: Request, res: Response) => {
    res.json(loadAiSettings())
  })

  router.put('/ai/settings', (req: Request, res: Response) => {
    const next = saveAiSettings(req.body || {})
    res.json(next)
  })

  router.get('/ai/messages', (_req: Request, res: Response) => {
    res.json(loadAiMessages())
  })

  router.put('/ai/messages', (req: Request, res: Response) => {
    const list = Array.isArray(req.body) ? (req.body as ChatMessage[]) : []
    res.json(saveAiMessages(list))
  })

  router.delete('/ai/messages', (_req: Request, res: Response) => {
    clearAiMessages()
    res.json({ ok: true })
  })

  router.get('/ai/models', async (_req: Request, res: Response) => {
    const settings = loadAiSettings()
    const mode = settings.mode
    const baseUrl = mode === 'api' ? String(settings.api.baseUrl || '').trim() : resolveWarehouseBaseUrl(settings.warehouse.urlTemplate, settings.boxName)
    const apiKey = mode === 'api' ? settings.api.apiKey : settings.warehouse.apiKey

    try {
      const models = await openAiCompatibleListModels({
        baseUrl,
        apiKey: String(apiKey || '').trim() || undefined,
      })
      res.json(models)
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message || e || '获取失败') })
    }
  })

  router.get('/ai/skills', async (_req: Request, res: Response) => {
    const skillsRoot = path.resolve(process.cwd(), 'skills')
    const skills = await listSkills(skillsRoot)
    res.json(skills)
  })

  router.post('/ai/chat', async (req: Request, res: Response) => {
    const settings = loadAiSettings()
    const mode = settings.mode
    const model = mode === 'api' ? settings.api.model : settings.warehouse.model
    const baseUrl = mode === 'api' ? String(settings.api.baseUrl || '').trim() : resolveWarehouseBaseUrl(settings.warehouse.urlTemplate, settings.boxName)
    const urlPath = mode === 'api' ? settings.api.urlPath : settings.warehouse.urlPath
    const apiKey = mode === 'api' ? settings.api.apiKey : settings.warehouse.apiKey
    const url = joinUrl(baseUrl, urlPath)
    const content = String(req.body?.text ?? req.body?.content ?? '').trim()
    const wantsStream = req.query.stream === '1' || String(req.headers.accept || '').includes('text/event-stream')

    if (!model) {
      res.status(400).json({ error: '未配置模型' })
      return
    }
    if (!baseUrl) {
      res.status(400).json({ error: mode === 'api' ? '未配置 API 基础地址' : '未配置 BoxName' })
      return
    }
    if (!content) {
      res.status(400).json({ error: '请输入消息内容' })
      return
    }

    const cleanupTasks: Array<() => Promise<void> | void> = []
    const cleanupAll = async () => {
      for (const task of cleanupTasks) {
        await Promise.resolve(task())
      }
    }
    const toolContext = {
      workspaceRoot: path.resolve(process.cwd(), '..'),
      registerCleanup: (fn: () => Promise<void> | void) => {
        cleanupTasks.push(fn)
      },
    }
    const tools = createAgentTools()

    const toolSystemPrompt = {
      role: 'system',
      content:
        '你需要先分析对方当前这个消息的意图，如果难以理解可以结合之前的聊天记录一起分析，如果你认为是复杂的任务，需要先分析需求，然后做一个执行流程表。如果执行目标有需要调用工具的需求，你可以使用提供的工具完成任务。需要调用工具时，先说明你要做的步骤，再发起工具调用。如果当前工具列表中没有你需要的工具，你可以通过命令行调用skills文件夹中的skill-creator工具创建新的工具给自己使用，也可以为自己编写临时脚本，内容输出格式使用markdown格式，确保输出内容工整且具备高可读性。如果在进行的复杂任务或带有工具调用步骤的任务完成了，需要友好的提醒对方任务已完成。另外你需要在每个工具调用步骤完成时再次评估当前是否已经成功的完成了任务，如果未完成则继续完成任务，如果完成了提醒对方已经完成了任务。',
    }

    if (wantsStream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders?.()

      const history = loadAiMessages().filter(m => m.role === 'system' || m.role === 'user' || m.role === 'assistant')
      const userMsg: ChatMessage = { id: nowId(), role: 'user', content, createdAt: Date.now() }
      const assistantId = nowId()
      const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '', createdAt: Date.now(), toolSteps: [] }
      const pendingMessages = saveAiMessages([...history, userMsg, assistantMsg])
      let currentMessages = pendingMessages

      const controller = new AbortController()
      const onClose = () => controller.abort()
      res.on('close', onClose)

      try {
        const result = await runAgentWithTools({
          url,
          apiKey: String(apiKey || '').trim() || undefined,
          model,
          messages: [toolSystemPrompt, ...history, userMsg].map(m => ({ role: m.role, content: m.content })),
          tools,
          toolContext,
          signal: controller.signal,
          streamFinal: true,
          onDelta: delta => {
            res.write(`data: ${JSON.stringify({ type: 'delta', delta })}\n\n`)
          },
          onEvent: event => {
            currentMessages = applyToolEventToMessages(currentMessages, assistantId, event)
            saveAiMessages(currentMessages)
            res.write(`data: ${JSON.stringify(event)}\n\n`)
          },
        })
        const finalMessages = currentMessages.map(m =>
          m.id === assistantId ? { ...m, content: result.content, think: result.think } : m
        )
        saveAiMessages(finalMessages)
        res.write(`data: ${JSON.stringify({ type: 'done', messages: finalMessages })}\n\n`)
        res.write('data: [DONE]\n\n')
        await cleanupAll()
        res.end()
      } catch (e: any) {
        const msg = String(e?.message || e || '请求失败')
        const current = currentMessages.length ? currentMessages : loadAiMessages()
        const idx = [...current].reverse().findIndex(m => m.role === 'assistant' && !m.content)
        const targetIndex = idx >= 0 ? current.length - 1 - idx : -1
        const next =
          targetIndex >= 0
            ? current.map((m, i) => (i === targetIndex ? { ...m, content: msg, error: true } : m))
            : current
        saveAiMessages(next)
        res.write(`data: ${JSON.stringify({ type: 'error', error: msg, messages: next })}\n\n`)
        res.write('data: [DONE]\n\n')
        await cleanupAll()
        res.end()
      } finally {
        res.off('close', onClose)
      }
      return
    }

    try {
      const history = loadAiMessages().filter(m => m.role === 'system' || m.role === 'user' || m.role === 'assistant')
      const userMsg: ChatMessage = { id: nowId(), role: 'user', content, createdAt: Date.now() }
      const assistantId = nowId()
      const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '', createdAt: Date.now(), toolSteps: [] }
      const pendingMessages = saveAiMessages([...history, userMsg, assistantMsg])

      const result = await runAgentWithTools({
        url,
        apiKey: String(apiKey || '').trim() || undefined,
        model,
        messages: [toolSystemPrompt, ...history, userMsg].map(m => ({ role: m.role, content: m.content })),
        tools,
        toolContext,
        streamFinal: false,
      })
      const finalMessages = pendingMessages.map(m => (m.id === assistantId ? { ...m, content: result.content, think: result.think } : m))
      saveAiMessages(finalMessages)
      await cleanupAll()
      res.json({ messages: finalMessages })
    } catch (e: any) {
      const msg = String(e?.message || e || '请求失败')
      const current = loadAiMessages()
      const idx = [...current].reverse().findIndex(m => m.role === 'assistant' && !m.content)
      const targetIndex = idx >= 0 ? current.length - 1 - idx : -1
      const next =
        targetIndex >= 0
          ? current.map((m, i) => (i === targetIndex ? { ...m, content: msg, error: true } : m))
          : current
      saveAiMessages(next)
      await cleanupAll()
      res.status(500).json({ error: msg, messages: next })
    }
  })
}

function resolveWarehouseBaseUrl(template: string, boxName: string) {
  const t = String(template || '').trim() || 'https://ollama-ai.BOXNAME.heiyu.space'
  const box = String(boxName || '').trim()
  if (!box) return ''
  return t.replace(/BOXNAME/g, box)
}

function applyToolEventToMessages(messages: ChatMessage[], assistantId: string, event: AgentToolEvent) {
  const idx = messages.findIndex(m => m.id === assistantId)
  if (idx < 0) return messages
  const next = [...messages]
  const current = next[idx]
  if (!current) return messages
  const steps = applyToolEventToSteps(Array.isArray(current.toolSteps) ? [...current.toolSteps] : [], event)
  next[idx] = { ...current, toolSteps: steps }
  return next
}

function applyToolEventToSteps(steps: ToolStep[], event: AgentToolEvent) {
  if (event.type === 'step') {
    steps.push({
      id: nowId(),
      kind: 'step',
      name: event.message,
      status: 'info',
      createdAt: Date.now(),
    })
    return steps
  }
  if (event.type === 'tool_start') {
    steps.push({
      id: event.id,
      kind: 'tool',
      name: event.name,
      status: 'running',
      args: JSON.stringify(event.args ?? {}, null, 2),
      createdAt: Date.now(),
    })
    return steps
  }
  const idx = steps.findIndex(step => step.id === event.id)
  if (idx >= 0) {
    const current = steps[idx]
    steps[idx] = {
      ...current,
      status: event.type === 'tool_end' ? 'done' : 'error',
      output: event.output,
    }
    return steps
  }
  steps.push({
    id: event.id,
    kind: 'tool',
    name: event.name,
    status: event.type === 'tool_end' ? 'done' : 'error',
    output: event.output,
    createdAt: Date.now(),
  })
  return steps
}

function nowId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
