export default defineNuxtRouteMiddleware(() => {
  const { user } = useUserSession();

  if (!user.value?.isAdmin && !user.value?.isModerator) {
    return navigateTo('/');
  }
});
