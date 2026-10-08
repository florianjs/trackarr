<template>
  <div
    class="inline-flex items-center gap-1 rounded border border-border bg-bg-secondary/60 p-0.5"
    role="group"
    :aria-label="t('common.language')"
  >
    <Icon name="ph:translate" class="text-sm text-text-muted mx-1" aria-hidden="true" />
    <button
      v-for="l in locales"
      :key="l.code"
      type="button"
      class="px-2 py-0.5 rounded-sm text-[10px] font-bold font-mono uppercase tracking-widest transition-colors"
      :class="l.code === locale ? 'bg-white/10 text-white' : 'text-text-muted hover:text-white'"
      :aria-pressed="l.code === locale"
      :title="l.name"
      @click="setLocale(l.code)"
    >
      {{ l.code }}
    </button>
  </div>
</template>

<script setup lang="ts">
const { t, locale, locales, setLocale } = useI18n();
</script>
