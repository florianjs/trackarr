<template>
  <div class="card">
    <div class="card-header">
      <div class="flex items-center gap-2">
        <Icon name="ph:broadcast-bold" class="text-text-muted" />
        <h3
          class="text-xs font-bold uppercase tracking-wider text-text-primary"
        >
          Endpoints
        </h3>
      </div>
    </div>
    <div class="card-body space-y-4">
      <div>
        <label
          class="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1"
          >HTTP Announce</label
        >
        <div class="flex items-center gap-2 mt-1">
          <code
            class="flex-1 text-[10px] font-mono bg-bg-primary border border-border px-2 py-1.5 rounded text-text-secondary truncate"
          >
            {{ endpoints.http }}
          </code>
          <button
            class="p-1.5 text-text-muted hover:text-white transition-colors"
            @click="copyToClipboard(endpoints.http)"
          >
            <Icon name="ph:copy" />
          </button>
        </div>
      </div>
      <div>
        <label
          class="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1"
          >UDP Announce</label
        >
        <div class="flex items-center gap-2 mt-1">
          <code
            class="flex-1 text-[10px] font-mono bg-bg-primary border border-border px-2 py-1.5 rounded text-text-secondary truncate"
          >
            {{ endpoints.udp }}
          </code>
          <button
            class="p-1.5 text-text-muted hover:text-white transition-colors"
            @click="copyToClipboard(endpoints.udp)"
          >
            <Icon name="ph:copy" />
          </button>
        </div>
      </div>
      <div>
        <label
          class="text-[10px] font-bold text-text-muted uppercase tracking-widest ml-1"
          >WebSocket</label
        >
        <div class="flex items-center gap-2 mt-1">
          <code
            class="flex-1 text-[10px] font-mono bg-bg-primary border border-border px-2 py-1.5 rounded text-text-secondary truncate"
          >
            {{ endpoints.ws }}
          </code>
          <button
            class="p-1.5 text-text-muted hover:text-white transition-colors"
            @click="copyToClipboard(endpoints.ws)"
          >
            <Icon name="ph:copy" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig();

const endpoints = computed(() => ({
  http: config.public.trackerHttpUrl as string,
  udp: config.public.trackerUdpUrl as string,
  ws: config.public.trackerWsUrl as string,
}));

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}
</script>
