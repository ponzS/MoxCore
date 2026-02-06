<script setup lang="ts">
import { provide, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import MusicMainView from '@/components/music/MusicMainView.vue'
import MusicOverlays from '@/components/music/MusicOverlays.vue'
import MusicPlayerPanel from '@/components/music/MusicPlayerPanel.vue'
import MusicSidebar from '@/components/music/MusicSidebar.vue'
import { useMusicWorkspace } from '@/composables/useMusicWorkspace'
import type { MusicCategory } from '@/music/library'
import Spline from '@/components/ui/robot/Spline.vue'
import { useGlobalCursor } from '@/composables/useGlobalCursor'

const sceneUrl = new URL('./assets/scene.splinecode', import.meta.url).href
const { x, y } = useGlobalCursor()

const router = useRouter()
const workspace = useMusicWorkspace()

provide('musicWorkspace', workspace)

const {
  effectiveBoxName,
  categories,
  activeCategoryId,
  errorText,
  isPlayerPanelOpen,
  activeTrack,
  isPlaying,
  duration,
  currentTime,
  timeText,
  volume,
  uploadSourceVisible,
  uploadTargetCategoryName,
  localFileInputRef,
  filePickerVisible,
  filePickerType,
  categoryModalVisible,
  categoryModalName,
  canUploadLocal,
  canPickFiles,
  canPickFolders,
  isMainViewCollapsed,
  openCategoryModal,
  selectCategory,
  openMainView,
  openUploadSourcePickerForCategory,
  handleRemoveCategory,
  togglePlay,
  playNext,
  seekTo,
  handleTimeUpdate,
  handleLoadedMetadata,
  handleEnded,
  closeUploadSourcePicker,
  triggerLocalFilePicker,
  openFilePicker,
  closeFilePicker,
  handleFilePickerSubmit,
  handleLocalFilesSelected,
  submitCategoryModal,
  closeCategoryModal,
  togglePlayerPanel,
  toggleMainView,
  audioRef,
} = workspace

function handleCategorySelect(category: MusicCategory) {
  selectCategory(category)
  openMainView()
  if (!category?._id) return
  router.push({
    name: 'music-list',
    query: {
      categoryId: category._id,
      categoryName: category.name,
    },
  })
}

// function robot(){
//   const sceneUrl = new URL('./assets/scene.splinecode', import.meta.url).href
// }

// onMounted(() => {
//  robot()
// })

</script>

<template>
  <transition name="pillar">
    <div v-if="isMainViewCollapsed" class="pillarBackdrop">
   <Spline
        :scene="sceneUrl"
        class="size-full pointer-events-auto"
        :global-mouse="{ x, y }"
      />
    </div>
  </transition>
  <main class="page">
    <div class="layout">
      <MusicSidebar
        :categories="categories"
        :activeCategoryId="activeCategoryId"
        :errorText="errorText"
        :isPlayerPanelOpen="isPlayerPanelOpen"
        :isMainViewCollapsed="isMainViewCollapsed"
        @open-category="openCategoryModal"
        @select-category="handleCategorySelect"
        @open-upload-source="openUploadSourcePickerForCategory"
        @remove-category="handleRemoveCategory"
        @toggle-player="togglePlayerPanel"
        @toggle-main-view="toggleMainView"
      />

      <div class="mainColumn" :class="{ collapsed: isMainViewCollapsed }">
        <section class="content">
          <div class="contentCard">
            <MusicMainView />
          </div>
        </section>
        <div class="playerPanel" :class="{ open: isPlayerPanelOpen }">
          <MusicPlayerPanel
            :activeTrack="activeTrack"
            :isPlaying="isPlaying"
            :duration="duration"
            :currentTime="currentTime"
            :timeText="timeText"
            :volume="volume"
            @toggle-play="togglePlay"
            @play-next="playNext"
            @seek="seekTo"
            @update:volume="value => (volume = value)"
          />
          <audio ref="audioRef" @timeupdate="handleTimeUpdate" @loadedmetadata="handleLoadedMetadata" @ended="handleEnded" />
        </div>
      </div>
    </div>

    <input ref="localFileInputRef" class="hiddenInput" type="file" accept="audio/*" multiple @change="handleLocalFilesSelected" />
    <MusicOverlays
      :uploadSourceVisible="uploadSourceVisible"
      :uploadTargetCategoryName="uploadTargetCategoryName"
      :filePickerVisible="filePickerVisible"
      :filePickerType="filePickerType"
      :boxId="effectiveBoxName"
      :categoryModalVisible="categoryModalVisible"
      :categoryModalName="categoryModalName"
      :canUploadLocal="canUploadLocal"
      :canPickFiles="canPickFiles"
      :canPickFolders="canPickFolders"
      @close-upload-source="closeUploadSourcePicker"
      @trigger-local-file-picker="triggerLocalFilePicker"
      @open-file-picker="openFilePicker"
      @close-file-picker="closeFilePicker"
      @file-picker-submit="handleFilePickerSubmit"
      @update:categoryModalName="value => (categoryModalName = value)"
      @submit-category-modal="submitCategoryModal"
      @close-category-modal="closeCategoryModal"
    />
  </main>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 18px;
  min-height: 100vh;
  height: 100vh;
  overflow: hidden;
  pointer-events: none;
}

.page > * {
  pointer-events: auto;
}

.pillarBackdrop {
  width: 100%;
  height: 100%;
  position: fixed;
  top: 0;
  left: 0;
  z-index: -1;
  pointer-events: none;
}

.pillar-enter-active {
  animation: pillarBlurIn 0.7s ease both;
}

.pillar-leave-active {
  animation: pillarBlurOut 0.7s ease both;
}

@keyframes pillarBlurIn {
  0% {
    filter: blur(0px);
    opacity: 0;
  }
  50% {
    filter: blur(20px);
    opacity: 1;
  }
  100% {
    filter: blur(0px);
    opacity: 1;
  }
}

@keyframes pillarBlurOut {
  0% {
    filter: blur(0px);
    opacity: 1;
  }
  50% {
    filter: blur(20px);
    opacity: 1;
  }
  100% {
    filter: blur(0px);
    opacity: 0;
  }
}

.layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 16px;
  transition: grid-template-columns 0.35s ease, gap 0.35s ease;
  pointer-events: none;
}

.layout > * {
  pointer-events: auto;
}

.mainColumn {
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;
  overflow: hidden;
  pointer-events: none;
}

.mainColumn > * {
  pointer-events: auto;
}

.content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 18px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.02);
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.25);
  transition: transform 0.35s ease;
}

.mainColumn.collapsed .content {
  transform: translateY(-120%);
  pointer-events: none;
}

.contentCard {
  height: 100%;
  border-radius: 18px;
  overflow: hidden;
}

.playerPanel {
  max-height: 0;
  opacity: 0;
  transform: translateY(18px);
  transition:
    max-height 0.35s ease,
    opacity 0.35s ease,
    transform 0.35s ease,
    padding 0.35s ease;
  overflow: hidden;
  margin-top: auto;
  border-radius: 18px;
}

.playerPanel.open {
  max-height: 520px;
  opacity: 1;
  transform: translateY(0);
  padding: 12px 0px 0;
  overflow-y: auto;
}

.hiddenInput {
  display: none;
}

@media (max-width: 980px) {
  .layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
}
</style>
