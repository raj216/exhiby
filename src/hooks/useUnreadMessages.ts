import { useMemo } from "react";
import { useConversations } from "./useConversations";

export function useUnreadMessages() {
  const { conversations, isLoading } = useConversations();

  const totalUnread = useMemo(() => {
    return conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
  }, [conversations]);

  const hasUnread = totalUnread > 0;

  return {
    totalUnread,
    hasUnread,
    isLoading,
  };
}
