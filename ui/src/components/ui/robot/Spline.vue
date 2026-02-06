<script setup lang="ts">
import type { SplineEventName } from "@splinetool/runtime";
import { Application } from "@splinetool/runtime";
import { useDebounceFn, useIntersectionObserver, useResizeObserver } from "@vueuse/core";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import ParentSize from "./ParentSize.vue";

const props = defineProps({
  scene: {
    type: String,
    required: true,
  },
  onLoad: Function,
  renderOnDemand: {
    type: Boolean,
    default: true,
  },
  style: Object,
  globalMouse: {
    type: Object as () => { x: number; y: number } | null,
    default: null,
  },
});

const emit = defineEmits([
  "error",
  "spline-mouse-down",
  "spline-mouse-up",
  "spline-mouse-hover",
  "spline-key-down",
  "spline-key-up",
  "spline-start",
  "spline-look-at",
  "spline-follow",
  "spline-scroll",
]);

const canvasRef = ref<HTMLCanvasElement | null>(null);
const isLoading = ref(false);
const splineApp = ref<Application | null>(null);
const isVisible = ref(true);
const blobUrl = ref<string | null>(null);
let retryTimer: number | null = null;
let retryCount = 0;
let extraCleanup: Array<() => void> = [];
let warmupTimer: number | null = null;

let cleanup: () => void = () => {};

const parentSizeStyles = computed(() => ({
  overflow: "hidden",
  ...props.style,
}));

const canvasStyle = computed(() => ({
  display: "block",
  width: "100%",
  height: "100%",
}));

// Use IntersectionObserver to detect when component is visible
const { stop: stopIntersectionObserver } = useIntersectionObserver(
  canvasRef,
  (entries) => {
    const entry = entries[0];
    if (!entry) return;
    const { isIntersecting } = entry;
    isVisible.value = isIntersecting;
    nextTick(() => {
      if (canvasRef.value && splineApp.value) {
        splineApp.value.setSize(canvasRef.value.clientWidth, canvasRef.value.clientHeight);
        splineApp.value.requestRender();
      }
    });
  },
  { threshold: 0.1 },
);

useResizeObserver(canvasRef, (entries) => {
  const entry = entries[0];
  if (!entry) return;
  if (splineApp.value && canvasRef.value) {
    splineApp.value.setSize(canvasRef.value.clientWidth, canvasRef.value.clientHeight);
    splineApp.value.requestRender();
  }
});

watch(
  () => props.globalMouse,
  (pos) => {
    if (pos && canvasRef.value && isVisible.value) {
      // Dispatch synthetic pointer event to allow interaction even when covered
      const eventInit = {
        clientX: pos.x,
        clientY: pos.y,
        bubbles: true,
        cancelable: true,
        view: window,
        pointerType: 'mouse',
        isPrimary: true
      };
      
      if (typeof PointerEvent !== 'undefined') {
        canvasRef.value.dispatchEvent(new PointerEvent('pointermove', eventInit));
        canvasRef.value.dispatchEvent(new PointerEvent('mousemove', eventInit)); // Some libs listen to mousemove
      } else {
        canvasRef.value.dispatchEvent(new MouseEvent('mousemove', eventInit));
      }
    }
  },
  { deep: true }
);

function eventHandler(name: SplineEventName, handler?: (e: any) => void) {
  if (!handler || !splineApp.value) return;
  const debouncedHandler = useDebounceFn(handler, 50, { maxWait: 100 });
  splineApp.value.addEventListener(name, debouncedHandler);
  return () => splineApp.value?.removeEventListener(name, debouncedHandler);
}

