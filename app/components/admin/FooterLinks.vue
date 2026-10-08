<template>
  <div class="card">
    <div class="card-header">
      <div class="flex items-center gap-2">
        <Icon name="ph:link-simple-bold" class="text-text-muted" />
        <h3 class="text-xs font-bold uppercase tracking-wider text-text-primary">
          {{ t('admin.footer.title') }}
        </h3>
      </div>
    </div>
    <div class="card-body space-y-6">
      <!-- Tagline -->
      <div class="space-y-2">
        <p class="text-[10px] font-bold uppercase tracking-widest text-text-muted">
          {{ t('admin.footer.tagline') }}
        </p>
        <p class="text-xs text-text-muted">{{ t('admin.footer.taglineDescription') }}</p>
        <div class="flex flex-wrap gap-2">
          <input
            v-model="tagline"
            type="text"
            maxlength="100"
            class="input flex-1 min-w-[200px] !py-2 text-xs"
            :placeholder="t('layout.p2pProtocol')"
            :disabled="useDefaultTagline"
          />
          <label class="flex items-center gap-2 text-xs text-text-secondary">
            <input v-model="useDefaultTagline" type="checkbox" />
            {{ t('admin.footer.taglineDefault') }}
          </label>
        </div>
      </div>

      <!-- Links -->
      <div class="space-y-2">
        <p class="text-xs text-text-muted">{{ t('admin.footer.description') }}</p>

        <div
          v-for="(link, index) in links"
          :key="index"
          class="flex flex-wrap items-center gap-2 p-2 rounded border border-border bg-bg-tertiary/50"
        >
          <Icon :name="link.icon" class="text-xl text-text-secondary shrink-0 w-6" />
          <select v-model="link.icon" class="input !py-1.5 text-xs w-44" :aria-label="t('admin.footer.icon')">
            <option v-for="icon in FOOTER_ICONS" :key="icon" :value="icon">
              {{ icon.replace('ph:', '').replace('-logo', '') }}
            </option>
          </select>
          <input
            v-model="link.label"
            type="text"
            maxlength="50"
            class="input !py-1.5 text-xs w-36"
            :placeholder="t('admin.footer.label')"
            :aria-label="t('admin.footer.label')"
          />
          <input
            v-model="link.url"
            type="url"
            maxlength="500"
            class="input !py-1.5 text-xs font-mono flex-1 min-w-[200px]"
            placeholder="https://"
            :aria-label="t('admin.footer.url')"
          />
          <div class="flex gap-1 ml-auto">
            <button class="p-1.5 text-text-muted hover:text-white disabled:opacity-30" :title="t('admin.footer.moveUp')" :disabled="index === 0" @click="move(index, -1)">
              <Icon name="ph:arrow-up-bold" />
            </button>
            <button class="p-1.5 text-text-muted hover:text-white disabled:opacity-30" :title="t('admin.footer.moveDown')" :disabled="index === links.length - 1" @click="move(index, 1)">
              <Icon name="ph:arrow-down-bold" />
            </button>
            <button class="p-1.5 text-text-muted hover:text-error" :title="t('admin.footer.remove')" @click="links.splice(index, 1)">
              <Icon name="ph:trash-bold" />
            </button>
          </div>
        </div>

        <p v-if="!links.length" class="text-xs text-text-muted">{{ t('admin.footer.empty') }}</p>

        <div class="flex flex-wrap gap-2">
          <button
            class="btn btn-secondary !py-1.5 !px-3 text-xs"
            :disabled="links.length >= MAX_FOOTER_LINKS"
            :title="links.length >= MAX_FOOTER_LINKS ? t('admin.footer.max', { max: MAX_FOOTER_LINKS }) : undefined"
            @click="links.push({ icon: 'ph:link', label: '', url: 'https://' })"
          >
            <Icon name="ph:plus-bold" class="mr-1" />{{ t('admin.footer.add') }}
          </button>
          <button class="btn btn-secondary !py-1.5 !px-3 text-xs" @click="links = DEFAULT_FOOTER_LINKS.map((l) => ({ ...l }))">
            {{ t('admin.footer.resetLinks') }}
          </button>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button class="btn btn-primary !py-2 text-xs" :disabled="saving" @click="save">
          {{ t('admin.footer.save') }}
        </button>
        <span v-if="saved" class="text-xs text-success">{{ t('admin.footer.saved') }}</span>
        <span v-if="error" class="text-xs text-error">{{ error }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FooterLink } from '~~/shared/utils/footerLinks';

const { t } = useI18n();

const { data } = await useFetch<{ links: FooterLink[]; tagline: string | null }>(
  '/api/admin/footer'
);

const links = ref<FooterLink[]>((data.value?.links ?? DEFAULT_FOOTER_LINKS).map((l) => ({ ...l })));
const useDefaultTagline = ref(data.value?.tagline == null);
const tagline = ref(data.value?.tagline ?? '');
const saving = ref(false);
const saved = ref(false);
const error = ref<string | null>(null);

function move(index: number, delta: number) {
  const [item] = links.value.splice(index, 1);
  links.value.splice(index + delta, 0, item!);
}

async function save() {
  error.value = null;
  if (parseFooterLinks(links.value) === null) {
    error.value = t('admin.footer.invalid');
    return;
  }

  saving.value = true;
  try {
    const res = await $fetch<{ links: FooterLink[]; tagline: string | null }>('/api/admin/footer', {
      method: 'PUT',
      body: {
        links: links.value,
        tagline: useDefaultTagline.value ? null : tagline.value,
      },
    });
    links.value = res.links.map((l) => ({ ...l }));
    // The site footer reads /api/branding
    await refreshNuxtData();
    saved.value = true;
    setTimeout(() => (saved.value = false), 2000);
  } catch (err) {
    error.value = (err as { data?: { message?: string } }).data?.message ?? 'Error';
  } finally {
    saving.value = false;
  }
}
</script>
