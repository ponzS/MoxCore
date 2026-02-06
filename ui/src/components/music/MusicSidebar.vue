<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { MusicCategory } from '@/music/library'

const props = defineProps<{
  categories: MusicCategory[]
  activeCategoryId: string
  errorText: string
  isPlayerPanelOpen: boolean
  isMainViewCollapsed: boolean
}>()

const emit = defineEmits<{
  (e: 'open-category'): void
  (e: 'select-category', category: MusicCategory): void
  (e: 'open-upload-source', category: MusicCategory): void
  (e: 'remove-category', category: MusicCategory): void
  (e: 'toggle-player'): void
  (e: 'toggle-main-view'): void
}>()
</script>

<template>
  <aside class="sidebar">
    <div class="sidebarScroll">
      <!-- <div class="uploadHeader">
        <button class="btn" type="button" @click="emit('open-category')">新建分类</button>
      </div> -->
      <div v-if="props.errorText" class="error">{{ props.errorText }}</div>
      <div class="sectionHeader">
        <!-- <div class="sectionTitle">分类 <span style="cursor: pointer;font-size: 18px;" @click="emit('open-category')">+</span></div> -->

      </div>
      <div class="categoryList">
        <!-- <div v-if="!props.categories.length" class="empty">暂无分类</div>
        <div
          v-for="category in props.categories"
          :key="category._id || category.name"
          class="categoryBlock"
          :class="{ active: !props.isMainViewCollapsed && props.activeCategoryId === category._id }"
        >
          <div class="categoryHeader">
            <button class="categorySelect" type="button" @click="emit('select-category', category)">
              <span class="categoryName">{{ category.name }}</span>
            </button>
            <button class="ghost removeButton" type="button" @click.stop="emit('remove-category', category)">移除</button>
          </div>
        </div> -->
      </div>
    </div>
    <div class="sidebarFooter">
      <!-- <RouterLink class="btn ghost" to="/Test">测试</RouterLink>
      <RouterLink class="btn ghost" to="/settings">设置</RouterLink>
      <RouterLink class="btn ghost" to="/AiChat">系统</RouterLink> -->
      <button class="btn ghost" type="button" @click="emit('toggle-main-view')">
        {{ props.isMainViewCollapsed ? '展开主视图' : '收起主视图' }}
      </button>
      <button class="btn primary" type="button" @click="emit('toggle-player')">
        {{ props.isPlayerPanelOpen ? '收起模型管理器' : '模型管理器' }}
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 12px;
  padding: 8px 4px;
  overflow: hidden;
}

.sidebarScroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 8px;
}

.sidebarFooter {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 8px;
}

.uploadHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sectionHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.sectionTitle {
  font-weight: 700;
}

.btn {
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
  border-radius: 10px;
  padding: 6px 12px;
  cursor: pointer;
  text-align: center;
}

.btn.primary {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.4);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ghost {
  background: transparent;
  border: 1px solid transparent;
  color: inherit;
  padding: 4px 8px;
  cursor: pointer;
  opacity: 0.7;
}

.removeButton {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.categoryBlock:hover .removeButton {
  opacity: 0.7;
  pointer-events: auto;
}

.categoryList {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.categoryBlock {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 8px 10px;
  background: transparent;
}

.categoryBlock.active {
  border-color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.06);
}

.categoryHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.categorySelect {
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: none;
  color: var(--color-text);
  cursor: pointer;
  padding: 4px;
  text-align: left;
  flex: 1;
}

.categoryName {
  font-weight: 600;
}

.empty {
  font-size: 12px;
  opacity: 0.6;
  padding: 12px 4px;
}

.empty.small {
  padding: 4px 6px;
}

.error {
  font-size: 12px;
  color: #ff8a8a;
  border: 1px solid rgba(255, 138, 138, 0.3);
  border-radius: 10px;
  padding: 8px 10px;
  background: rgba(255, 138, 138, 0.08);
}
</style>
