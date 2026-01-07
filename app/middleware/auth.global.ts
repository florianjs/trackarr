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

  // Fetch auth status to check if setup is needed and update session with fresh DB data
  // Use $fetch to bypass caching and ensure we always get fresh data
  const status = await $fetch('/api/auth/status');

  // Refresh session state to get latest stats from server
  if (loggedIn.value) {
    await fetchSession();
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
