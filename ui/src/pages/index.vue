<script setup lang="ts">
import AiChat from '@/components/AiChat.vue'
import AiModelManager from '@/components/AiModelManager.vue'
import AiSkillList from '@/components/AiSkillList.vue'

</script>

<template>
  <div class="page">
    <section class="leftPane">
      <AiModelManager />
      <AiSkillList />
    </section>
    <section class="rightPane">
      <AiChat />
    </section>
  </div>
</template>

<style scoped>
.page {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 16px;
  height: 100vh;
  padding: 16px;
  box-sizing: border-box;
}

.leftPane {
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rightPane {
  height: 100%;
  overflow: hidden;
}
</style>
