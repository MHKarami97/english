<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Volume2 } from '@lucide/vue';
import { container } from '@/container';
import type { Word } from '@/domain/entities';
import ExampleSentence from './ExampleSentence.vue';
import MediaImage from './MediaImage.vue';

const SWIPE_DISTANCE = 80;
const SWIPE_HINT_DISTANCE = 40;

const props = defineProps<{ word: Word; flipped: boolean; swipeable: boolean; audioFailed: boolean }>();
const emit = defineEmits<{ flip: []; play: []; swipe: [direction: 'known' | 'unknown'] }>();
const { t } = useI18n();

const stage = ref<HTMLElement | null>(null);
const drag = ref<HTMLElement | null>(null);
const hasAudio = computed(() => container.media.audio(props.word) !== null);

let startX = 0;
let startY = 0;
let deltaX = 0;
let tracking = false;
let suppressClick = false;

function onPointerDown(event: PointerEvent): void {
  if (!props.swipeable || event.pointerType === 'mouse') return;
  tracking = true;
  suppressClick = false;
  startX = event.clientX;
  startY = event.clientY;
  deltaX = 0;
}

function onPointerMove(event: PointerEvent): void {
  if (!tracking || !drag.value) return;
  deltaX = event.clientX - startX;
  if (Math.abs(event.clientY - startY) > Math.abs(deltaX)) return;
  drag.value.style.transition = 'none';
  drag.value.style.transform = `translateX(${deltaX}px)`;
  drag.value.dataset.swipe = deltaX > SWIPE_HINT_DISTANCE ? 'known' : deltaX < -SWIPE_HINT_DISTANCE ? 'unknown' : '';
}

function endDrag(commit: boolean): void {
  if (!tracking) return;
  tracking = false;
  if (drag.value) {
    drag.value.style.transition = '';
    drag.value.style.transform = '';
    drag.value.dataset.swipe = '';
  }
  if (Math.abs(deltaX) > 10) suppressClick = true;
  if (commit && Math.abs(deltaX) >= SWIPE_DISTANCE) emit('swipe', deltaX > 0 ? 'known' : 'unknown');
}

function onStageClick(): void {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  emit('flip');
}

defineExpose({ focus: () => stage.value?.focus() });
</script>

<template>
  <div
    ref="stage"
    class="stage"
    tabindex="-1"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="endDrag(true)"
    @pointercancel="endDrag(false)"
    @click="onStageClick"
  >
    <div ref="drag" class="drag">
      <div class="flip" :data-flipped="flipped">
        <div class="face face-front items-center justify-center text-center" v-bind="flipped ? { inert: '' } : {}">
          <MediaImage class="w-full max-w-xs rounded-lg" :src="container.media.wordImage(word)" :width="4" :height="3" eager />
          <p class="headword" lang="en" dir="ltr">{{ word.word }}</p>
          <button type="button" class="btn" :disabled="!hasAudio" @click.stop="emit('play')">
            <Volume2 class="size-5" aria-hidden="true" />
            <i18n-t keypath="word.play" tag="span" scope="global">
              <template #word><bdi lang="en" dir="ltr">{{ word.word }}</bdi></template>
            </i18n-t>
          </button>
          <p v-if="audioFailed" class="text-sm text-muted" role="status">{{ t('word.audioOffline') }}</p>
        </div>
        <div class="face face-back" v-bind="flipped ? {} : { inert: '' }">
          <div class="flex flex-wrap items-baseline gap-x-3 text-start" lang="en" dir="ltr">
            <p class="headword !text-4xl">{{ word.word }}</p>
            <p v-if="word.pos" class="text-muted italic">{{ word.pos }}</p>
          </div>
          <p v-if="word.ipa" class="ipa text-start" lang="en" dir="ltr">{{ word.ipa }}</p>
          <p class="text-lead text-start" lang="en" dir="ltr">{{ word.definition }}</p>
          <div lang="en" dir="ltr" class="text-start">
            <ExampleSentence class="border-s-2 border-line ps-4 text-lead" :segments="word.exampleSegments" />
          </div>
          <button type="button" class="btn mt-auto self-start" :disabled="!hasAudio" @click.stop="emit('play')">
            <Volume2 class="size-5" aria-hidden="true" />
            <i18n-t keypath="word.play" tag="span" scope="global">
              <template #word><bdi lang="en" dir="ltr">{{ word.word }}</bdi></template>
            </i18n-t>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
