<script setup lang="ts">
import AiChat from '@/components/AiChat.vue'
import AiModelManager from '@/components/AiModelManager.vue'
import AiSkillList from '@/components/AiSkillList.vue'

</script>

<template>
  <!-- <div class="page">
    <section class="leftPane">
      <AiModelManager />
      <AiSkillList />
    </section>
    <section class="rightPane">
      <AiChat />
    </section>
  </div> -->
     <!-- <div style="height: 100%;position:absolute;width: 100%;padding: 30px;">
        <AiChat />
        </div> -->
         <AiChat />
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
