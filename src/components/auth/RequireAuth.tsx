import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ProfilePageSkeleton } from "@/components/ui/loading-skeletons";

const RETURN_URL_KEY = "exhiby_return_url";

interface RequireAuthProps {
  children: React.ReactNode;
}

/**
 * Auth Gate component that protects routes from unauthenticated users.
 * 
 * If the user is NOT logged in:
 * 1. Saves the current URL to localStorage
 * 2. Redirects to /auth with the return path as a query param
 * 
 * The Auth page will read this and redirect back after successful login.
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Wait for auth state to be determined
    if (isLoading) return;

    // If user is NOT authenticated, redirect to auth
    if (!user) {
      // Save the full path (including search params) to localStorage
      const returnUrl = location.pathname + location.search;
      localStorage.setItem(RETURN_URL_KEY, returnUrl);

      console.log("[RequireAuth] Unauthenticated user - redirecting to auth with returnUrl:", returnUrl);

      // Redirect to auth with the return path as query param for redundancy
      navigate(`/auth?redirect=${encodeURIComponent(returnUrl)}`, { replace: true });
    }
  }, [user, isLoading, navigate, location]);

  // Show loading skeleton while checking auth state
  if (isLoading) {
    return <ProfilePageSkeleton />;
  }

  // If not authenticated, show skeleton while redirecting
  if (!user) {
    return <ProfilePageSkeleton />;
  }

  // User is authenticated - render the protected content
  return <>{children}</>;
}

/**
 * Utility to get and clear the stored return URL after login
 */
export function getAndClearReturnUrl(): string | null {
  const returnUrl = localStorage.getItem(RETURN_URL_KEY);
  if (returnUrl) {
    localStorage.removeItem(RETURN_URL_KEY);
  }
  return returnUrl;
}
