import { computed, ref } from 'vue'
import type { ChatMessage, ToolEvent, ToolStep } from '@/ai/types'
import { useAiSettings } from '@/ai/settings'
import { clearAiMessages, fetchAiMessages, sendAiMessageStream } from '@/ai/backend'

function nowId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function trimUrlPath(path: string) {
  const p = String(path || '').trim()
  if (!p) return ''
  return p.startsWith('/') ? p : `/${p}`
}

function joinUrl(base: string, path: string) {
  const b = String(base || '').trim().replace(/\/+$/, '')
  const p = trimUrlPath(path)
  if (!b) return p
  if (!p) return b
  return `${b}${p}`
}

function resolveWarehouseBaseUrl(template: string, boxName: string) {
  const t = String(template || '').trim() || 'https://ollama-ai.BOXNAME.heiyu.space'
  const box = String(boxName || '').trim()
  if (!box) return ''
  return t.replace(/BOXNAME/g, box)
}

function splitThinkContent(text: string): { content: string; think: string } {
  let content = String(text ?? '')
  let think = ''

  for (;;) {
    const lower = content.toLowerCase()
    const openIdx = lower.indexOf('<think')
    if (openIdx < 0) break

    const openEnd = lower.indexOf('>', openIdx)
    if (openEnd < 0) break

    const openTagLower = lower.slice(openIdx, openEnd + 1)
    if (openTagLower.replace(/\s+/g, '').endsWith('/>')) {
      content = content.slice(0, openIdx) + content.slice(openEnd + 1)
      continue
    }

    const closeIdx = lower.indexOf('</think', openEnd + 1)
    if (closeIdx < 0) {
      const extracted = content.slice(openEnd + 1)
      think += extracted
      content = content.slice(0, openIdx)
      break
    }

    const closeEnd = lower.indexOf('>', closeIdx)
    if (closeEnd < 0) {
      const extracted = content.slice(openEnd + 1, closeIdx)
      think += extracted
      content = content.slice(0, openIdx)
      break
    }

    think += content.slice(openEnd + 1, closeIdx)
    content = content.slice(0, openIdx) + content.slice(closeEnd + 1)
  }

  return { content, think }
}

function applyToolEventToSteps(steps: ToolStep[], event: ToolEvent) {
  if (event.type === 'step') {
    steps.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
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
    if (!current) return steps
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

export function useAiChat() {
  const settings = useAiSettings()

  const messages = ref<ChatMessage[]>([])
  const input = ref('')
  const isRequesting = ref(false)
  const error = ref('')
  const abortController = ref<AbortController | null>(null)
  const thinkExpandedMap = ref<Record<string, boolean>>({})

  void (async () => {
    try {
      const loaded = await fetchAiMessages()
      messages.value = Array.isArray(loaded) ? loaded : []
    } catch (e: any) {
      error.value = String(e?.message || e || '加载失败')
    }
  })()

  const activeModel = computed(() => {
    return settings.mode === 'api' ? settings.api.model : settings.warehouse.model
  })

  const activeBaseUrl = computed(() => {
    if (settings.mode === 'api') return String(settings.api.baseUrl || '').trim()
    return resolveWarehouseBaseUrl(settings.warehouse.urlTemplate, settings.boxName)
  })

  const activeUrlPath = computed(() => {
    return settings.mode === 'api' ? settings.api.urlPath : settings.warehouse.urlPath
  })

  const activeEndpoint = computed(() => joinUrl(activeBaseUrl.value, activeUrlPath.value))

  function stop() {
    abortController.value?.abort()
  }

  async function clear() {
    stop()
    messages.value = []
    error.value = ''
    isRequesting.value = false
    thinkExpandedMap.value = {}
    try {
      await clearAiMessages()
    } catch (e: any) {
      error.value = String(e?.message || e || '清空失败')
    }
  }

  function toggleThink(messageId: string) {
    if (!messageId) return
    thinkExpandedMap.value = { ...thinkExpandedMap.value, [messageId]: !thinkExpandedMap.value[messageId] }
  }

  function isThinkExpanded(messageId: string) {
    return !!thinkExpandedMap.value[messageId]
  }

  async function send(text?: string) {
    const content = String(text ?? input.value).trim()
    if (!content) return
    if (isRequesting.value) return

    const model = String(activeModel.value || '').trim()
    if (!model) {
      error.value = '未配置模型，请在设置中填写模型名称'
      return
    }
    if (!String(activeEndpoint.value || '').trim()) {
      error.value = settings.mode === 'api' ? '未配置 API 基础地址' : '未配置 BoxName'
      return
    }

    error.value = ''
    isRequesting.value = true

    const userMsg: ChatMessage = { id: nowId(), role: 'user', content, createdAt: Date.now() }
    messages.value = [...messages.value, userMsg]
    input.value = ''

    const assistantId = nowId()
    const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '', createdAt: Date.now(), toolSteps: [] }
    messages.value = [...messages.value, assistantMsg]
    let rawAssistant = ''

    const ac = new AbortController()
    abortController.value = ac

    try {
      const result = await sendAiMessageStream(content, ac.signal, {
        onDelta: delta => {
          rawAssistant += delta
          const { content: nextContent, think: nextThink } = splitThinkContent(rawAssistant)
          const idx = messages.value.findIndex(m => m.id === assistantId)
          if (idx < 0) return
          const next = [...messages.value]
          const current = next[idx]
          if (!current) return
          next[idx] = {
            ...current,
            content: nextContent,
            think: nextThink || undefined,
          }
          messages.value = next
        },
        onToolEvent: event => {
          const idx = messages.value.findIndex(m => m.id === assistantId)
          if (idx < 0) return
          const next = [...messages.value]
          const current = next[idx]
          if (!current) return
          const steps = applyToolEventToSteps(Array.isArray(current.toolSteps) ? [...current.toolSteps] : [], event)
          next[idx] = { ...current, toolSteps: steps }
          messages.value = next
        },
        onMessages: list => {
          if (Array.isArray(list)) messages.value = list
        },
      })
      if (Array.isArray(result.messages) && result.messages.length) {
        messages.value = result.messages
      }
    } catch (e: any) {
      if (ac.signal.aborted) {
        return
      }
      const msg = String(e?.message || e || '请求失败')
      error.value = msg
      const payload = e?.payload
      if (payload?.messages && Array.isArray(payload.messages)) {
        messages.value = payload.messages
      } else {
        const idx = messages.value.findIndex(m => m.id === assistantId)
        if (idx >= 0) {
          const next = [...messages.value]
          const current = next[idx]
          if (current) next[idx] = { ...current, content: msg, error: true }
          messages.value = next
        }
      }
    } finally {
      isRequesting.value = false
      abortController.value = null
    }
  }

  return {
    settings,
    messages,
    input,
    isRequesting,
    error,
    thinkExpandedMap,
    toggleThink,
    isThinkExpanded,
    activeModel,
    activeBaseUrl,
    activeEndpoint,
    send,
    stop,
    clear,
  }
}
