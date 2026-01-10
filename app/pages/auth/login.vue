<template>
  <div class="min-h-screen bg-bg-primary flex items-center justify-center px-4">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div
          class="w-16 h-16 bg-white rounded-lg flex items-center justify-center mx-auto mb-4 overflow-hidden"
        >
          <img
            v-if="branding?.siteLogoImage"
            :src="branding.siteLogoImage"
            alt="Logo"
            class="w-full h-full object-contain"
          />
          <Icon
            v-else
            :name="branding?.siteLogo || 'ph:broadcast-bold'"
            class="text-black text-4xl"
          />
        </div>
        <h1
          class="text-2xl font-bold tracking-tighter"
          v-html="branding?.authTitle || branding?.siteName || 'TRACKARR'"
        ></h1>
        <div
          class="text-text-muted text-sm mt-1 [&>p]:m-0"
          v-html="branding?.authSubtitle || 'Private BitTorrent Tracker'"
        ></div>
      </div>

      <div
        v-if="!status?.registrationOpen && !status?.needsSetup"
        class="mb-6 p-3 bg-blue-500/10 border border-blue-500/20 rounded flex items-start gap-3"
      >
        <Icon name="ph:info" class="text-blue-400 text-lg mt-0.5 shrink-0" />
        <p class="text-blue-400 text-xs leading-relaxed">
          Registrations are currently closed. Only existing members can sign in.
        </p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label
            for="username"
            class="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2"
          >
            Username
          </label>
          <input
            id="username"
            v-model="form.username"
            type="text"
            required
            autocomplete="username"
            class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-white transition-colors"
            placeholder="Enter your username"
          />
        </div>

        <div>
          <label
            for="password"
            class="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2"
          >
            Password
          </label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            required
            autocomplete="current-password"
            class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-white transition-colors"
            placeholder="Enter your password"
          />
        </div>

        <div v-if="error" class="text-red-400 text-sm">
          {{ error }}
        </div>

        <!-- Status indicator for ZKE challenge processing -->
        <div
          v-if="authStatus"
          class="text-text-muted text-xs flex items-center gap-2"
        >
          <Icon name="ph:spinner" class="animate-spin" />
          {{ authStatus }}
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-white text-black font-medium py-2.5 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="loading">Signing in...</span>
          <span v-else>Sign In</span>
        </button>
      </form>

      <div
        v-if="status?.registrationOpen"
        class="mt-6 pt-6 border-t border-border text-center"
      >
        <p class="text-text-muted text-sm">
          Don't have an account?
          <NuxtLink
            to="/auth/register"
            class="text-white hover:underline font-medium"
          >
            Create one
          </NuxtLink>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { generateLoginProof } from '~/utils/crypto';

definePageMeta({
  layout: false,
});

const { fetch: fetchSession } = useUserSession();
const router = useRouter();

const { data: status } = await useFetch('/api/auth/status');
const { data: branding } = await useFetch<{
  siteName: string;
  siteLogo: string;
  siteLogoImage: string | null;
  siteFavicon: string | null;
  authTitle: string | null;
  authSubtitle: string | null;
}>('/api/branding');

// Set dynamic favicon
useHead({
  link: [
    {
      rel: 'icon',
      type: computed(() => {
        const url = branding.value?.siteFavicon;
        if (!url) return 'image/x-icon';
        if (url.endsWith('.svg')) return 'image/svg+xml';
        if (url.endsWith('.png')) return 'image/png';
        if (url.endsWith('.webp')) return 'image/webp';
        return 'image/x-icon';
      }),
      href: computed(() => branding.value?.siteFavicon || '/favicon.ico'),
    },
  ],
});

const form = reactive({
  username: '',
  password: '',
});

const error = ref('');
const loading = ref(false);
const authStatus = ref('');

async function handleLogin() {
  error.value = '';
  loading.value = true;
  authStatus.value = '';

  try {
    // Step 1: Get challenge and salt from server
    authStatus.value = 'Fetching challenge...';
    const challengeData = await $fetch<{ salt: string; challenge: string }>(
      '/api/auth/challenge',
      { query: { username: form.username } }
    );

    // Step 2: Generate ZKE proof client-side
    authStatus.value = 'Generating proof...';
    const proof = await generateLoginProof(
      form.password,
      challengeData.salt,
      challengeData.challenge
    );

    // Step 3: Send proof to server (password never leaves client)
    authStatus.value = 'Authenticating...';
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: {
        username: form.username,
        challenge: challengeData.challenge,
        proof,
      },
    });

    // Refresh session and redirect
    await fetchSession();
    router.push('/');
  } catch (err: any) {
    error.value = err.data?.message || 'Login failed';
  } finally {
    loading.value = false;
    authStatus.value = '';
  }
}
</script>
