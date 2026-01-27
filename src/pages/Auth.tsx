import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { NightAdmission } from "@/components/auth";
import { ResetPassword } from "@/components/auth/ResetPassword";
import { getAndClearReturnUrl } from "@/components/auth/RequireAuth";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const RETURN_URL_KEY = "exhiby_return_url";

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

  // Get redirect path from query params OR localStorage
  const getReturnDestination = (): string => {
    // Priority 1: localStorage (set by RequireAuth)
    const storedUrl = getAndClearReturnUrl();
    if (storedUrl) {
      console.log("[Auth] Found return URL in localStorage:", storedUrl);
      return storedUrl;
    }

    // Priority 2: Query param (fallback)
    const redirectParam = searchParams.get("redirect");
    if (redirectParam) {
      console.log("[Auth] Found redirect in query param:", redirectParam);
      // Also clear from localStorage in case it was set
      localStorage.removeItem(RETURN_URL_KEY);
      return redirectParam;
    }

    // Default: home
    return "/";
  };

  useEffect(() => {
    // Only redirect if not in password reset mode and user is logged in
    if (!isLoading && user && !isPasswordReset && !checkingReset) {
      const destination = getReturnDestination();
      console.log("[Auth] User logged in - redirecting to:", destination);
      navigate(destination, { replace: true });
    }
  }, [user, isLoading, navigate, isPasswordReset, checkingReset, searchParams]);

  const handleComplete = () => {
    const destination = getReturnDestination();
    console.log("[Auth] Login complete - navigating to:", destination);
    navigate(destination, { replace: true });
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
