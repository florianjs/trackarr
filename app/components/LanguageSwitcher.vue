<template>
  <label class="inline-flex items-center gap-1 rounded border border-border bg-bg-secondary/60 pl-1.5 pr-0.5 py-0.5">
    <Icon name="ph:translate" class="text-sm text-text-muted" aria-hidden="true" />
    <span class="sr-only">{{ t('common.language') }}</span>
    <!-- Native names: members find their language without reading the current one -->
    <select
      class="bg-transparent text-xs text-text-primary py-0.5 pr-1 rounded-sm cursor-pointer focus:outline-none"
      @change="setLocale(($event.target as HTMLSelectElement).value as typeof locale)"
    >
      <!-- :selected on the option: a :value on the select is set before its options exist -->
      <option v-for="l in locales" :key="l.code" :value="l.code" :selected="l.code === locale">{{ l.name }}</option>
    </select>
  </label>
</template>

<script setup lang="ts">
const { t, locale, locales, setLocale } = useI18n();
</script>
