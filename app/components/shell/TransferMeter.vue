<template>
  <!--
    The one expressive element of the shell: upload vs download as a split
    bar in the seed/leech colors, with the ratio. Turns violet while a global
    freeleech is on (downloads do not count).
  -->
  <div class="flex items-center gap-3" :aria-label="t('shell.meter.label')" role="group">
    <div class="hidden md:flex flex-col gap-1 w-40">
      <div class="flex justify-between text-2xs num leading-none">
        <span class="text-seed" :title="t('shell.meter.uploaded')">
          <Icon name="ph:arrow-up" class="inline-block align-[-1px]" aria-hidden="true" /> {{ formatSize(uploaded) }}
        </span>
        <span :class="freeleech ? 'text-free' : 'text-leech'" :title="t('shell.meter.downloaded')">
          {{ formatSize(downloaded) }} <Icon name="ph:arrow-down" class="inline-block align-[-1px]" aria-hidden="true" />
        </span>
      </div>
      <div class="h-1 rounded-full overflow-hidden flex bg-bg-hover" aria-hidden="true">
        <template v-if="uploaded + downloaded > 0">
          <span class="bg-seed" :style="{ width: `${upShare}%` }" />
          <span :class="freeleech ? 'bg-free' : 'bg-leech'" class="flex-1" />
        </template>
      </div>
    </div>
    <div class="flex items-baseline gap-1.5 leading-none" :title="t('shell.meter.ratio')">
      <span class="text-2xs text-text-muted">{{ t('shell.meter.ratio') }}</span>
      <span class="num text-sm font-medium" :class="ratioClass">{{ ratioLabel }}</span>
    </div>
    <button
      type="button"
      class="p-1 rounded btn-ghost"
      :title="t('shell.meter.refresh')"
      :aria-label="t('shell.meter.refresh')"
      @click="emit('refresh')"
    >
      <Icon name="ph:arrows-clockwise" class="block text-sm" />
    </button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ uploaded: number; downloaded: number; freeleech: boolean }>();
const emit = defineEmits<{ refresh: [] }>();
const { t } = useI18n();

const upShare = computed(() => {
  const total = props.uploaded + props.downloaded;
  return total > 0 ? Math.round((props.uploaded / total) * 100) : 50;
});

const ratio = computed(() =>
  props.downloaded === 0 ? (props.uploaded > 0 ? Infinity : 0) : props.uploaded / props.downloaded
);

const ratioLabel = computed(() =>
  ratio.value === Infinity ? '∞' : ratio.value.toFixed(2)
);

const ratioClass = computed(() => {
  if (props.uploaded === 0 && props.downloaded === 0) return 'text-text-secondary';
  if (ratio.value < 0.5) return 'text-danger';
  if (ratio.value < 1) return 'text-leech';
  return 'text-seed';
});
</script>
