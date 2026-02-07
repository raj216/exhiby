import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "audience" | "creator";

interface UserModeContextType {
  mode: UserRole;
  isVerifiedCreator: boolean;
  isLoadingCreatorStatus: boolean;
  setMode: (mode: UserRole) => void;
  activateCreatorRole: () => Promise<boolean>;
  toggleMode: () => void;
}

const UserModeContext = createContext<UserModeContextType | undefined>(undefined);

export function UserModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const readStoredMode = (): UserRole => {
    try {
      const raw = localStorage.getItem("exhiby_app_mode");
      return raw === "creator" ? "creator" : "audience";
    } catch {
      return "audience";
    }
  };

  const writeStoredMode = (next: UserRole) => {
    try {
      localStorage.setItem("exhiby_app_mode", next);
    } catch {
      // ignore
    }
  };

  const [mode, _setMode] = useState<UserRole>(() => readStoredMode());
  const [isVerifiedCreator, setVerifiedCreator] = useState(false);
  const [isLoadingCreatorStatus, setIsLoadingCreatorStatus] = useState(true);

  const setMode = useCallback(
    (next: UserRole) => {
      // Only verified creators can enter creator mode.
      if (next === "creator" && !isVerifiedCreator) return;
      _setMode(next);
      writeStoredMode(next);
    },
    [isVerifiedCreator]
  );

  // Load creator status from database on mount and when user changes
  useEffect(() => {
    const loadCreatorStatus = async () => {
      if (!user) {
        setVerifiedCreator(false);
        _setMode("audience");
        writeStoredMode("audience");
        setIsLoadingCreatorStatus(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "creator")
          .maybeSingle();

        if (error) {
          console.error("Error loading creator status:", error);
          setVerifiedCreator(false);
        } else if (data) {
          setVerifiedCreator(true);
          // Restore creator mode if user previously chose it.
          if (readStoredMode() === "creator") {
            _setMode("creator");
          }
        } else {
          setVerifiedCreator(false);
          // If not a verified creator, ensure mode cannot be stuck on creator.
          _setMode("audience");
          writeStoredMode("audience");
        }
      } catch (err) {
        console.error("Failed to load creator status:", err);
        setVerifiedCreator(false);
        _setMode("audience");
        writeStoredMode("audience");
      } finally {
        setIsLoadingCreatorStatus(false);
      }
    };

    loadCreatorStatus();
  }, [user]);

  // Function to activate creator role (writes to database)
  const activateCreatorRole = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase.from("user_roles").insert({
        user_id: user.id,
        role: "creator",
      });

      if (error) {
        // If it's a duplicate error, user is already a creator
        if (error.message.includes("duplicate") || error.code === "23505") {
          setVerifiedCreator(true);
          _setMode("creator");
          writeStoredMode("creator");
          return true;
        }
        console.error("Failed to activate creator role:", error);
        return false;
      }

      setVerifiedCreator(true);
      _setMode("creator");
      writeStoredMode("creator");
      return true;
    } catch (err) {
      console.error("Error activating creator role:", err);
      return false;
    }
  };

  const toggleMode = () => {
    // Allow creators to always return to audience mode.
    // Only allow entering creator mode once the user is verified.
    _setMode((prev) => {
      const next = prev === "creator" ? "audience" : isVerifiedCreator ? "creator" : prev;
      writeStoredMode(next);
      return next;
    });
  };

  return (
    <UserModeContext.Provider
      value={{
        mode,
        isVerifiedCreator,
        isLoadingCreatorStatus,
        setMode,
        activateCreatorRole,
        toggleMode,
      }}
    >
      {children}
    </UserModeContext.Provider>
  );
}

export function useUserMode(): UserModeContextType {
  const context = useContext(UserModeContext);
  if (context === undefined) {
    throw new Error("useUserMode must be used within UserModeProvider");
  }
  return context;
}
