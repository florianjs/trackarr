export default defineNuxtRouteMiddleware(() => {
  const { user } = useUserSession();

  if (!user.value?.isAdmin) {
    return navigateTo('/');
  }
});
