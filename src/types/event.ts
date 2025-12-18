import { EventTiming } from "@/hooks/useEventStatus";

export type EventStatus = "UPCOMING" | "LIVE" | "ENDED";

/**
 * Base event interface with timestamp-based status
 */
export interface BaseEvent {
  id: string;
  title: string;
  artistName: string;
  coverImage: string;
  price: number;
  timing: EventTiming;
}

/**
 * Live event with viewer count
 */
export interface LiveEvent extends BaseEvent {
  viewers: number;
}

/**
 * Curated item for studio cards
 */
export interface CuratedItem {
  id: string;
  image: string;
  artistName: string;
  timing: EventTiming;
  eventTitle?: string;
  price?: number;
}

/**
 * Scheduled event for box office
 */
export interface ScheduledEvent {
  id: string;
  coverImage: string;
  title: string;
  price: number;
  artistName: string;
  timing: EventTiming;
}

/**
 * Legacy status type for backward compatibility
 * Maps to computed status from timing
 */
export type LegacyCreatorStatus = "live" | "scheduled" | "offline";

/**
 * Convert computed status to legacy status
 */
export function toLegacyStatus(status: EventStatus): LegacyCreatorStatus {
  switch (status) {
    case "LIVE":
      return "live";
    case "UPCOMING":
      return "scheduled";
    case "ENDED":
    default:
      return "offline";
  }
}
