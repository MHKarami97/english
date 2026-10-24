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

const props = defineProps<{
  word: Word;
  flipped: boolean;
  swipeable: boolean;
  audioFailed: boolean;
}>();
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
  drag.value.dataset.swipe =
    deltaX > SWIPE_HINT_DISTANCE ? 'known' : deltaX < -SWIPE_HINT_DISTANCE ? 'unknown' : '';
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
    class="stage mx-auto w-full max-w-full overflow-hidden"
    tabindex="-1"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="endDrag(true)"
    @pointercancel="endDrag(false)"
    @click="onStageClick"
  >
    <div ref="drag" class="drag w-full">
      <div class="flip w-full" :data-flipped="flipped">
        <div
          class="face face-front w-full items-center justify-center overflow-x-hidden text-center"
          :inert="flipped"
        >
          <MediaImage
            class="w-full max-w-full rounded-lg"
            :src="container.media.wordImage(word)"
            :width="4"
            :height="3"
            eager
          />
          <p class="headword max-w-full overflow-wrap-anywhere" lang="en" dir="ltr">
            {{ word.word }}
          </p>
          <button
            type="button"
            class="btn max-w-full"
            :disabled="!hasAudio"
            @click.stop="emit('play')"
          >
            <Volume2 class="size-5 shrink-0" aria-hidden="true" />
            <i18n-t keypath="word.play" tag="span" scope="global" class="min-w-0">
              <template #word
                ><bdi lang="en" dir="ltr" class="max-w-full truncate">{{
                  word.word
                }}</bdi></template
              >
            </i18n-t>
          </button>
          <p v-if="audioFailed" class="text-sm text-muted" role="status">
            {{ t('word.audioOffline') }}
          </p>
        </div>
        <div class="face face-back w-full overflow-x-hidden">
          <div
            class="flex w-full min-w-0 flex-wrap items-baseline gap-x-3 text-start"
            lang="en"
            dir="ltr"
          >
            <p class="headword !text-4xl min-w-0 break-words">{{ word.word }}</p>
            <p v-if="word.pos" class="text-muted italic">{{ word.pos }}</p>
          </div>
          <p
            v-if="word.ipa"
            class="ipa min-w-0 overflow-wrap-anywhere text-start"
            lang="en"
            dir="ltr"
          >
            {{ word.ipa }}
          </p>
          <p class="text-lead min-w-0 overflow-wrap-anywhere text-start" lang="en" dir="ltr">
            {{ word.definition }}
          </p>
          <div lang="en" dir="ltr" class="min-w-0 text-start">
            <ExampleSentence
              class="border-s-2 border-line ps-4 text-lead"
              :segments="word.exampleSegments"
            />
          </div>
          <button
            type="button"
            class="btn mt-auto max-w-full self-start"
            :disabled="!hasAudio"
            @click.stop="emit('play')"
          >
            <Volume2 class="size-5 shrink-0" aria-hidden="true" />
            <i18n-t keypath="word.play" tag="span" scope="global" class="min-w-0">
              <template #word
                ><bdi lang="en" dir="ltr" class="max-w-full truncate">{{
                  word.word
                }}</bdi></template
              >
            </i18n-t>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
