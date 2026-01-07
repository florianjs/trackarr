<template>
  <Teleport to="body">
    <div
      class="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
    >
      <TransitionGroup name="notification">
        <div
          v-for="notification in notifications"
          :key="notification.id"
          class="pointer-events-auto max-w-sm animate-in slide-in-from-right duration-200"
        >
          <div
            class="card !p-4 flex items-start gap-3 shadow-lg border"
            :class="borderClass(notification.type)"
          >
            <Icon
              :name="iconName(notification.type)"
              class="w-5 h-5 shrink-0 mt-0.5"
              :class="iconClass(notification.type)"
            />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-text-primary">
                {{ notification.title }}
              </p>
              <p
                v-if="notification.message"
                class="text-xs text-text-muted mt-0.5"
              >
                {{ notification.message }}
              </p>
            </div>
            <button
              class="shrink-0 text-text-muted hover:text-white transition-colors"
              @click="notificationStore.remove(notification.id)"
            >
              <Icon name="ph:x-bold" class="w-4 h-4" />
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const notificationStore = useNotificationStore();
const { notifications } = storeToRefs(notificationStore);

function iconName(type: string) {
  switch (type) {
    case 'success':
      return 'ph:check-circle-bold';
    case 'error':
      return 'ph:x-circle-bold';
    case 'warning':
      return 'ph:warning-bold';
    default:
      return 'ph:info-bold';
  }
}

function iconClass(type: string) {
  switch (type) {
    case 'success':
      return 'text-green-400';
    case 'error':
      return 'text-red-400';
    case 'warning':
      return 'text-yellow-400';
    default:
      return 'text-blue-400';
  }
}

function borderClass(type: string) {
  switch (type) {
    case 'success':
      return 'border-green-500/30';
    case 'error':
      return 'border-red-500/30';
    case 'warning':
      return 'border-yellow-500/30';
    default:
      return 'border-blue-500/30';
  }
}
</script>

<style scoped>
.notification-enter-active,
.notification-leave-active {
  transition: all 0.2s ease;
}
.notification-enter-from {
  opacity: 0;
  transform: translateX(100%);
}
.notification-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
