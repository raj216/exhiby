import { createContext, useContext, useState, ReactNode } from "react";

export type UserRole = "audience" | "creator";

interface UserModeContextType {
  mode: UserRole;
  isVerifiedCreator: boolean;
  setMode: (mode: UserRole) => void;
  setVerifiedCreator: (verified: boolean) => void;
  toggleMode: () => void;
}

const UserModeContext = createContext<UserModeContextType | undefined>(undefined);

export function UserModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<UserRole>("audience");
  const [isVerifiedCreator, setVerifiedCreator] = useState(false);

  const toggleMode = () => {
    // Allow creators to always return to audience mode.
    // Only allow entering creator mode once the user is verified.
    setMode((prev) => {
      if (prev === "creator") return "audience";
      return isVerifiedCreator ? "creator" : prev;
    });
  };

  return (
    <UserModeContext.Provider
      value={{
        mode,
        isVerifiedCreator,
        setMode,
        setVerifiedCreator,
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
