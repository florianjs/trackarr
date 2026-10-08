<template>
  <label class="inline-flex items-center gap-1.5 text-text-muted">
    <Icon name="ph:translate" class="text-base" />
    <span class="sr-only">{{ t('common.language') }}</span>
    <select
      :value="locale"
      class="bg-transparent text-[10px] font-mono uppercase tracking-widest focus:outline-none cursor-pointer hover:text-white transition-colors"
      @change="setLocale(($event.target as HTMLSelectElement).value as typeof locale)"
    >
      <option v-for="l in locales" :key="l.code" :value="l.code" class="bg-bg-secondary">
        {{ l.name }}
      </option>
    </select>
  </label>
</template>

<script setup lang="ts">
const { t, locale, locales, setLocale } = useI18n();
</script>
