import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ConnectStatus = "loading" | "not_connected" | "onboarding_incomplete" | "pending_verification" | "active";

export function useStripeConnect(userId: string | undefined) {
  const [status, setStatus] = useState<ConnectStatus>("loading");
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!userId) {
      setStatus("not_connected");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect", {
        body: { action: "get_status" },
      });

      if (error) {
        console.error("[useStripeConnect] Error:", error);
        setStatus("not_connected");
        return;
      }

      setStatus(data.status || "not_connected");
    } catch (err) {
      console.error("[useStripeConnect] Error:", err);
      setStatus("not_connected");
    }
  }, [userId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const startOnboarding = async (): Promise<string | null> => {
    setLoading(true);
    try {
      // Step 1: Create account if needed
      if (status === "not_connected") {
        const { error: createError } = await supabase.functions.invoke("stripe-connect", {
          body: { action: "create_account" },
        });
        if (createError) {
          console.error("[useStripeConnect] Create error:", createError);
          setLoading(false);
          return null;
        }
      }

      // Step 2: Get onboarding link
      const { data, error } = await supabase.functions.invoke("stripe-connect", {
        body: { action: "create_onboarding_link" },
      });

      if (error || !data?.url) {
        console.error("[useStripeConnect] Onboarding link error:", error);
        setLoading(false);
        return null;
      }

      setLoading(false);
      return data.url;
    } catch (err) {
      console.error("[useStripeConnect] Error:", err);
      setLoading(false);
      return null;
    }
  };

  const getDashboardLink = async (): Promise<string | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect", {
        body: { action: "create_dashboard_link" },
      });

      setLoading(false);
      if (error || !data?.url) return null;
      return data.url;
    } catch {
      setLoading(false);
      return null;
    }
  };

  const requestPayout = async (): Promise<{ success: boolean; amount?: number; error?: string }> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect", {
        body: { action: "request_payout" },
      });

      setLoading(false);
      if (error) return { success: false, error: error.message };
      if (data?.error) return { success: false, error: data.error };
      return { success: true, amount: data.amount };
    } catch (err: any) {
      setLoading(false);
      return { success: false, error: err.message };
    }
  };

  return {
    status,
    loading,
    startOnboarding,
    getDashboardLink,
    requestPayout,
    refetchStatus: fetchStatus,
  };
}
