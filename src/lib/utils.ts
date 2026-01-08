import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns a safe absolute URL for external navigation (e.g., href).
 * Blocks dangerous protocols like `javascript:`.
 */
export function safeExternalUrl(
  input: string | null | undefined,
  allowedProtocols: Array<"http:" | "https:" | "mailto:"> = ["http:", "https:"]
): string | null {
  if (!input) return null;

  try {
    const url = new URL(input);
    if (!allowedProtocols.includes(url.protocol as any)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

