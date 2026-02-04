import type { AgentToolContext, AgentToolDefinition } from './agent-tools.js'
import { openAiCompatibleChat, openAiCompatibleChatWithTools, type OpenAiMessage } from './openai.js'

export type AgentToolEvent =
  | { type: 'step'; message: string }
  | { type: 'tool_start'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_end'; id: string; name: string; output: string }
  | { type: 'tool_error'; id: string; name: string; output: string }

function truncate(text: string, limit = 12000) {
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}\n...[已截断]`
}

export async function runAgentWithTools(params: {
  url: string
  apiKey?: string
  model: string
  messages: OpenAiMessage[]
  tools: AgentToolDefinition[]
  toolContext: AgentToolContext
  onDelta?: (delta: string) => void
  onEvent?: (event: AgentToolEvent) => void
  signal?: AbortSignal
  streamFinal?: boolean
  maxRounds?: number
}): Promise<{ content: string; think?: string }> {
  const maxRounds = Number.isFinite(params.maxRounds) ? Number(params.maxRounds) : Number.POSITIVE_INFINITY
  const toolMap = new Map(params.tools.map(tool => [tool.name, tool]))
  const toolSchemas = params.tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }))

  const messages: OpenAiMessage[] = params.messages.map(m => ({
    role: m.role,
    content: m.content,
    tool_call_id: m.tool_call_id,
  }))

  for (let round = 0; round < maxRounds; round += 1) {
    const response = await openAiCompatibleChatWithTools({
      url: params.url,
      apiKey: params.apiKey,
      model: params.model,
      messages,
      tools: toolSchemas,
      signal: params.signal,
    })

    if (!response.toolCalls.length) {
      if (params.streamFinal) {
        return openAiCompatibleChat({
          url: params.url,
          apiKey: params.apiKey,
          model: params.model,
          messages,
          signal: params.signal,
          onDelta: params.onDelta,
        })
      }
      return { content: response.content, think: response.think }
    }

    params.onEvent?.({ type: 'step', message: `准备执行 ${response.toolCalls.length} 个工具` })

    for (const toolCall of response.toolCalls) {
      const tool = toolMap.get(toolCall.name)
      const callId = toolCall.id || `${toolCall.name}-${Date.now()}`
      let args: Record<string, unknown> = {}
      try {
        args = toolCall.arguments ? JSON.parse(toolCall.arguments) : {}
      } catch {
        args = {}
      }
      params.onEvent?.({ type: 'tool_start', id: callId, name: toolCall.name, args })

      let output = ''
      if (!tool) {
        output = `未找到工具: ${toolCall.name}`
        params.onEvent?.({ type: 'tool_error', id: callId, name: toolCall.name, output })
        messages.push({ role: 'tool', tool_call_id: callId, content: output })
        continue
      }

      try {
        const emit = (message: string) => {
          if (!message) return
          params.onEvent?.({ type: 'step', message })
        }
        output = await tool.execute(args, { ...params.toolContext, emit })
        params.onEvent?.({ type: 'tool_end', id: callId, name: toolCall.name, output: truncate(output) })
      } catch (e: any) {
        output = String(e?.message || e || '工具执行失败')
        params.onEvent?.({ type: 'tool_error', id: callId, name: toolCall.name, output: output })
      }

      messages.push({ role: 'tool', tool_call_id: callId, content: output })
    }
  }

  return { content: '', think: undefined }
}
