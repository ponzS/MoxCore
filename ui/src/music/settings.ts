import { computed, reactive, readonly, watch } from 'vue'
import { getJson, setJson } from '@/ai/storage'
import { useAiSettings } from '@/ai/settings'

export type MusicSettings = {
  manualBoxName: string
  manualFileBaseUrl: string
}

const STORAGE_KEY = 'lzcgamedemo:music:settings'

function normalizeSettings(input: Partial<MusicSettings> | null): MusicSettings {
  return {
    manualBoxName: String(input?.manualBoxName || '').trim(),
    manualFileBaseUrl: String(input?.manualFileBaseUrl || '').trim(),
  }
}

function resolveHostBoxName() {
  const currentHost = window.location.host
  const envBoxName = String((import.meta as any).env?.VITE_BOX_NAME || '').trim()
  const isLocal =
    currentHost.startsWith('localhost') || currentHost.startsWith('127.0.0.1') || currentHost.startsWith('192.168') || (envBoxName && currentHost.startsWith(envBoxName))
  if (isLocal) {
    const cached = localStorage.getItem('lzc-ai-box-name') || ''
    if (cached) return cached
    if (envBoxName) return envBoxName
  }
  const parts = currentHost.split('.')
  if (parts.length >= 2) return parts[1] || ''
  return ''
}

const state = reactive<MusicSettings>(normalizeSettings(getJson<MusicSettings | null>(STORAGE_KEY, null)))

watch(
  state,
  v => {
    setJson(STORAGE_KEY, v)
  },
  { deep: true }
)

export function useMusicSettings() {
  const aiSettings = useAiSettings()
  const autoBoxName = computed(() => String(aiSettings.boxName || '').trim() || resolveHostBoxName())
  const effectiveBoxName = computed(() => state.manualBoxName || autoBoxName.value)
  const autoFileBaseUrl = computed(() => (effectiveBoxName.value ? `https://${effectiveBoxName.value}.heiyu.space/_lzc/files/home` : ''))
  const effectiveFileBaseUrl = computed(() => state.manualFileBaseUrl || autoFileBaseUrl.value)
  return {
    settings: readonly(state),
    autoBoxName,
    effectiveBoxName,
    autoFileBaseUrl,
    effectiveFileBaseUrl,
  }
}

export function useMusicSettingsMutable() {
  const aiSettings = useAiSettings()
  const autoBoxName = computed(() => String(aiSettings.boxName || '').trim() || resolveHostBoxName())
  const effectiveBoxName = computed(() => state.manualBoxName || autoBoxName.value)
  const autoFileBaseUrl = computed(() => (effectiveBoxName.value ? `https://${effectiveBoxName.value}.heiyu.space/_lzc/files/home` : ''))
  const effectiveFileBaseUrl = computed(() => state.manualFileBaseUrl || autoFileBaseUrl.value)
  return {
    settings: state,
    autoBoxName,
    effectiveBoxName,
    autoFileBaseUrl,
    effectiveFileBaseUrl,
  }
}
