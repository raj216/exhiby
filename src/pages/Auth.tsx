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
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isLoading, signOut } = useAuth();
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [checkingReset, setCheckingReset] = useState(true);
  const [forceLogoutInProgress, setForceLogoutInProgress] = useState(false);

  // Check if user just logged out (logged_out=1 param)
  const isLoggedOutMode = searchParams.get("logged_out") === "1";

  // Handle force logout when arriving with logged_out=1 but session still exists
  useEffect(() => {
    const handleForceLogout = async () => {
      if (isLoggedOutMode && user && !forceLogoutInProgress) {
        console.log("[Auth] logged_out=1 detected but session exists - forcing local signOut");
        setForceLogoutInProgress(true);
        
        try {
          // Force clear the session
          await supabase.auth.signOut({ scope: "local" });
          console.log("[Auth] Force signOut complete");
        } catch (err) {
          console.error("[Auth] Force signOut error:", err);
        }
        
        // Clear the logged_out param after forcing logout
        setSearchParams({}, { replace: true });
        setForceLogoutInProgress(false);
      }
    };

    if (!isLoading) {
      handleForceLogout();
    }
  }, [isLoggedOutMode, user, isLoading, forceLogoutInProgress, setSearchParams]);

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
    // DO NOT redirect if:
    // - logged_out=1 is present (user just logged out)
    // - in password reset mode
    // - still checking reset state
    // - force logout in progress
    if (isLoggedOutMode || isPasswordReset || checkingReset || forceLogoutInProgress) {
      console.log("[Auth] Skipping auto-redirect:", { isLoggedOutMode, isPasswordReset, checkingReset, forceLogoutInProgress });
      return;
    }

    // Only redirect if user is logged in
    if (!isLoading && user) {
      const destination = getReturnDestination();
      console.log("[Auth] User logged in - redirecting to:", destination);
      navigate(destination, { replace: true });
    }
  }, [user, isLoading, navigate, isPasswordReset, checkingReset, searchParams, isLoggedOutMode, forceLogoutInProgress]);

  const handleComplete = () => {
    // Clear logged_out param if present
    if (isLoggedOutMode) {
      setSearchParams({}, { replace: true });
    }
    
    const destination = getReturnDestination();
    console.log("[Auth] Login complete - navigating to:", destination);
    navigate(destination, { replace: true });
  };

  if (isLoading || checkingReset || forceLogoutInProgress) {
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

  // If user is logged in but NOT in logged_out mode, show nothing (will redirect)
  if (user && !isLoggedOutMode) {
    return null;
  }

  return <NightAdmission onComplete={handleComplete} />;
}
