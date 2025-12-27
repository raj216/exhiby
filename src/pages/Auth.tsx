import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { NightAdmission } from "@/components/auth";
import { ResetPassword } from "@/components/auth/ResetPassword";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoading } = useAuth();
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [checkingReset, setCheckingReset] = useState(true);

  useEffect(() => {
    // Check for password recovery from URL hash or query params
    const checkPasswordRecovery = async () => {
      // Check URL hash for recovery token (Supabase adds tokens to hash)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const type = hashParams.get("type") || searchParams.get("type");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (type === "recovery" && accessToken) {
        // Set the session from the recovery tokens
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || "",
        });

        if (!error) {
          setIsPasswordReset(true);
          // Clear tokens from URL to prevent exposure in browser history
          window.history.replaceState(null, '', window.location.pathname);
        }
      }

      setCheckingReset(false);
    };

    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordReset(true);
        setCheckingReset(false);
      }
    });

    checkPasswordRecovery();

    return () => subscription.unsubscribe();
  }, [searchParams]);

  useEffect(() => {
    // Only redirect if not in password reset mode and user is logged in
    if (!isLoading && user && !isPasswordReset && !checkingReset) {
      navigate("/", { replace: true });
    }
  }, [user, isLoading, navigate, isPasswordReset, checkingReset]);

  const handleComplete = () => {
    navigate("/", { replace: true });
  };

  if (isLoading || checkingReset) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show password reset form if in recovery mode
  if (isPasswordReset) {
    return <ResetPassword />;
  }

  if (user) {
    return null;
  }

  return <NightAdmission onComplete={handleComplete} />;
}
