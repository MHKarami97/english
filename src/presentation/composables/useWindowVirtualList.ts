import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

/** Fixed-height windowing against the page scroll: only integer row changes trigger re-renders. */
export function useWindowVirtualList(count: Ref<number>, rowHeight: number, overscan = 6) {
  const listEl = ref<HTMLElement | null>(null);
  const firstRow = ref(0);
  const viewportRows = ref(0);
  let frame = 0;

  const measure = (): void => {
    frame = 0;
    const top = listEl.value?.getBoundingClientRect().top ?? 0;
    firstRow.value = Math.max(0, Math.floor(-top / rowHeight));
    viewportRows.value = Math.ceil(window.innerHeight / rowHeight) + 1;
  };

  const schedule = (): void => {
    if (frame === 0) frame = requestAnimationFrame(measure);
  };

  onMounted(() => {
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    measure();
  });

  onBeforeUnmount(() => {
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    cancelAnimationFrame(frame);
  });

  const range = computed(() => ({
    start: Math.max(0, firstRow.value - overscan),
    end: Math.min(count.value, firstRow.value + viewportRows.value + overscan),
  }));

  return {
    listEl,
    range,
    offsetY: computed(() => range.value.start * rowHeight),
    totalHeight: computed(() => count.value * rowHeight),
  };
}
