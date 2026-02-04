import { getJson, setJson } from '../tools/db.js'

export type AiMode = 'warehouse' | 'api'

export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  think?: string
  toolSteps?: ToolStep[]
  createdAt: number
  error?: boolean
}

export type ToolStep = {
  id: string
  kind: 'step' | 'tool'
  name: string
  status: 'info' | 'running' | 'done' | 'error'
  args?: string
  output?: string
  createdAt: number
}

export interface ApiModeConfig {
  baseUrl: string
  urlPath: string
  apiKey: string
  model: string
}

export interface WarehouseModeConfig {
  urlTemplate: string
  urlPath: string
  apiKey: string
  model: string
}

export interface AiSettings {
  mode: AiMode
  boxName: string
  api: ApiModeConfig
  warehouse: WarehouseModeConfig
}

const SETTINGS_KEY = 'ai_settings'
const MESSAGES_KEY = 'ai_messages'

export function getDefaultAiSettings(): AiSettings {
  return {
    mode: 'warehouse',
    boxName: '',
    api: {
      baseUrl: '',
      urlPath: '/v1/chat/completions',
      apiKey: '',
      model: '',
    },
    warehouse: {
      urlTemplate: 'https://ollama-ai.BOXNAME.heiyu.space',
      urlPath: '/v1/chat/completions',
      apiKey: '',
      model: '',
    },
  }
}

export function normalizeSettings(input: Partial<AiSettings> | undefined | null): AiSettings {
  const d = getDefaultAiSettings()
  const s = (input || {}) as AiSettings
  const legacyWarehouseTemplate = 'https://BOXNAME.heiyu.space'
  const normalizedWarehouseTemplate = String(s.warehouse?.urlTemplate || d.warehouse.urlTemplate)
  const warehouseTemplate =
    normalizedWarehouseTemplate.trim() === legacyWarehouseTemplate ? d.warehouse.urlTemplate : normalizedWarehouseTemplate
  return {
    mode: s.mode === 'api' ? 'api' : 'warehouse',
    boxName: String(s.boxName || d.boxName),
    api: {
      baseUrl: String(s.api?.baseUrl || d.api.baseUrl),
      urlPath: String(s.api?.urlPath || d.api.urlPath),
      apiKey: String(s.api?.apiKey || d.api.apiKey),
      model: String(s.api?.model || d.api.model),
    },
    warehouse: {
      urlTemplate: warehouseTemplate,
      urlPath: String(s.warehouse?.urlPath || d.warehouse.urlPath),
      apiKey: String(s.warehouse?.apiKey || d.warehouse.apiKey),
      model: String(s.warehouse?.model || d.warehouse.model),
    },
  }
}

export function loadAiSettings(): AiSettings {
  const stored = getJson<AiSettings>(SETTINGS_KEY, getDefaultAiSettings())
  return normalizeSettings(stored)
}

export function saveAiSettings(input: Partial<AiSettings>): AiSettings {
  const current = loadAiSettings()
  const merged: AiSettings = normalizeSettings({
    ...current,
    ...input,
    api: {
      ...current.api,
      ...(input.api || {}),
    },
    warehouse: {
      ...current.warehouse,
      ...(input.warehouse || {}),
    },
  })
  setJson(SETTINGS_KEY, merged)
  return merged
}

export function loadAiMessages(): ChatMessage[] {
  const list = getJson<ChatMessage[]>(MESSAGES_KEY, [])
  return Array.isArray(list) ? list : []
}

export function saveAiMessages(list: ChatMessage[]) {
  setJson(MESSAGES_KEY, list)
  return list
}

export function clearAiMessages() {
  setJson(MESSAGES_KEY, [])
}
