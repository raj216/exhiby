import { useState } from "react";
import { ChevronDown, ChevronUp, Bug, RefreshCw, Loader2 } from "lucide-react";

export type DailyJoinStatus = 
  | "idle"
  | "creating_call_object"
  | "ready_to_join"
  | "joining"
  | "joined"
  | "error"
  | "timeout";

interface DebugPanelProps {
  eventId: string | undefined;
  eventData: {
    id: string;
    room_url: string | null;
    is_live: boolean | null;
    creator_id: string;
  } | null;
  dailyStatus: DailyJoinStatus;
  errorMessage: string | null;
  errorStack: string | null;
  isRecreatingRoom: boolean;
  onRecreateRoom: () => void;
}

export function DebugPanel({
  eventId,
  eventData,
  dailyStatus,
  errorMessage,
  errorStack,
  isRecreatingRoom,
  onRecreateRoom,
}: DebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Only show in development/preview
  const isDev = import.meta.env.DEV || window.location.hostname.includes("lovable");

  if (!isDev) return null;

  const statusColors: Record<DailyJoinStatus, string> = {
    idle: "text-muted-foreground",
    creating_call_object: "text-amber-500",
    ready_to_join: "text-blue-500",
    joining: "text-amber-500",
    joined: "text-green-500",
    error: "text-destructive",
    timeout: "text-destructive",
  };

  return (
    <div className="fixed top-4 left-4 z-[100] bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-xl text-xs font-mono max-w-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-amber-500" />
          <span className="font-semibold text-foreground">Debug Panel</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
          {/* Event ID */}
          <div>
            <span className="text-muted-foreground">eventId: </span>
            <span className="text-foreground">{eventId || "undefined"}</span>
          </div>

          {/* Event Data */}
          <div className="space-y-1">
            <span className="text-muted-foreground">Event Row:</span>
            {eventData ? (
              <div className="pl-2 space-y-0.5">
                <div>
                  <span className="text-muted-foreground">id: </span>
                  <span className="text-foreground truncate">{eventData.id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">room_url: </span>
                  <span className={eventData.room_url ? "text-green-500" : "text-destructive"}>
                    {eventData.room_url || "null"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">is_live: </span>
                  <span className={eventData.is_live ? "text-green-500" : "text-amber-500"}>
                    {String(eventData.is_live)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">creator_id: </span>
                  <span className="text-foreground truncate text-[10px]">{eventData.creator_id}</span>
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground pl-2">null</span>
            )}
          </div>

          {/* Daily Status */}
          <div>
            <span className="text-muted-foreground">Daily Status: </span>
            <span className={statusColors[dailyStatus]}>{dailyStatus}</span>
          </div>

          {/* Error */}
          {errorMessage && (
            <div className="space-y-1">
              <span className="text-destructive">Error: </span>
              <div className="text-destructive bg-destructive/10 p-2 rounded text-[10px] break-words">
                {errorMessage}
              </div>
              {errorStack && (
                <details className="text-[10px]">
                  <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
                    Stack trace
                  </summary>
                  <pre className="text-destructive/80 bg-destructive/5 p-1 rounded overflow-x-auto max-h-32 mt-1">
                    {errorStack}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* Recreate Room Button */}
          {(!eventData?.room_url || dailyStatus === "error" || dailyStatus === "timeout") && (
            <button
              onClick={onRecreateRoom}
              disabled={isRecreatingRoom}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-electric text-white rounded hover:bg-electric/90 transition-colors disabled:opacity-50"
            >
              {isRecreatingRoom ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Creating room...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3 h-3" />
                  <span>Recreate Room</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
