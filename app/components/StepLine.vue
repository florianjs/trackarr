<template>
  <div class="flex items-center gap-3">
    <Icon :name="icon" class="shrink-0" :class="[iconClass, state === 'running' ? 'animate-spin' : '']" />
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between gap-3">
        <span :class="state === 'skipped' ? 'text-text-muted' : 'text-text-primary'">{{ label }}</span>
        <span v-if="detail" class="text-xs text-text-muted truncate">{{ detail }}</span>
      </div>
      <div v-if="progress !== undefined && state === 'running'" class="mt-1 w-full bg-bg-tertiary rounded-full h-1">
        <div class="bg-text-primary h-1 rounded-full transition-all" :style="{ width: `${progress}%` }" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/** One line of a multi-step task: icon for its state, optional detail and progress */
const props = defineProps<{
  label: string;
  state: 'idle' | 'running' | 'done' | 'skipped' | 'error';
  detail?: string;
  progress?: number;
}>();

const icon = computed(
  () =>
    ({
      idle: 'ph:circle',
      running: 'ph:spinner',
      done: 'ph:check-circle',
      skipped: 'ph:minus-circle',
      error: 'ph:warning-circle',
    })[props.state]
);

const iconClass = computed(
  () =>
    ({
      idle: 'text-text-muted',
      running: 'text-text-primary',
      done: 'text-success',
      skipped: 'text-text-muted',
      error: 'text-red-400',
    })[props.state]
);
</script>
