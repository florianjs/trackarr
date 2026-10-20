<template>
  <!-- Split: picture or accent panel on the left, form on the right -->
  <div v-if="layout === 'split'" class="bg-bg-primary lg:grid lg:grid-cols-2" :class="frame">
    <div class="relative hidden lg:block overflow-hidden" :class="{ 'bg-free': !image }">
      <img v-if="image" :src="image" alt="" class="absolute inset-0 w-full h-full object-cover" />
      <div class="absolute inset-0 bg-gradient-to-t from-scrim/70 via-scrim/20 to-transparent"></div>
      <div class="absolute bottom-0 left-0 right-0 p-10 text-paper">
        <h2 class="text-3xl font-semibold tracking-tight" v-html="title"></h2>
        <div class="mt-2 text-paper/80 [&>p]:m-0" v-html="subtitle"></div>
      </div>
    </div>
    <div class="relative flex items-center justify-center px-4 py-12">
      <div class="absolute top-4 right-4"><LanguageSwitcher /></div>
      <div class="w-full max-w-md">
        <AuthShellHeader :branding="branding" :title="title" :subtitle="subtitle" class="lg:hidden" />
        <AuthShellLogo :branding="branding" class="hidden lg:flex mb-8" />
        <slot />
      </div>
    </div>
  </div>

  <!-- Background: full-page picture, form on a translucent card -->
  <div
    v-else-if="layout === 'background'"
    class="relative flex items-center justify-center px-4 py-12 overflow-hidden"
    :class="[frame, image ? 'bg-scrim' : 'bg-gradient-to-br from-free/40 via-bg-primary to-bg-primary']"
  >
    <img v-if="image" :src="image" alt="" class="absolute inset-0 w-full h-full object-cover" />
    <div v-if="image" class="absolute inset-0 bg-scrim/45"></div>
    <div class="absolute top-4 right-4 z-10"><LanguageSwitcher /></div>
    <div class="relative w-full max-w-md bg-bg-secondary/90 backdrop-blur-md border border-border rounded-lg shadow-2xl shadow-scrim/30 p-8">
      <AuthShellHeader :branding="branding" :title="title" :subtitle="subtitle" />
      <slot />
    </div>
  </div>

  <!-- Minimal: no logo tile, left-aligned, narrow column -->
  <div v-else-if="layout === 'minimal'" class="relative bg-bg-primary flex flex-col px-6 py-6" :class="frame">
    <div class="flex items-center justify-between">
      <span class="text-sm font-medium text-text-primary" v-html="branding?.siteName || 'Trackarr'"></span>
      <LanguageSwitcher />
    </div>
    <div class="flex-1 flex items-center justify-center py-12">
      <div class="w-full max-w-sm">
        <h1 class="text-3xl font-semibold tracking-tight" v-html="title"></h1>
        <div class="text-text-muted text-sm mt-1 mb-8 [&>p]:m-0" v-html="subtitle"></div>
        <slot />
      </div>
    </div>
  </div>

  <!-- Centered (default) -->
  <div v-else class="relative bg-bg-primary flex items-center justify-center px-4" :class="frame">
    <div class="absolute top-4 right-4"><LanguageSwitcher /></div>
    <div class="w-full max-w-md">
      <AuthShellHeader :branding="branding" :title="title" :subtitle="subtitle" />
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LoginLayout } from '~~/shared/utils/appearance';
import type { AuthBranding } from '~/utils/authBranding';

/**
 * Frame of the sign-in and sign-up pages, in the design chosen by the admin
 * (Admin → Appearance → Login page). Pages put their form in the slot.
 */
const props = defineProps<{
  layout?: LoginLayout;
  image?: string | null;
  /** Fill the parent instead of the viewport (admin preview) */
  contained?: boolean;
}>();

const { t } = useI18n();
const appearance = useAppearance();
const { data: branding } = await useFetch<AuthBranding>('/api/branding');

// Props let the admin page preview a design before saving it
const layout = computed(() => props.layout ?? appearance.value.login.layout);
const image = computed(() => (props.image !== undefined ? props.image : appearance.value.login.image));
const frame = computed(() => (props.contained ? 'h-full' : 'min-h-screen'));
// Rendered with v-html: branding fields are sanitized rich text from the
// server; the translated fallback is plain text an admin can override, so
// it is escaped
const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const title = computed(() => branding.value?.authTitle || branding.value?.siteName || 'TRACKARR');
const subtitle = computed(() => branding.value?.authSubtitle || escapeHtml(t('auth.defaultSubtitle')));
</script>
