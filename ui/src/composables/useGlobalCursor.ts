import { ref, onMounted, onUnmounted } from 'vue';

const x = ref(0);
const y = ref(0);

export function useGlobalCursor() {
  function update(event: MouseEvent) {
    x.value = event.clientX;
    y.value = event.clientY;
  }

  onMounted(() => {
    window.addEventListener('mousemove', update, { passive: true });
    window.addEventListener('pointermove', update, { passive: true });
  });

  onUnmounted(() => {
    window.removeEventListener('mousemove', update);
    window.removeEventListener('pointermove', update);
  });

  return { x, y };
}
