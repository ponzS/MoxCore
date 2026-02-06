<script setup lang="ts">
import type { MusicTrack } from '@/music/library'
import AiModelManager from '../AiModelManager.vue';
import AiSkillList from '../AiSkillList.vue';

const props = defineProps<{
  activeTrack: MusicTrack | null
  isPlaying: boolean
  duration: number
  currentTime: number
  timeText: string
  volume: number
}>()

const emit = defineEmits<{
  (e: 'toggle-play'): void
  (e: 'play-next', offset: number): void
  (e: 'seek', value: number): void
  (e: 'update:volume', value: number): void
}>()
</script>

<template>
  <div class="playerCard">
    
    <AiModelManager/>
    <AiSkillList/>
    
  </div>
</template>

<style scoped>
.playerCard {
  border: 1px solid var(--color-border);
  border-radius: 18px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
    background-color: black;
  flex-wrap: wrap;
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.25);
}

.playerInfo {
  min-width: 220px;
}

.playerTitle {
  font-weight: 700;
}

.playerPath {
  font-size: 12px;
  opacity: 0.6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 240px;
}

.playerControls {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.controlRow,
.progressRow,
.volumeRow {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider {
  flex: 1;
  accent-color: #ffffff;
}

.time,
.volumeLabel {
  font-size: 12px;
  opacity: 0.7;
  min-width: 72px;
}

.btn {
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
  border-radius: 10px;
  padding: 6px 12px;
  cursor: pointer;
}

.btn.ghost {
  opacity: 0.7;
}
</style>
