<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div class="card p-6">
      <h3 class="text-lg font-bold mb-4">{{ t('mod.dashboard.pendingReports') }}</h3>
      <p class="text-sm text-text-muted">
        {{ t('mod.dashboard.pendingReportsHint') }}
      </p>
      <NuxtLink to="/mod/reports" class="btn btn-primary mt-4 inline-block"
        >{{ t('mod.dashboard.viewReports') }}</NuxtLink
      >
    </div>
    <div class="card p-6">
      <h3 class="text-lg font-bold mb-4">{{ t('mod.dashboard.recentHnr') }}</h3>
      <p class="text-sm text-text-muted">
        {{ t('mod.dashboard.recentHnrHint') }}
      </p>
      <NuxtLink to="/mod/hnr" class="btn btn-primary mt-4 inline-block"
        >{{ t('mod.dashboard.viewHnr') }}</NuxtLink
      >
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n();
</script>
