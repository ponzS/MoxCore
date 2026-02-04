import { reactive, readonly, watch } from 'vue'
import type { AiSettings } from './types'
import { fetchAiSettings, updateAiSettings } from './backend'

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

function normalizeSettings(input: Partial<AiSettings> | undefined | null): AiSettings {
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

const state = reactive<AiSettings>(normalizeSettings(getDefaultAiSettings()))

let ready = false
let saveTimer: number | undefined

void (async () => {
  try {
    const loaded = await fetchAiSettings()
    const next = normalizeSettings(loaded)
    state.mode = next.mode
    state.boxName = next.boxName
    state.api = next.api
    state.warehouse = next.warehouse
  } catch {}
  ready = true
})()

watch(
  state,
  v => {
    if (!ready) return
    if (saveTimer) window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      void updateAiSettings(v)
    }, 300)
  },
  { deep: true }
)

export function useAiSettings() {
  return readonly(state)
}

export function useAiSettingsMutable() {
  return state
}
