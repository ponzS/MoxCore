<script setup lang="ts">
import { computed, ref } from 'vue'
import { fetchAiModels } from '@/ai/backend'
import { useAiSettingsMutable } from '@/ai/settings'

const settings = useAiSettingsMutable()

const modelsLoading = ref(false)
const modelsError = ref('')
const models = ref<string[]>([])

function trimUrlPath(path: string) {
  const p = String(path || '').trim()
  if (!p) return ''
  return p.startsWith('/') ? p : `/${p}`
}

function resolveWarehouseBaseUrl() {
  const template = String(settings.warehouse.urlTemplate || '').trim() || 'https://ollama-ai.BOXNAME.heiyu.space'
  const box = String(settings.boxName || '').trim()
  if (!box) return ''
  return template.replace(/BOXNAME/g, box)
}

const activeModeLabel = computed(() => (settings.mode === 'api' ? 'API模式' : '算力仓模式'))
const warehouseBaseUrl = computed(() => resolveWarehouseBaseUrl())
const warehouseChatEndpoint = computed(() => {
  const base = warehouseBaseUrl.value.replace(/\/+$/, '')
  const path = trimUrlPath(settings.warehouse.urlPath)
  if (!base || !path) return ''
  return `${base}${path}`
})
const apiChatEndpoint = computed(() => {
  const base = String(settings.api.baseUrl || '').trim().replace(/\/+$/, '')
  const path = trimUrlPath(settings.api.urlPath)
  if (!base || !path) return ''
  return `${base}${path}`
})

async function fetchModels() {
  modelsError.value = ''
  models.value = []
  modelsLoading.value = true
  try {
    if (settings.mode === 'api') {
      const baseUrl = String(settings.api.baseUrl || '').trim()
      if (!baseUrl) throw new Error('请先填写 API 基础地址')
    } else {
      const baseUrl = warehouseBaseUrl.value
      if (!baseUrl) throw new Error('请先填写 BoxName')
    }
    models.value = await fetchAiModels()
  } catch (e: any) {
    modelsError.value = String(e?.message || e || '获取失败')
  } finally {
    modelsLoading.value = false
  }
}
</script>

<template>
  <section class="panel">
    <div class="row head">
      <div class="title">模型管理器</div>
      <div class="hint">设置会自动保存到服务端</div>
    </div>

    <div class="grid">
      <label class="field">
        <div class="label">模式</div>
        <select v-model="settings.mode" class="control">
          <option value="warehouse">算力仓模式</option>
          <option value="api">API模式</option>
        </select>
      </label>

      <div class="divider" />

      <div v-if="settings.mode === 'warehouse'" class="section">
        <div class="sectionTitle">算力仓模式</div>

        <label class="field">
          <div class="label">BoxName</div>
          <input v-model="settings.boxName" class="control" placeholder="例如：mybox" />
        </label>

        <label class="field">
          <div class="label">URL模板</div>
          <input
            v-model="settings.warehouse.urlTemplate"
            class="control"
            placeholder="例如：https://ollama-ai.BOXNAME.heiyu.space"
          />
        </label>

        <label class="field">
          <div class="label">Chat Path</div>
          <input v-model="settings.warehouse.urlPath" class="control" placeholder="/v1/chat/completions" />
        </label>

        <label class="field">
          <div class="label">模型</div>
          <input v-model="settings.warehouse.model" class="control" placeholder="例如：aipod-trans" />
        </label>

        <label class="field">
          <div class="label">API Key（可选）</div>
          <input v-model="settings.warehouse.apiKey" class="control" placeholder="Bearer Token（可留空）" />
        </label>

        <div class="field">
          <div class="label">当前Endpoint</div>
          <div class="mono">{{ warehouseChatEndpoint || '-' }}</div>
        </div>
      </div>

      <div v-else class="section">
        <div class="sectionTitle">API模式</div>

        <label class="field">
          <div class="label">API基础地址</div>
          <input v-model="settings.api.baseUrl" class="control" placeholder="例如：https://api.openai.com" />
        </label>

        <label class="field">
          <div class="label">Chat Path</div>
          <input v-model="settings.api.urlPath" class="control" placeholder="/v1/chat/completions" />
        </label>

        <label class="field">
          <div class="label">模型</div>
          <input v-model="settings.api.model" class="control" placeholder="例如：gpt-4.1-mini" />
        </label>

        <label class="field">
          <div class="label">API Key</div>
          <input v-model="settings.api.apiKey" class="control" placeholder="Bearer Token" />
        </label>

        <div class="field">
          <div class="label">当前Endpoint</div>
          <div class="mono">{{ apiChatEndpoint || '-' }}</div>
        </div>
      </div>

      <div class="divider" />

      <div class="row">
        <div class="metaLeft">
          <div class="chip">当前：{{ activeModeLabel }}</div>
        </div>
        <div class="metaRight">
          <button class="btn" type="button" @click="fetchModels" :disabled="modelsLoading">获取模型列表</button>
        </div>
      </div>

      <div v-if="modelsError" class="errorBar">{{ modelsError }}</div>

      <div v-if="modelsLoading" class="hint">正在获取模型列表…</div>

      <div v-if="models.length" class="models">
        <div class="modelsTitle">模型列表</div>
        <div class="modelsGrid">
          <button
            v-for="m in models"
            :key="m"
            class="modelBtn"
            type="button"
            @click="
              () => {
                if (settings.mode === 'api') settings.api.model = m
                else settings.warehouse.model = m
              }
            "
          >
            {{ m }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel {
  width: min(920px, 100%);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.head {
  align-items: baseline;
}

.title {
  font-size: 18px;
  font-weight: 700;
}

.hint {
  font-size: 12px;
  opacity: 0.7;
}

.grid {
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.divider {
  height: 1px;
  background: var(--color-border);
}

.section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sectionTitle {
  font-weight: 700;
}

.field {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 10px;
  align-items: center;
}

.label {
  font-size: 12px;
  opacity: 0.85;
}

.control {
  width: 100%;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-text);
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
  opacity: 0.9;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn {
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
  border-radius: 10px;
  padding: 8px 12px;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chip {
  font-size: 12px;
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
}

.errorBar {
  font-size: 12px;
  color: #d14343;
  padding: 8px 10px;
  border: 1px solid rgba(209, 67, 67, 0.4);
  border-radius: 10px;
  background: rgba(209, 67, 67, 0.06);
  white-space: pre-wrap;
}

.models {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.modelsTitle {
  font-weight: 700;
}

.modelsGrid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.modelBtn {
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
  border-radius: 999px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
}
</style>
