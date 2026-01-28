import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Ensure profile exists for user (creates one if missing)
async function ensureProfileExists(user: User) {
  console.log("[AuthContext] ensureProfileExists called for user:", user.id);
  try {
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingProfile) {
      console.warn("[AuthContext] ⚠️ Profile missing for user, creating now...");
      const { error } = await supabase.from("profiles").insert({
        user_id: user.id,
        name: user.user_metadata?.name || user.user_metadata?.full_name || "Guest",
      });

      if (error && !error.message.includes("duplicate")) {
        console.error("[AuthContext] ❌ Failed to create profile:", error);
      } else {
        console.log("[AuthContext] ✅ Profile created successfully");
      }
    } else {
      console.log("[AuthContext] ✅ Profile already exists:", existingProfile.id);
    }
  } catch (error) {
    console.error("[AuthContext] ❌ Error ensuring profile exists:", error);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("[AuthContext] Auth state changed:", event, { hasSession: !!session, userId: session?.user?.id });
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);

        // Ensure profile exists when user signs in
        if (session?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
          setTimeout(() => {
            ensureProfileExists(session.user);
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("[AuthContext] Initial session check:", { hasSession: !!session, userId: session?.user?.id });
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      // Ensure profile exists for existing session
      if (session?.user) {
        ensureProfileExists(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    console.log("[AuthContext] signOut called - session before:", { hasSession: !!session, userId: user?.id });
    
    try {
      // Clear local state immediately to prevent UI flicker
      setUser(null);
      setSession(null);
      
      // Sign out from Supabase (local scope to avoid server-side issues)
      const { error } = await supabase.auth.signOut({ scope: "local" });
      
      if (error) {
        console.error("[AuthContext] signOut error:", error);
      } else {
        console.log("[AuthContext] signOut successful - session cleared");
      }
    } catch (err) {
      console.error("[AuthContext] signOut exception:", err);
    }
    
    // Double-check session is cleared
    const { data } = await supabase.auth.getSession();
    console.log("[AuthContext] signOut complete - session after:", { hasSession: !!data.session });
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
