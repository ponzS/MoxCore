<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAiChat } from '@/composables/useAiChat'
const {
  settings,
  messages,
  input,
  isRequesting,
  error,
  thinkExpandedMap,
  toggleThink,
  isThinkExpanded,
  activeModel,
  activeEndpoint,
  send,
  stop,
  clear,
} = useAiChat()
const listRef = ref<HTMLElement | null>(null)
const rafId = ref<number | null>(null)

const modeLabel = computed(() => (settings.mode === 'api' ? 'API模式' : '算力仓模式'))

function scrollToBottom() {
  const el = listRef.value
  if (!el) return
  el.scrollTop = el.scrollHeight
}

function startAutoScroll() {
  if (rafId.value !== null) return
  const loop = () => {
    scrollToBottom()
    rafId.value = requestAnimationFrame(loop)
  }
  rafId.value = requestAnimationFrame(loop)
}

function stopAutoScroll() {
  if (rafId.value === null) return
  cancelAnimationFrame(rafId.value)
  rafId.value = null
}

watch(
  () => messages.value.length,
  () => nextTick(scrollToBottom)
)

const lastMessageContent = computed(() => {
  const len = messages.value.length
  return len ? messages.value[len - 1]?.content || '' : ''
})

watch(lastMessageContent, () => nextTick(scrollToBottom))

watch(
  () => isRequesting.value,
  active => {
    if (active) {
      startAutoScroll()
    } else {
      stopAutoScroll()
    }
  },
  { immediate: true }
)

onMounted(() => nextTick(scrollToBottom))
onUnmounted(() => stopAutoScroll())
</script>

<template>
  <section class="chat">
    <header class="header">
      <div class="title"></div>
      <div class="meta">
        <div class="chip">{{ modeLabel }}</div>
        <div class="chip">Model: {{ activeModel || '-' }}</div>
        <div class="chip">Endpoint: {{ activeEndpoint || '-' }}</div>
      </div>
    </header>

    <div ref="listRef" class="messages">
      <div v-if="!messages.length" class="empty">开始和 AI 聊点什么</div>
      <div v-for="m in messages" :key="m.id" class="msg" :class="`role-${m.role}`">
        <div class="role">{{ m.role }}</div>
        <div class="body">
          <div v-if="m.role === 'assistant' && m.toolSteps && m.toolSteps.length" class="toolPanel">
            <div class="toolTitle">工具过程</div>
            <div class="toolList">
              <div v-for="step in m.toolSteps" :key="step.id" class="toolItem" :class="`tool-${step.status}`">
                <div class="toolHead">
                  <div class="toolName">{{ step.kind === 'step' ? step.name : `${step.name}` }}</div>
                  <div class="toolStatus">
                    {{ step.status === 'running' ? '执行中' : step.status === 'done' ? '完成' : step.status === 'error' ? '失败' : '步骤' }}
                  </div>
                </div>
                <pre v-if="step.args" class="toolArgs">{{ step.args }}</pre>
                <pre v-if="step.output" class="toolOutput">{{ step.output }}</pre>
              </div>
            </div>
          </div>
          <div v-if="m.role === 'assistant' && m.think" class="think">
            <div class="thinkBox">{{ m.think }}</div>
          </div>
          <div class="content" :class="{ error: m.error }">{{ m.content }}</div>
        </div>
      </div>
    </div>

    <div v-if="error" class="errorBar">{{ error }}</div>

    <form
      class="composer"
      @submit.prevent="
        () => {
          void send()
        }
      "
    >
      <textarea v-model="input" class="input" :disabled="isRequesting" placeholder="输入消息…" rows="3" />
      <div class="actions">
        <button class="btn" type="button" @click="clear" :disabled="isRequesting && !messages.length">清空</button>
        <button class="btn" type="button" @click="stop" :disabled="!isRequesting">停止</button>
        <button class="btn primary" type="submit" :disabled="isRequesting">发送</button>
      </div>
      <!-- <div v-if="isRequesting" class="thinking">正在思考中…</div> -->
    </form>
  </section>
</template>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.title {
  font-size: 20px;
  font-weight: 700;
}

.meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.chip {
  font-size: 12px;
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  color: var(--color-text);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.messages {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 12px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: var(--color-background);
}

.toolPanel {
  border: 1px dashed var(--color-border);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
  max-height: 300px;
  overflow: auto;
}

.toolTitle {
  font-weight: 700;
}

.toolList {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toolItem {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.toolHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.toolName {
  font-weight: 600;
}

.toolStatus {
  font-size: 12px;
  opacity: 0.8;
}

.toolArgs,
.toolOutput {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
  background: rgba(0, 0, 0, 0.04);
  padding: 6px 8px;
  border-radius: 6px;
  margin: 0;
}

.tool-running {
  border-color: rgba(46, 125, 50, 0.6);
  animation: toolPulse 1.8s ease-in-out infinite;
}

.tool-error {
  border-color: rgba(209, 67, 67, 0.6);
}

@keyframes toolPulse {
  0% {
    border-color: rgba(46, 125, 50, 0.35);
    box-shadow: 0 0 0 rgba(46, 125, 50, 0.12);
  }
  50% {
    border-color: rgba(46, 125, 50, 0.8);
    box-shadow: 0 0 10px rgba(46, 125, 50, 0.2);
  }
  100% {
    border-color: rgba(46, 125, 50, 0.35);
    box-shadow: 0 0 0 rgba(46, 125, 50, 0.12);
  }
}

.empty {
  opacity: 0.7;
}

.msg {
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid var(--color-border);
}

.body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.msg:first-of-type {
  border-top: 0;
}

.role {
  font-weight: 700;
  text-transform: capitalize;
  opacity: 0.9;
}

.content {
  white-space: pre-wrap;
  word-break: break-word;
}

.content.error {
  color: #d14343;
}

.think {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.thinkToggle {
  align-self: flex-start;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
  border-radius: 10px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
}

.thinkBox {
  border: 1px dashed var(--color-border);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 12px;
  opacity: 0.9;
  white-space: pre-wrap;
  word-break: break-word;
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

.composer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-text);
  resize: vertical;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.thinking {
  font-size: 12px;
  opacity: 0.75;
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

.btn.primary {
  background: var(--vt-c-green);
  border-color: var(--vt-c-green);
  color: #fff;
}
</style>
