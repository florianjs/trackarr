<template>
  <div class="relative group w-full">
    <div
      class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"
    >
      <Icon
        v-if="!loading"
        name="ph:magnifying-glass"
        class="h-5 w-5 text-text-muted group-focus-within:text-white transition-colors"
      />
      <Icon
        v-else
        name="ph:circle-notch"
        class="animate-spin h-5 w-5 text-text-muted"
      />
    </div>
    <input
      ref="inputRef"
      :value="modelValue"
      type="text"
      :placeholder="placeholder"
      class="w-full bg-bg-secondary/50 border border-border text-text-primary placeholder-text-muted focus:outline-none focus:border-white/20 focus:bg-bg-secondary transition-all shadow-2xl"
      :class="[
        size === 'lg'
          ? 'rounded-xl pl-12 pr-24 py-4 text-lg'
          : 'rounded-md pl-10 pr-16 py-2 text-sm',
      ]"
      @input="onInput"
      @keyup.enter="$emit('search')"
    />
    <div class="absolute inset-y-0 right-0 pr-2 flex items-center gap-2">
      <div
        v-if="!modelValue"
        class="hidden sm:flex items-center gap-1 px-2 py-1 border border-border rounded-md text-[10px] text-text-muted font-mono bg-bg-primary/50 mr-2"
      >
        <span>/</span>
      </div>
      <button
        v-if="modelValue"
        class="text-text-muted hover:text-white transition-colors p-2"
        title="Clear"
        @click="clear"
      >
        <Icon name="ph:x" :class="size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5'" />
      </button>
      <button
        class="btn-search"
        :class="size === 'lg' ? 'btn-lg' : 'btn-sm'"
        title="Search"
        @click="$emit('search')"
      >
        <Icon
          name="ph:arrow-right-bold"
          :class="size === 'lg' ? 'h-4 w-4' : 'h-3 w-3'"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.btn-search {
  @apply rounded-lg text-gray-200 transition-all active:scale-95 shadow-lg;
}
.btn-lg {
  @apply p-2.5;
}
.btn-sm {
  @apply p-1.5;
}
</style>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  modelValue: string;
  placeholder?: string;
  loading?: boolean;
  size?: 'sm' | 'lg';
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'search'): void;
}>();

const size = props.size ?? 'sm';
const placeholder = props.placeholder ?? 'Search...';

const inputRef = ref<HTMLInputElement | null>(null);

function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  emit('update:modelValue', value);
}

function clear() {
  emit('update:modelValue', '');
  emit('search');
  inputRef.value?.focus();
}

// Keyboard shortcut '/' to focus
function handleGlobalKeydown(e: KeyboardEvent) {
  if (
    e.key === '/' &&
    document.activeElement?.tagName !== 'INPUT' &&
    document.activeElement?.tagName !== 'TEXTAREA'
  ) {
    e.preventDefault();
    inputRef.value?.focus();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
});
</script>
