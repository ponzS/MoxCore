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

export interface AiSkill {
  name: string
  description?: string
  homepage?: string
  metadata?: unknown
  dir?: string
}

export type ToolEvent =
  | { type: 'step'; message: string }
  | { type: 'tool_start'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_end'; id: string; name: string; output: string }
  | { type: 'tool_error'; id: string; name: string; output: string }

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