async function initSpline() {
  if (!canvasRef.value) return;

  isLoading.value = true;

  try {
    if (splineApp.value) {
      splineApp.value.dispose();
      splineApp.value = null;
    }

    splineApp.value = new Application(canvasRef.value, {
      renderOnDemand: props.renderOnDemand,
    });

    const urlToLoad = await preloadScene(props.scene);
    await waitForCanvasSize();
    await splineApp.value.load(urlToLoad);
    if (canvasRef.value) {
      splineApp.value.setSize(canvasRef.value.clientWidth, canvasRef.value.clientHeight);
      splineApp.value.requestRender();
    }
    warmupResize();

    const cleanUpFns = [
      eventHandler("mouseDown", (e: any) => emit("spline-mouse-down", e)),
      eventHandler("mouseUp", (e: any) => emit("spline-mouse-up", e)),
      eventHandler("mouseHover", (e: any) => emit("spline-mouse-hover", e)),
      eventHandler("keyDown", (e: any) => emit("spline-key-down", e)),
      eventHandler("keyUp", (e: any) => emit("spline-key-up", e)),
      eventHandler("start", (e: any) => emit("spline-start", e)),
      eventHandler("lookAt", (e: any) => emit("spline-look-at", e)),
      eventHandler("follow", (e: any) => emit("spline-follow", e)),
      eventHandler("scroll", (e: any) => emit("spline-scroll", e)),
    ].filter(Boolean);

    isLoading.value = false;
    retryCount = 0;
    props.onLoad?.(splineApp.value);

    return () => {
      cleanUpFns.forEach((fn) => fn?.());
    };
  } catch (err) {
    console.error("Spline initialization error:", err);
    emit("error", err);
    isLoading.value = false;
    if (retryCount < 3) {
      retryCount += 1;
      retryTimer = window.setTimeout(() => {
        initialize();
      }, 500 * retryCount);
    }
    return () => {};
  }
}

async function preloadScene(src: string) {
  if (blobUrl.value) return blobUrl.value;
  try {
    const res = await fetch(src, { cache: "force-cache" });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    blobUrl.value = url;
    return url;
  } catch {
    return src;
  }
}

async function waitForCanvasSize() {
  const start = Date.now();
  for (;;) {
    if (!canvasRef.value) break;
    const w = canvasRef.value.clientWidth;
    const h = canvasRef.value.clientHeight;
    if (w > 0 && h > 0) break;
    if (Date.now() - start > 2000) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function initialize() {
  cleanup();
  cleanup = (await initSpline()) ?? (() => {});
}

function warmupResize() {
  if (!splineApp.value || !canvasRef.value) return;
  const start = Date.now();
  const tick = () => {
    if (!splineApp.value || !canvasRef.value) return;
    splineApp.value.setSize(canvasRef.value.clientWidth, canvasRef.value.clientHeight);
    splineApp.value.requestRender();
    if (Date.now() - start < 2000) {
      warmupTimer = window.setTimeout(tick, 100);
    }
  };
  tick();
}

onMounted(async () => {
  await initialize();

  watch(isVisible, (visible) => {
    if (visible) {
      initialize();
    }
  });

  const handleVisibility = () => {
    if (document.visibilityState === "visible") {
      initialize();
    }
  };
  document.addEventListener("visibilitychange", handleVisibility);
  extraCleanup.push(() => document.removeEventListener("visibilitychange", handleVisibility));

  const handleResize = () => {
    if (splineApp.value && canvasRef.value) {
      splineApp.value.setSize(canvasRef.value.clientWidth, canvasRef.value.clientHeight);
      splineApp.value.requestRender();
    }
  };
  window.addEventListener("resize", handleResize);
  window.addEventListener("orientationchange", handleResize);
  extraCleanup.push(() => {
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("orientationchange", handleResize);
  });

  if (canvasRef.value) {
    const onContextLost = (event: Event) => {
      event.preventDefault();
      initialize();
    };
    const onContextRestored = () => {
      initialize();
    };
    canvasRef.value.addEventListener("webglcontextlost", onContextLost as EventListener, { passive: false });
    canvasRef.value.addEventListener("webglcontextrestored", onContextRestored as EventListener);
    extraCleanup.push(() => {
      canvasRef.value?.removeEventListener("webglcontextlost", onContextLost as EventListener);
      canvasRef.value?.removeEventListener("webglcontextrestored", onContextRestored as EventListener);
    });
  }
});

onUnmounted(() => {
  stopIntersectionObserver();
  if (splineApp.value) {
    splineApp.value.dispose();
    splineApp.value = null;
  }
  extraCleanup.forEach((fn) => fn());
  extraCleanup = [];
  if (blobUrl.value) {
    URL.revokeObjectURL(blobUrl.value);
    blobUrl.value = null;
  }
  if (warmupTimer) {
    clearTimeout(warmupTimer);
    warmupTimer = null;
  }
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
    retryCount = 0;
  }
});
</script>

<template>
  <ParentSize
    :parent-size-styles="parentSizeStyles"
    :debounce-time="50"
    v-bind="$attrs"
  >
    <template #default>
      <canvas
        ref="canvasRef"
        :style="canvasStyle"
      />
      <slot v-if="isLoading" />
    </template>
  </ParentSize>
</template>
