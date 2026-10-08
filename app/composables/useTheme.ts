/**
 * Color theme: follows the system by default, or a user choice kept in a
 * cookie. Applied as data-theme on <html> during SSR, so there is no flash.
 */
export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_COOKIE = 'trackarr_theme';

const THEMES: readonly string[] = ['system', 'light', 'dark'];

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && THEMES.includes(value);
}

export function useTheme() {
  const cookie = useCookie<string>(THEME_COOKIE, {
    default: () => 'system',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
  });
  // A stale or edited cookie falls back to the system theme
  const preference = computed<ThemePreference>({
    get: () => (isThemePreference(cookie.value) ? cookie.value : 'system'),
    set: (value) => (cookie.value = value),
  });

  function setTheme(value: ThemePreference) {
    preference.value = value;
  }

  return { preference, setTheme };
}

/**
 * Call once from the root layout/app to bind the preference to <html>
 */
export function useThemeAttribute() {
  const { preference } = useTheme();
  useHead({
    htmlAttrs: {
      'data-theme': computed(() =>
        preference.value === 'system' ? undefined : preference.value
      ),
    },
  });
}
