import { useState, useEffect, useMemo } from "react";

export type EventStatus = "UPCOMING" | "LIVE" | "ENDED";

export interface EventTiming {
  startTime: Date;
  endTime: Date;
}

export interface EventStatusResult {
  status: EventStatus;
  countdownLabel: string;
  isLive: boolean;
  isUpcoming: boolean;
  isEnded: boolean;
}

/**
 * Computes human-friendly countdown label from milliseconds remaining
 */
function getCountdownLabel(msRemaining: number): string {
  if (msRemaining <= 0) return "";

  const seconds = Math.floor(msRemaining / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  // More than 2 days away
  if (days > 1) {
    return `${days} days`;
  }

  // Tomorrow (between 24-48 hours)
  if (days === 1 || (hours >= 20 && hours < 48)) {
    return "Tomorrow";
  }

  // Today with specific time (more than 2 hours away)
  if (hours >= 2) {
    const targetDate = new Date(Date.now() + msRemaining);
    const hoursFormatted = targetDate.getHours();
    const ampm = hoursFormatted >= 12 ? "PM" : "AM";
    const hour12 = hoursFormatted % 12 || 12;
    return `Today ${hour12} ${ampm}`;
  }

  // Hours remaining (1-2 hours)
  if (hours >= 1) {
    return `${hours} hr`;
  }

  // Minutes remaining (2-59 minutes)
  if (minutes >= 2) {
    return `${minutes} min`;
  }

  // Less than 2 minutes
  if (minutes === 1) {
    return "1 min";
  }

  // Less than 1 minute
  return "< 1 min";
}

/**
 * Computes event status based on current time and event timing
 */
function computeStatus(timing: EventTiming, now: Date): EventStatus {
  const currentTime = now.getTime();
  const startTime = timing.startTime.getTime();
  const endTime = timing.endTime.getTime();

  if (currentTime < startTime) {
    return "UPCOMING";
  }

  if (currentTime >= startTime && currentTime <= endTime) {
    return "LIVE";
  }

  return "ENDED";
}

/**
 * Hook that provides auto-updating event status and countdown
 * Updates every 60 seconds for efficiency, or every second when < 2 minutes
 */
export function useEventStatus(timing: EventTiming | null): EventStatusResult {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!timing) return;

    const msUntilStart = timing.startTime.getTime() - Date.now();
    
    // Determine update interval based on proximity
    const getInterval = () => {
      const remaining = timing.startTime.getTime() - Date.now();
      if (remaining <= 0) return 10000; // Check every 10s when live
      if (remaining < 120000) return 1000; // Every second when < 2 min
      if (remaining < 3600000) return 30000; // Every 30s when < 1 hour
      return 60000; // Every minute otherwise
    };

    let intervalId: NodeJS.Timeout;

    const updateTimer = () => {
      setNow(new Date());
      
      // Recalculate interval for next update
      clearInterval(intervalId);
      intervalId = setInterval(updateTimer, getInterval());
    };

    intervalId = setInterval(updateTimer, getInterval());

    return () => clearInterval(intervalId);
  }, [timing]);

  return useMemo(() => {
    if (!timing) {
      return {
        status: "ENDED" as EventStatus,
        countdownLabel: "",
        isLive: false,
        isUpcoming: false,
        isEnded: true,
      };
    }

    const status = computeStatus(timing, now);
    const msRemaining = timing.startTime.getTime() - now.getTime();
    const countdownLabel = status === "UPCOMING" ? getCountdownLabel(msRemaining) : "";

    return {
      status,
      countdownLabel,
      isLive: status === "LIVE",
      isUpcoming: status === "UPCOMING",
      isEnded: status === "ENDED",
    };
  }, [timing, now]);
}

/**
 * Utility to create EventTiming from ISO strings or Date objects
 */
export function createEventTiming(
  startTime: string | Date,
  endTime: string | Date
): EventTiming {
  return {
    startTime: startTime instanceof Date ? startTime : new Date(startTime),
    endTime: endTime instanceof Date ? endTime : new Date(endTime),
  };
}

/**
 * Utility to create mock timing for demo purposes
 * offsetMinutes: negative = started in past, positive = starts in future
 */
export function createMockTiming(
  offsetMinutes: number,
  durationMinutes: number = 60
): EventTiming {
  const now = Date.now();
  return {
    startTime: new Date(now + offsetMinutes * 60 * 1000),
    endTime: new Date(now + (offsetMinutes + durationMinutes) * 60 * 1000),
  };
}
