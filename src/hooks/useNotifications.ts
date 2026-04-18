import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
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
  const queryClient = useQueryClient();

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
      if (error) return { notifications: [], unreadCount: 0 };
      const notifications = (data || []) as Notification[];
      return { notifications, unreadCount: notifications.filter((n) => !n.is_read).length };
    },
    enabled: !!user,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-realtime-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["notifications", user.id] }))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["notifications", user.id] }))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["notifications", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const markAsRead = async (notificationId: string) => {
    if (!user) return;
    queryClient.setQueryData(["notifications", user.id], (old: any) => {
      if (!old) return old;
      const notifications = old.notifications.map((n: Notification) =>
        n.id === notificationId ? { ...n, is_read: true } : n);
      return { notifications, unreadCount: notifications.filter((n: Notification) => !n.is_read).length };
    });
    await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId).eq("user_id", user.id);
  };

  const markAllAsRead = async () => {
    if (!user || (data?.unreadCount ?? 0) === 0) return;
    queryClient.setQueryData(["notifications", user.id], (old: any) => {
      if (!old) return old;
      return { notifications: old.notifications.map((n: Notification) => ({ ...n, is_read: true })), unreadCount: 0 };
    });
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
  };

  return { notifications: data?.notifications ?? [], loading, unreadCount: data?.unreadCount ?? 0, markAsRead, markAllAsRead, refetch };
}
