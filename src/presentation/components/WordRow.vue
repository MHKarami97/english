<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Circle, CircleCheck, CircleHelp, Star, Volume2 } from '@lucide/vue';
import { container } from '@/container';
import type { UserWordState, Word } from '@/domain/entities';
import { useAudio } from '@/presentation/composables/useAudio';
import MediaImage from './MediaImage.vue';

const props = defineProps<{ word: Word; state: UserWordState | null }>();
const emit = defineEmits<{ open: [word: Word]; play: [word: Word]; favorite: [word: Word]; knowledge: [word: Word] }>();

const { t } = useI18n();
const audio = useAudio();
const audioUrl = computed(() => container.media.audio(props.word));
const knowledge = computed(() => props.state?.knowledge ?? 'new');
const isFavorite = computed(() => props.state?.isFavorite === true);
const playing = computed(() => audioUrl.value !== null && audio.state.value.url === audioUrl.value && audio.state.value.status === 'playing');
const audioFailed = computed(() => audioUrl.value !== null && audio.state.value.url === audioUrl.value && audio.state.value.status === 'error');
const knowledgeIcon = computed(() => ({ known: CircleCheck, unknown: CircleHelp, new: Circle })[knowledge.value]);
const knowledgeLabel = computed(() => t(`word.${knowledge.value}`));
const playLabel = computed(() => t('word.play', { word: props.word.word }));
const favoriteLabel = computed(() =>
  isFavorite.value ? t('word.removeFavorite', { word: props.word.word }) : t('word.addFavorite', { word: props.word.word }),
);
</script>

<template>
  <div class="flex h-[72px] items-center gap-2 ps-3 pe-1">
    <button type="button" class="flex min-w-0 flex-1 items-center gap-3 text-start" @click="emit('open', word)">
      <MediaImage class="size-12 shrink-0 rounded-md" :src="container.media.wordImage(word)" :width="48" :height="48" />
      <span class="min-w-0">
        <span class="block truncate font-display text-lg font-semibold"><bdi lang="en" dir="ltr">{{ word.word }}</bdi></span>
        <span class="block truncate text-sm text-muted">
          <template v-if="audioFailed">{{ t('word.audioOffline') }}</template>
          <template v-else><bdi lang="en" dir="ltr">{{ word.pos }}</bdi></template>
        </span>
      </span>
    </button>
    <button type="button" class="icon-btn" :class="{ 'text-accent': playing }" :aria-label="playLabel" :disabled="!audioUrl" @click="emit('play', word)">
      <Volume2 class="size-5" aria-hidden="true" />
    </button>
    <button type="button" class="icon-btn" :aria-pressed="isFavorite" :aria-label="favoriteLabel" @click="emit('favorite', word)">
      <Star class="size-5" :fill="isFavorite ? 'currentColor' : 'none'" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="icon-btn"
      :class="{ 'text-known': knowledge === 'known', 'text-unknown': knowledge === 'unknown' }"
      :aria-label="knowledgeLabel"
      @click="emit('knowledge', word)"
    >
      <component :is="knowledgeIcon" class="size-5" aria-hidden="true" />
    </button>
  </div>
</template>
