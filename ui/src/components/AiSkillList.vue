<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { AiSkill } from '@/ai/types'
import { fetchAiSkills } from '@/ai/backend'

const skills = ref<AiSkill[]>([])
const loading = ref(false)
const error = ref('')

async function loadSkills() {
  loading.value = true
  error.value = ''
  try {
    const list = await fetchAiSkills()
    skills.value = Array.isArray(list) ? list : []
  } catch (e: any) {
    error.value = String(e?.message || e || '加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadSkills()
})
</script>

<template>
  <section class="panel">
    <div class="row head">
      <div class="title">技能列表</div>
      <div class="metaRight">
        <button class="btn" type="button" @click="loadSkills" :disabled="loading">刷新</button>
      </div>
    </div>

    <div class="grid">
      <div v-if="error" class="errorBar">{{ error }}</div>
      <div v-if="loading" class="hint">正在加载技能…</div>
      <div v-if="!loading && !skills.length" class="hint">暂无技能</div>
      <div v-if="skills.length" class="skillList">
        <div v-for="skill in skills" :key="skill.name" class="skillItem">
          <div class="skillName">{{ skill.name }}</div>
          <div v-if="skill.description" class="skillDesc">{{ skill.description }}</div>
          <div v-if="skill.homepage" class="skillLink">{{ skill.homepage }}</div>
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

.grid {
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.hint {
  font-size: 12px;
  opacity: 0.7;
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

.skillList {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skillItem {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skillName {
  font-weight: 700;
}

.skillDesc {
  font-size: 12px;
  opacity: 0.85;
}

.skillLink {
  font-size: 12px;
  opacity: 0.8;
  word-break: break-all;
}
</style>
