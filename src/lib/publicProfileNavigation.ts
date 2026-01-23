import type { Location, NavigateFunction } from "react-router-dom";

type ReturnTo = {
  pathname: string;
  search: string;
  state: Record<string, unknown>;
};

/**
 * Shared navigation used by Search results + Follow lists.
 * Keeps a return context so PublicProfile can reliably return to the originating overlay.
 */
export function navigateToPublicProfile(
  navigate: NavigateFunction,
  location: Location,
  profileUserId: string,
  options?: {
    /** Merge into returnTo.state */
    overlayState?: Record<string, unknown>;
    /** Also persist returnTo in sessionStorage for hard back/refresh cases */
    persistReturnToKey?: string;
  }
) {
  const baseState =
    location.state && typeof location.state === "object"
      ? (location.state as Record<string, unknown>)
      : {};

  const returnTo: ReturnTo = {
    pathname: location.pathname,
    search: location.search,
    state: {
      ...baseState,
      ...(options?.overlayState ?? {}),
    },
  };

  if (options?.persistReturnToKey) {
    try {
      sessionStorage.setItem(options.persistReturnToKey, JSON.stringify(returnTo));
    } catch {
      // ignore
    }
  }

  navigate(`/profile/${profileUserId}`, { state: { returnTo } });
}
