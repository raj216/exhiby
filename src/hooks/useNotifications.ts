import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();

  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user) return { notifications: [], unreadCount: 0 };

      const { data, error } = await supabase
        .from("notifications")
        .select("id, user_id, type, title, message, link, is_read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching notifications:", error);
        return { notifications: [], unreadCount: 0 };
      }

      const notifications = (data || []) as Notification[];
      const unreadCount = notifications.filter((n) => !n.is_read).length;

      return { notifications, unreadCount };
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });

  const markAsRead = async (notificationId: string) => {
    if (!user) return;

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("user_id", user.id);

    refetch();
  };

  const markAllAsRead = async () => {
    if (!user || (data?.unreadCount ?? 0) === 0) return;

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    refetch();
  };

  return {
    notifications: data?.notifications ?? [],
    loading,
    unreadCount: data?.unreadCount ?? 0,
    markAsRead,
    markAllAsRead,
    refetch,
  };
}
