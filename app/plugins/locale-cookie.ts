/**
 * Locale selection: English by default, never guessed from the browser.
 * The language a user picks is stored in a cookie and restored on every
 * request (server side too, so pages render in the right language).
 */
export const LOCALE_COOKIE = 'trackarr_locale';

export default defineNuxtPlugin({
  name: 'trackarr:locale-cookie',
  dependsOn: ['i18n:plugin'],
  async setup(nuxtApp) {
    const i18n = nuxtApp.$i18n;
    const cookie = useCookie<string | null>(LOCALE_COOKIE, {
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      path: '/',
    });

    const available = i18n.availableLocales as string[];
    if (cookie.value && available.includes(cookie.value) && cookie.value !== i18n.locale.value) {
      await i18n.setLocale(cookie.value as typeof i18n.locale.value);
    }

    nuxtApp.hook('i18n:localeSwitched', ({ newLocale }) => {
      cookie.value = newLocale;
    });
  },
});
