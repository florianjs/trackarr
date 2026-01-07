import type { User } from '#auth-utils';

export const useUserStore = defineStore('user', () => {
  const { user, loggedIn, fetch: fetchSession, clear } = useUserSession();

  const isAuthenticated = computed(() => loggedIn.value);

  const ratio = computed(() => {
    if (!user.value) return 0;
    if (user.value.downloaded === 0)
      return user.value.uploaded > 0 ? Infinity : 1;
    return user.value.uploaded / user.value.downloaded;
  });

  const ratioFormatted = computed(() => {
    const r = ratio.value;
    if (r === Infinity) return '∞';
    if (r === 0) return '0.00';
    return r.toFixed(2);
  });

  const ratioClass = computed(() => {
    const r = ratio.value;
    if (r === Infinity || r >= 2) return 'text-green-400';
    if (r >= 1) return 'text-white';
    if (r >= 0.5) return 'text-yellow-400';
    return 'text-red-400';
  });

  async function refresh() {
    await fetchSession();
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' });
    await clear();
    navigateTo('/auth/login');
  }

  return {
    user,
    isAuthenticated,
    ratio,
    ratioFormatted,
    ratioClass,
    refresh,
    logout,
  };
});
