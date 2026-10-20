<template>
  <div>
    <SettingsGroup :label="t('appearance.theme.presets')" :description="t('appearance.theme.presetsHint')">
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <button
          v-for="id in PRESET_IDS"
          :key="id"
          type="button"
          class="text-left rounded-lg border p-2 transition-colors"
          :class="model.preset === id ? 'border-free ring-2 ring-free/30' : 'border-border hover:border-border-hover'"
          :aria-pressed="model.preset === id"
          @click="choosePreset(id)"
        >
          <div class="flex h-10 rounded overflow-hidden border border-border">
            <div v-for="mode in modes" :key="mode" class="flex-1 flex items-end gap-1 p-1.5" :style="{ background: swatches(id)[mode].bg }">
              <span class="h-3 w-3 rounded-full" :style="{ background: swatches(id)[mode].ink }"></span>
              <span class="h-3 w-3 rounded-full" :style="{ background: swatches(id)[mode].free }"></span>
              <span class="h-3 w-3 rounded-full" :style="{ background: swatches(id)[mode].seed }"></span>
            </div>
          </div>
          <p class="text-sm font-medium mt-2">{{ t(`appearance.presets.${id}`) }}</p>
        </button>
      </div>
    </SettingsGroup>

    <SettingsGroup :label="t('appearance.theme.colors')" :description="t('appearance.theme.colorsHint')">
      <div class="flex items-center justify-between mb-3">
        <div class="flex gap-1">
          <button
            v-for="mode in modes"
            :key="mode"
            type="button"
            class="px-3 py-1 text-xs rounded border"
            :class="editing === mode ? 'border-free text-text-primary bg-bg-tertiary' : 'border-border text-text-muted'"
            @click="editing = mode"
          >
            <Icon :name="mode === 'light' ? 'ph:sun' : 'ph:moon'" class="mr-1" />{{ t(`appearance.theme.${mode}`) }}
          </button>
        </div>
        <button
          v-if="Object.keys(model.colors[editing]).length"
          type="button"
          class="text-xs text-text-muted hover:text-text-primary underline"
          @click="resetMode"
        >
          {{ t('appearance.theme.resetColors') }}
        </button>
      </div>
      <div v-for="group in TOKEN_GROUPS" :key="group.id" class="mb-4 last:mb-0">
        <p class="text-xs text-text-muted mb-2">{{ t(`appearance.theme.groups.${group.id}`) }}</p>
        <div class="grid sm:grid-cols-2 gap-2">
          <label
            v-for="token in group.tokens"
            :key="token"
            class="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-bg-tertiary/50"
          >
            <input
              type="color"
              :value="palettes[editing][token]"
              class="w-7 h-7 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0"
              @input="setColor(token, ($event.target as HTMLInputElement).value)"
            />
            <span class="text-sm flex-1 min-w-0 truncate">{{ t(`appearance.theme.tokens.${token}`) }}</span>
            <code class="num text-2xs text-text-muted">{{ palettes[editing][token] }}</code>
            <button
              v-if="model.colors[editing][token]"
              type="button"
              class="p-0.5 text-text-muted hover:text-text-primary"
              :title="t('common.reset')"
              :aria-label="t('common.reset')"
              @click.prevent="clearColor(token)"
            >
              <Icon name="ph:arrow-counter-clockwise" class="block" />
            </button>
          </label>
        </div>
      </div>
    </SettingsGroup>

    <SettingsGroup :label="t('appearance.theme.radius')" :description="t('appearance.theme.radiusHint')">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="(value, id) in RADII"
          :key="id"
          type="button"
          class="flex items-center gap-2 px-3 py-2 text-sm border"
          :style="{ borderRadius: value }"
          :class="model.radius === id ? 'border-free bg-bg-tertiary text-text-primary' : 'border-border text-text-muted hover:text-text-primary'"
          @click="model = { ...model, radius: id }"
        >
          {{ t(`appearance.theme.radii.${id}`) }}
        </button>
      </div>
    </SettingsGroup>
  </div>
</template>

<script setup lang="ts">
import {
  PRESET_IDS,
  RADII,
  resolvePalettes,
  DEFAULT_APPEARANCE,
  type Appearance,
  type ThemeToken,
} from '~~/shared/utils/appearance';

const model = defineModel<Appearance>({ required: true });
const { t } = useI18n();

const modes = ['light', 'dark'] as const;
const editing = ref<(typeof modes)[number]>('light');

const TOKEN_GROUPS: { id: string; tokens: ThemeToken[] }[] = [
  { id: 'surfaces', tokens: ['bg', 'surface', 'raised', 'hover', 'line', 'line-strong'] },
  { id: 'text', tokens: ['ink', 'ink-2', 'ink-3', 'contrast', 'contrast-inv'] },
  { id: 'meaning', tokens: ['free', 'seed', 'leech', 'danger'] },
];

const palettes = computed(() => resolvePalettes(model.value));

// Preset colours alone, for the preset cards
function swatches(preset: string) {
  return resolvePalettes({ ...DEFAULT_APPEARANCE, preset });
}

// A preset replaces the colours picked by hand
function choosePreset(preset: string) {
  model.value = { ...model.value, preset, colors: { light: {}, dark: {} } };
}

function setColor(token: ThemeToken, value: string) {
  const mode = editing.value;
  model.value = {
    ...model.value,
    colors: { ...model.value.colors, [mode]: { ...model.value.colors[mode], [token]: value.toLowerCase() } },
  };
}

function clearColor(token: ThemeToken) {
  const mode = editing.value;
  const { [token]: _removed, ...rest } = model.value.colors[mode];
  model.value = { ...model.value, colors: { ...model.value.colors, [mode]: rest } };
}

function resetMode() {
  model.value = { ...model.value, colors: { ...model.value.colors, [editing.value]: {} } };
}
</script>
