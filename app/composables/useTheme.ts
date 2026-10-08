/**
 * Color theme: follows the system by default, or a user choice kept in a
 * cookie. Applied as data-theme on <html> during SSR, so there is no flash.
 */
export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_COOKIE = 'trackarr_theme';

export function useTheme() {
  const preference = useCookie<ThemePreference>(THEME_COOKIE, {
    default: () => 'system',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
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
