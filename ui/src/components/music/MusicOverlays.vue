<script setup lang="ts">
const props = defineProps<{
  uploadSourceVisible: boolean
  uploadTargetCategoryName: string
  filePickerVisible: boolean
  filePickerType: 'file' | 'folder'
  boxId: string
  categoryModalVisible: boolean
  categoryModalName: string
  canUploadLocal: boolean
  canPickFiles: boolean
  canPickFolders: boolean
}>()

const emit = defineEmits<{
  (e: 'close-upload-source'): void
  (e: 'trigger-local-file-picker'): void
  (e: 'open-file-picker', type: 'file' | 'folder'): void
  (e: 'close-file-picker'): void
  (e: 'file-picker-submit', event: Event): void
  (e: 'update:categoryModalName', value: string): void
  (e: 'submit-category-modal'): void
  (e: 'close-category-modal'): void
}>()
</script>

<template>
  <div v-if="props.uploadSourceVisible" class="pickerOverlay">
    <div class="sourcePanel">
      <div class="sourceTitle">选择上传来源{{ props.uploadTargetCategoryName ? `（${props.uploadTargetCategoryName}）` : '' }}</div>
      <div class="sourceActions">
        <button class="btn primary" type="button" :disabled="!props.canUploadLocal" @click="emit('trigger-local-file-picker')">本地上传</button>
        <button class="btn" type="button" :disabled="!props.canPickFiles" @click="emit('open-file-picker', 'file')">网盘文件</button>
        <button class="btn ghost" type="button" :disabled="!props.canPickFolders" @click="emit('open-file-picker', 'folder')">网盘文件夹</button>
      </div>
      <button class="btn ghost" type="button" @click="emit('close-upload-source')">取消</button>
    </div>
  </div>

  <div v-if="props.filePickerVisible" class="pickerOverlay">
    <div class="pickerPanel">
      <lzc-file-picker
        class="picker"
        :boxId="props.boxId || undefined"
        :type="props.filePickerType"
        :multiple="true"
        :isModal="true"
        base-url="/_lzc/files/home"
        :choiceFileOnly="true"
        title="选择音频文件或文件夹"
        rootpath="/"
        rootname=""
        confirm-button-title="确认"
        @close="emit('close-file-picker')"
        @submit="emit('file-picker-submit', $event)"
      />
    </div>
  </div>

  <div v-if="props.categoryModalVisible" class="pickerOverlay">
    <div class="sourcePanel">
      <div class="sourceTitle">新建分类</div>
      <input
        class="input"
        :value="props.categoryModalName"
        placeholder="请输入分类名称"
        @input="emit('update:categoryModalName', ($event.target as HTMLInputElement).value)"
      />
      <div class="sourceActions">
        <button class="btn primary" type="button" @click="emit('submit-category-modal')">创建</button>
        <button class="btn ghost" type="button" @click="emit('close-category-modal')">取消</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pickerOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
}

.sourcePanel {
  width: min(420px, 92vw);
  border-radius: 16px;
  border: 1px solid var(--color-border);
  background: #0f0f0f;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  text-align: center;
}

.sourceTitle {
  font-weight: 700;
}

.sourceActions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.pickerPanel {
  width: min(920px, 96vw);
  height: min(640px, 92vh);
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: #0f0f0f;
}

.picker {
  width: 100%;
  height: 100%;
}

.btn {
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
  border-radius: 10px;
  padding: 6px 12px;
  cursor: pointer;
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

.input {
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
  width: 100%;
}
</style>
