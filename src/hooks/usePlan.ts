import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PlanTier = "free" | "pro" | "plus";

export interface PlanInfo {
  tier: PlanTier;
  label: string;       // "Free Studio" | "Pro Studio" | "Studio Plus"
  shortLabel: string;  // "FREE" | "PRO" | "PLUS"
  monthlyPrice: number;
  commission: string;
  attendeeLimit: string;
  isProOrAbove: boolean;
}

export const PLAN_META: Record<PlanTier, PlanInfo> = {
  free: {
    tier: "free",
    label: "Free Studio",
    shortLabel: "FREE",
    monthlyPrice: 0,
    commission: "8%",
    attendeeLimit: "50 per session",
    isProOrAbove: false,
  },
  pro: {
    tier: "pro",
    label: "Pro Studio",
    shortLabel: "PRO",
    monthlyPrice: 29,
    commission: "4%",
    attendeeLimit: "Unlimited",
    isProOrAbove: true,
  },
  plus: {
    tier: "plus",
    label: "Studio Plus",
    shortLabel: "PLUS",
    monthlyPrice: 99,
    commission: "4%",
    attendeeLimit: "Unlimited",
    isProOrAbove: true,
  },
};

export function usePlan() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: tier = "free", isLoading } = useQuery<PlanTier>({
    queryKey: ["plan", user?.id],
    queryFn: async (): Promise<PlanTier> => {
      if (!user) return "free";

      // SECURITY: Always read plan from server-side profiles table.
      // Never trust user_metadata — clients can self-edit it via auth.updateUser().
      const { data, error } = await supabase
        .from("profiles")
        .select("plan")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error || !data) return "free";
      return (data.plan as PlanTier) ?? "free";
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  // Only allow downgrading to free via self-service.
  // Upgrades happen through contact / admin.
  const { mutateAsync: setPlan, isPending: isUpdating } = useMutation({
    mutationFn: async (newTier: PlanTier) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("profiles")
        .update({ plan: newTier })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: (_data, newTier) => {
      queryClient.setQueryData(["plan", user?.id], newTier);
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
  });

  const plan = PLAN_META[tier];

  return { tier, plan, isLoading, setPlan, isUpdating };
}
