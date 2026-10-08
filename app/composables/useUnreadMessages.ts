/**
 * Number of conversations with unread messages, shared by the sidebar badge
 * and the messages page (which refreshes it after reading).
 */
export function useUnreadMessages() {
  const count = useState<number>('unread-messages', () => 0);

  async function refresh() {
    const res = await $fetch<{ count: number }>('/api/messages/unread').catch(() => null);
    if (res) count.value = res.count;
  }

  return { count, refresh };
}
