<template>
  <div class="space-y-2">
    <label
      class="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-1"
      >External IDs (optional)</label
    >
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <input
        v-model="model.imdbId"
        type="text"
        class="input w-full !py-2 text-xs font-mono"
        placeholder="IMDb (tt0133093 or URL)"
        aria-label="IMDb ID"
      />
      <input
        v-model="model.tmdbId"
        type="text"
        inputmode="numeric"
        class="input w-full !py-2 text-xs font-mono"
        placeholder="TMDb (603 or URL)"
        aria-label="TMDb ID"
      />
      <input
        v-model="model.tvdbId"
        type="text"
        inputmode="numeric"
        class="input w-full !py-2 text-xs font-mono"
        placeholder="TheTVDB (81189)"
        aria-label="TheTVDB ID"
      />
    </div>
    <p class="text-[10px] text-text-muted ml-1">
      Used by Sonarr / Radarr to match releases. Paste an ID or the page URL.
    </p>
  </div>
</template>

<script setup lang="ts">
export interface MediaIdsModel {
  imdbId: string;
  tmdbId: string;
  tvdbId: string;
}

const model = defineModel<MediaIdsModel>({ required: true });
</script>
