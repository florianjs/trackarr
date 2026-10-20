<template>
  <div>
    <SettingsGroup :label="t('appearance.login.layout')" :description="t('appearance.login.layoutHint')">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          v-for="layout in LOGIN_LAYOUTS"
          :key="layout"
          type="button"
          class="text-left rounded-lg border p-2 transition-colors"
          :class="model.login.layout === layout ? 'border-free ring-2 ring-free/30' : 'border-border hover:border-border-hover'"
          :aria-pressed="model.login.layout === layout"
          @click="model = { ...model, login: { ...model.login, layout } }"
        >
          <!-- Schematic of the design -->
          <div class="h-20 rounded border border-border bg-bg-primary overflow-hidden flex" aria-hidden="true">
            <template v-if="layout === 'split'">
              <div class="w-1/2 bg-free/60"></div>
              <div class="w-1/2 flex items-center justify-center"><div class="w-8 h-10 rounded-sm bg-bg-tertiary border border-border"></div></div>
            </template>
            <div v-else-if="layout === 'background'" class="w-full flex items-center justify-center bg-gradient-to-br from-free/60 to-scrim/40">
              <div class="w-10 h-12 rounded-sm bg-bg-secondary/90 border border-border"></div>
            </div>
            <div v-else-if="layout === 'minimal'" class="w-full p-2 flex flex-col">
              <div class="w-6 h-1 bg-text-muted/50 rounded-full"></div>
              <div class="flex-1 flex flex-col justify-center gap-1 pl-6">
                <div class="w-10 h-1.5 bg-text-primary/70 rounded-full"></div>
                <div class="w-14 h-1 bg-border rounded-full"></div>
                <div class="w-14 h-1 bg-border rounded-full"></div>
              </div>
            </div>
            <div v-else class="w-full flex flex-col items-center justify-center gap-1">
              <div class="w-4 h-4 rounded-sm bg-white"></div>
              <div class="w-12 h-1 bg-border rounded-full"></div>
              <div class="w-12 h-1 bg-border rounded-full"></div>
            </div>
          </div>
          <p class="text-sm font-medium mt-2">{{ t(`appearance.login.layouts.${layout}`) }}</p>
          <p class="text-xs text-text-muted">{{ t(`appearance.login.layouts.${layout}Hint`) }}</p>
        </button>
      </div>
      <p v-if="needsImage" class="text-xs text-text-muted mt-3 flex items-center gap-1.5">
        <Icon name="ph:info" />{{ t('appearance.login.imageHint') }}
      </p>
    </SettingsGroup>

    <SettingsGroup :label="t('appearance.login.preview')">
      <!-- Rendered at twice the size, scaled down: the real page, not a mockup -->
      <div class="h-[400px] rounded-lg border border-border overflow-hidden pointer-events-none select-none" inert>
        <div class="origin-top-left scale-50 w-[200%] h-[800px]">
          <AuthShell :layout="model.login.layout" :image="model.login.image" contained>
            <div class="space-y-4">
              <div class="h-9 rounded bg-bg-tertiary border border-border"></div>
              <div class="h-9 rounded bg-bg-tertiary border border-border"></div>
              <div class="h-10 rounded bg-white"></div>
            </div>
          </AuthShell>
        </div>
      </div>
    </SettingsGroup>
  </div>
</template>

<script setup lang="ts">
import { LOGIN_LAYOUTS, type Appearance } from '~~/shared/utils/appearance';

const model = defineModel<Appearance>({ required: true });
const { t } = useI18n();

const needsImage = computed(
  () => (model.value.login.layout === 'split' || model.value.login.layout === 'background') && !model.value.login.image
);
</script>
