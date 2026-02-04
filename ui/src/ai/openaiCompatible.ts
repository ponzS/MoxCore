import type { ChatMessage } from './types'

export interface OpenAICompatibleChatParams {
  url: string
  apiKey?: string
  model: string
  messages: Array<Pick<ChatMessage, 'role' | 'content'>>
  signal?: AbortSignal
  credentials?: RequestCredentials
  onDelta?: (delta: string) => void
}

async function readAsTextSafely(res: Response) {
  try {
    return await res.text()
  } catch {
    return ''
  }
}

function extractDelta(json: any): string {
  const choice = json?.choices?.[0]
  const delta = choice?.delta
  if (typeof delta?.content === 'string') return delta.content
  if (typeof choice?.message?.content === 'string') return choice.message.content
  if (typeof json?.content === 'string') return json.content
  return ''
}

export function splitThinkContent(text: string): { content: string; think: string } {
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

async function streamSse(body: ReadableStream<Uint8Array>, onDelta: (d: string) => void, signal?: AbortSignal) {
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
        try {
          const json = JSON.parse(payload)
          const delta = extractDelta(json)
          if (delta) onDelta(delta)
        } catch {}
      }
    }
  }
}

export async function openAiCompatibleChat(params: OpenAICompatibleChatParams): Promise<{ content: string; think?: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (params.apiKey) headers.Authorization = `Bearer ${params.apiKey}`

  const reqBody: any = {
    model: params.model,
    messages: params.messages,
  }
  const wantsStream = typeof params.onDelta === 'function'
  if (wantsStream) reqBody.stream = true

  const res = await fetch(params.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(reqBody),
    signal: params.signal,
    credentials: params.credentials ?? 'omit',
  })

  if (!res.ok) {
    const text = await readAsTextSafely(res)
    const suffix = text ? `\n${text.slice(0, 800)}` : ''
    throw new Error(`请求失败: ${res.status} ${res.statusText}${suffix}`)
  }

  if (!wantsStream) {
    const json: any = await res.json()
    const raw = String(json?.choices?.[0]?.message?.content || '')
    const { content, think } = splitThinkContent(raw)
    return { content, think: think || undefined }
  }

  if (!res.body) return { content: '' }
  let content = ''
  await streamSse(res.body, d => {
    content += d
    params.onDelta?.(d)
  }, params.signal)
  return { content }
}

export async function openAiCompatibleListModels(params: {
  baseUrl: string
  apiKey?: string
  signal?: AbortSignal
  credentials?: RequestCredentials
}): Promise<string[]> {
  const headers: Record<string, string> = {}
  if (params.apiKey) headers.Authorization = `Bearer ${params.apiKey}`

  const baseUrl = String(params.baseUrl || '').trim()
  if (!baseUrl) return []

  const noSlash = baseUrl.replace(/\/+$/, '')
  const noV1 = noSlash.replace(/\/v1$/i, '')
  const hasV1 = /\/v1$/i.test(noSlash)

  const urls: string[] = []
  if (hasV1) {
    urls.push(`${noSlash}/models`)
    urls.push(`${noV1}/v1/models`)
  } else {
    urls.push(`${noSlash}/v1/models`)
    urls.push(`${noSlash}/models`)
    urls.push(`${noSlash}/api/tags`)
  }

  let lastError: unknown = null

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: params.signal,
        credentials: params.credentials ?? 'omit',
      })
      if (!res.ok) {
        lastError = new Error(`请求失败: ${res.status} ${res.statusText}`)
        continue
      }
      const json: any = await res.json()
      if (url.endsWith('/api/tags')) {
        const arr: any[] = Array.isArray(json?.models) ? json.models : []
        const names = arr.map(v => String(v?.name || '')).filter(Boolean)
        return names
      }
      const data: any[] = Array.isArray(json?.data) ? json.data : []
      const ids = data.map(v => String(v?.id || '')).filter(Boolean)
      return ids
    } catch (e) {
      lastError = e
    }
  }

  if (lastError instanceof Error) throw lastError
  throw new Error('请求失败')
}
