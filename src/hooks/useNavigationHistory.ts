import { useState, useCallback, useRef } from "react";

export type Screen = "home" | "profile" | "search" | "settings" | "creatorProfile";

interface HistoryEntry {
  screen: Screen;
  data?: Record<string, unknown>;
}

export function useNavigationHistory(initialScreen: Screen = "home") {
  const [currentScreen, setCurrentScreen] = useState<Screen>(initialScreen);
  const historyStack = useRef<HistoryEntry[]>([{ screen: initialScreen }]);
  const [canGoBack, setCanGoBack] = useState(false);

  const navigate = useCallback((screen: Screen, data?: Record<string, unknown>) => {
    // Don't push if navigating to the same screen
    if (screen === historyStack.current[historyStack.current.length - 1]?.screen) {
      return;
    }
    
    historyStack.current.push({ screen, data });
    setCurrentScreen(screen);
    setCanGoBack(historyStack.current.length > 1);
  }, []);

  const goBack = useCallback(() => {
    if (historyStack.current.length > 1) {
      historyStack.current.pop();
      const previousEntry = historyStack.current[historyStack.current.length - 1];
      setCurrentScreen(previousEntry.screen);
      setCanGoBack(historyStack.current.length > 1);
      return previousEntry;
    }
    return null;
  }, []);

  const goHome = useCallback(() => {
    historyStack.current = [{ screen: "home" }];
    setCurrentScreen("home");
    setCanGoBack(false);
  }, []);

  const reset = useCallback((screen: Screen = "home") => {
    historyStack.current = [{ screen }];
    setCurrentScreen(screen);
    setCanGoBack(false);
  }, []);

  const getHistoryLength = useCallback(() => {
    return historyStack.current.length;
  }, []);

  return {
    currentScreen,
    navigate,
    goBack,
    goHome,
    reset,
    canGoBack,
    getHistoryLength,
  };
}
