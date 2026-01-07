<template>
  <div class="card">
    <div class="card-header">
      <div class="flex items-center gap-2">
        <Icon name="ph:plug-connect" class="text-text-muted" />
        <h3 class="text-xs font-bold uppercase tracking-wider">Protocols</h3>
      </div>
    </div>
    <div class="card-body">
      <div class="space-y-3">
        <div
          v-for="(active, proto) in protocols"
          :key="proto"
          class="flex items-center justify-between"
        >
          <span class="text-xs text-text-secondary font-mono uppercase">{{
            proto
          }}</span>
          <div class="flex items-center gap-2">
            <span
              class="text-[10px] font-bold"
              :class="active ? 'text-success' : 'text-text-muted'"
            >
              {{ active ? 'ACTIVE' : 'INACTIVE' }}
            </span>
            <div
              class="w-1.5 h-1.5 rounded-full"
              :class="
                active
                  ? 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.5)]'
                  : 'bg-bg-tertiary'
              "
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  protocols: Record<string, boolean> | undefined;
}>();
</script>
