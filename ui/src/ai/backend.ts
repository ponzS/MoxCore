import type { AiSettings, AiSkill, ChatMessage, ToolEvent } from './types'

const API_BASE = String(import.meta.env.VITE_AI_API_BASE || '').replace(/\/+$/, '')

function buildUrl(path: string) {
  return API_BASE ? `${API_BASE}${path}` : path
}

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(buildUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  })
  if (!res.ok) {
    let message = `请求失败: ${res.status} ${res.statusText}`
    try {
      const json: any = await res.json()
      if (json?.error) message = String(json.error)
    } catch {}
    throw new Error(message)
  }
  return (await res.json()) as T
}

async function streamSse(body: ReadableStream<Uint8Array>, onMessage: (payload: string) => void, signal?: AbortSignal) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    if (signal?.aborted) break
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''
    for (const part of parts) {
      const lines = part.split('\n')
      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (!payload) continue
        if (payload === '[DONE]') return
        onMessage(payload)
      }
    }
  }
}

export async function fetchAiSettings(): Promise<AiSettings> {
  return requestJson<AiSettings>('/api/ai/settings')
}

export async function updateAiSettings(settings: AiSettings): Promise<AiSettings> {
  return requestJson<AiSettings>('/api/ai/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}

export async function fetchAiMessages(): Promise<ChatMessage[]> {
  return requestJson<ChatMessage[]>('/api/ai/messages')
}

export async function clearAiMessages(): Promise<void> {
  await requestJson('/api/ai/messages', { method: 'DELETE' })
}

export async function sendAiMessage(text: string, signal?: AbortSignal): Promise<{ messages: ChatMessage[] }> {
  const res = await fetch(buildUrl('/api/ai/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal,
  })
  if (!res.ok) {
    let message = `请求失败: ${res.status} ${res.statusText}`
    let payload: any = null
    try {
      payload = await res.json()
      if (payload?.error) message = String(payload.error)
    } catch {}
    const err = new Error(message) as Error & { payload?: any }
    err.payload = payload
    throw err
  }
  const json: any = await res.json()
  return { messages: Array.isArray(json?.messages) ? json.messages : [] }
}

export async function sendAiMessageStream(
  text: string,
  signal: AbortSignal | undefined,
  handlers: {
    onDelta?: (delta: string) => void
    onMessages?: (messages: ChatMessage[]) => void
    onToolEvent?: (event: ToolEvent) => void
  }
): Promise<{ messages: ChatMessage[] }> {
  const res = await fetch(buildUrl('/api/ai/chat?stream=1'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ text }),
    signal,
  })

  if (!res.ok) {
    let message = `请求失败: ${res.status} ${res.statusText}`
    let payload: any = null
    try {
      payload = await res.json()
      if (payload?.error) message = String(payload.error)
    } catch {}
    const err = new Error(message) as Error & { payload?: any }
    err.payload = payload
    throw err
  }

  if (!res.body) {
    const json: any = await res.json()
    const list = Array.isArray(json?.messages) ? json.messages : []
    if (list.length) handlers.onMessages?.(list)
    return { messages: list }
  }

  let finalMessages: ChatMessage[] = []

  await streamSse(
    res.body,
    payload => {
      if (!payload) return
      try {
        const json = JSON.parse(payload)
        if (json?.type === 'delta' && typeof json.delta === 'string') {
          handlers.onDelta?.(json.delta)
          return
        }
        if (json?.type === 'done' && Array.isArray(json.messages)) {
          finalMessages = json.messages
          handlers.onMessages?.(finalMessages)
          return
        }
        if (json?.type === 'error') {
          if (Array.isArray(json.messages)) {
            finalMessages = json.messages
            handlers.onMessages?.(finalMessages)
          }
          return
        }
        if (json?.type === 'tool_start' || json?.type === 'tool_end' || json?.type === 'tool_error' || json?.type === 'step') {
          handlers.onToolEvent?.(json as ToolEvent)
        }
      } catch {}
    },
    signal
  )

  return { messages: finalMessages }
}

export async function fetchAiModels(): Promise<string[]> {
  return requestJson<string[]>('/api/ai/models')
}

export async function fetchAiSkills(): Promise<AiSkill[]> {
  return requestJson<AiSkill[]>('/api/ai/skills')
}
