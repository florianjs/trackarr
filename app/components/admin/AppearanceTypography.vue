<template>
  <div>
    <SettingsGroup
      v-for="slot in slots"
      :key="slot.id"
      :label="t(`appearance.typography.${slot.id}`)"
      :description="t(`appearance.typography.${slot.id}Hint`)"
    >
      <div class="grid sm:grid-cols-2 gap-2">
        <button
          v-for="(stack, id) in slot.fonts"
          :key="id"
          type="button"
          class="text-left px-3 py-2.5 rounded border transition-colors"
          :class="model.fonts[slot.id] === id ? 'border-free bg-bg-tertiary' : 'border-border hover:border-border-hover'"
          :aria-pressed="model.fonts[slot.id] === id"
          @click="choose(slot.id, String(id))"
        >
          <span class="block text-xs text-text-muted">{{ t(`appearance.fonts.${slot.id === 'mono' ? 'mono' : 'sans'}.${id}`) }}</span>
          <span class="block text-lg text-text-primary truncate" :style="{ fontFamily: stack }">
            {{ slot.id === 'mono' ? '0123 ↑ 4.2 GB · 1.87' : t('appearance.typography.sample') }}
          </span>
        </button>
      </div>
    </SettingsGroup>
  </div>
</template>

<script setup lang="ts">
import { MONO_FONTS, SANS_FONTS, type Appearance } from '~~/shared/utils/appearance';

const model = defineModel<Appearance>({ required: true });
const { t } = useI18n();

type FontSlot = keyof Appearance['fonts'];
const slots: { id: FontSlot; fonts: Record<string, string> }[] = [
  { id: 'sans', fonts: SANS_FONTS },
  { id: 'heading', fonts: SANS_FONTS },
  { id: 'mono', fonts: MONO_FONTS },
];

function choose(slot: FontSlot, id: string) {
  model.value = { ...model.value, fonts: { ...model.value.fonts, [slot]: id } as Appearance['fonts'] };
}
</script>
