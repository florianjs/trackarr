/**
 * Global auth middleware
 * Protects all routes except auth pages
 * Redirects to setup if no users exist
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn, fetch: fetchSession } = useUserSession();

  // Public routes that don't require auth
  const publicRoutes = ['/auth/login', '/auth/register'];
  const isPublicRoute = publicRoutes.includes(to.path);

  // Setup state and fresh session stats come from /api/auth/status. On
  // client-side navigation, skip it once setup is done (it never comes back)
  // unless the last refresh is older than a minute.
  const lastStatus = useState<{ needsSetup: boolean; at: number } | null>(
    'auth-status',
    () => null
  );
  const stale =
    !lastStatus.value ||
    lastStatus.value.needsSetup ||
    Date.now() - lastStatus.value.at > 60_000;

  let status = lastStatus.value;
  if (import.meta.server || stale) {
    const fresh = await $fetch('/api/auth/status');
    status = { needsSetup: Boolean(fresh?.needsSetup), at: Date.now() };
    lastStatus.value = status;

    // Refresh session state to get latest stats from server
    if (loggedIn.value) {
      await fetchSession();
    }
  }

  // If setup is needed, redirect to register (for first admin)
  if (status?.needsSetup) {
    if (to.path !== '/auth/register') {
      return navigateTo('/auth/register');
    }
    return;
  }

  // If not authenticated and trying to access protected route
  if (!loggedIn.value && !isPublicRoute) {
    return navigateTo('/auth/login');
  }

  // If authenticated and trying to access auth pages
  if (loggedIn.value && isPublicRoute) {
    return navigateTo('/');
  }
});
