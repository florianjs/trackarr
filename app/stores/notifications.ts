export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  duration?: number;
  createdAt: Date;
}

export const useNotificationStore = defineStore('notifications', () => {
  const notifications = ref<Notification[]>([]);

  const unreadCount = computed(() => notifications.value.length);

  function add(notification: Omit<Notification, 'id' | 'createdAt'>) {
    const id = crypto.randomUUID();
    const newNotification: Notification = {
      ...notification,
      id,
      createdAt: new Date(),
    };

    notifications.value.push(newNotification);

    // Auto-remove after duration (default 5s)
    const duration = notification.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        remove(id);
      }, duration);
    }

    return id;
  }

  function remove(id: string) {
    const index = notifications.value.findIndex((n) => n.id === id);
    if (index !== -1) {
      notifications.value.splice(index, 1);
    }
  }

  function clear() {
    notifications.value = [];
  }

  // Convenience methods
  function success(title: string, message?: string) {
    return add({ type: 'success', title, message });
  }

  function error(title: string, message?: string) {
    return add({ type: 'error', title, message, duration: 8000 });
  }

  function warning(title: string, message?: string) {
    return add({ type: 'warning', title, message });
  }

  function info(title: string, message?: string) {
    return add({ type: 'info', title, message });
  }

  return {
    notifications,
    unreadCount,
    add,
    remove,
    clear,
    success,
    error,
    warning,
    info,
  };
});
