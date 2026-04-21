import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, Wifi, WifiOff, Loader2, RefreshCw, AlertCircle, Pin, PinOff } from "lucide-react";
import { format } from "date-fns";
import type { LiveMessage } from "@/hooks/useLiveChat";

interface LiveRoomChatProps {
  isOpen: boolean;
  onClose: () => void;
  messages?: LiveMessage[];
  status?: "disconnected" | "connecting" | "connected" | "reconnecting" | "error";
  messageCount?: number;
  onSendMessage: (message: string) => Promise<boolean>;
  onRetryMessage?: (clientId: string) => Promise<boolean>;
  onRemoveFailedMessage?: (clientId: string) => void;
  onReload?: () => void;
  isAuthenticated?: boolean;
  isSending?: boolean;
  isCreator?: boolean;
  pinnedMessage?: LiveMessage | null;
  pinnedMessageId?: string | null;
  onPinMessage?: (messageId: string) => void | Promise<void>;
  onUnpinMessage?: () => void | Promise<void>;
}

export function LiveRoomChat({
  isOpen,
  onClose,
  messages = [],
  status = "disconnected",
  messageCount = 0,
  onSendMessage,
  onRetryMessage,
  onRemoveFailedMessage,
  onReload,
  isAuthenticated = true,
  isSending = false,
  isCreator = false,
  pinnedMessage = null,
  pinnedMessageId = null,
  onPinMessage,
  onUnpinMessage,
}: LiveRoomChatProps) {
  const [inputValue, setInputValue] = useState("");
  const [localSending, setLocalSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);

  // Combined sending state
  const isCurrentlySending = isSending || localSending;

  // Check if user is near bottom of chat
  const checkIfNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    const threshold = 100;
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  // Handle scroll to update isNearBottom
  const handleScroll = useCallback(() => {
    setIsNearBottom(checkIfNearBottom());
  }, [checkIfNearBottom]);

  // Auto-scroll to bottom when new messages arrive (only if near bottom)
  useEffect(() => {
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isNearBottom]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!inputValue.trim() || isCurrentlySending) return;

    const messageToSend = inputValue.trim();
    setInputValue(""); // Clear immediately for better UX
    setLocalSending(true);
    
    try {
      const result = await onSendMessage(messageToSend);
      if (result === false) {
        // Restore input if send failed
        setInputValue(messageToSend);
      }
    } finally {
      setLocalSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRetry = async (clientId: string) => {
    if (onRetryMessage) {
      await onRetryMessage(clientId);
    }
  };

  const handleRemove = (clientId: string) => {
    if (onRemoveFailedMessage) {
      onRemoveFailedMessage(clientId);
    }
  };

  // Status indicator component
  const StatusIndicator = () => {
    if (status === "connected") {
      return (
        <div className="flex items-center gap-1.5 text-emerald-400">
          <Wifi className="w-3 h-3" />
          <span className="text-[10px] uppercase tracking-wider font-medium">Live</span>
          <span className="text-white/40 text-[10px]">• {messageCount}</span>
        </div>
      );
    }
    if (status === "connecting") {
      return (
        <div className="flex items-center gap-1.5 text-amber-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span className="text-[10px] uppercase tracking-wider">Connecting…</span>
        </div>
      );
    }
    if (status === "reconnecting") {
      return (
        <div className="flex items-center gap-1.5 text-amber-400">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span className="text-[10px] uppercase tracking-wider">Reconnecting…</span>
        </div>
      );
    }
    if (status === "error") {
      return (
        <div className="flex items-center gap-1.5 text-red-400">
          <WifiOff className="w-3 h-3" />
          <span className="text-[10px] uppercase tracking-wider">Error</span>
          {onReload && (
            <button
              onClick={onReload}
              className="ml-1 p-1 rounded hover:bg-white/10 transition-colors"
              title="Reconnect"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-red-400">
        <WifiOff className="w-3 h-3" />
        <span className="text-[10px] uppercase tracking-wider">Disconnected</span>
        {onReload && (
          <button
            onClick={onReload}
            className="ml-1 p-1 rounded hover:bg-white/10 transition-colors"
            title="Reconnect"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  };

  // Message status indicator
  const MessageStatus = ({ message }: { message: LiveMessage }) => {
    if (message._status === "sending") {
      return (
        <span className="text-white/30 text-[10px] ml-1">
          <Loader2 className="w-2.5 h-2.5 animate-spin inline" />
        </span>
      );
    }
    if (message._status === "failed") {
      return (
        <span className="text-red-400 text-[10px] ml-1 flex items-center gap-1">
          <AlertCircle className="w-2.5 h-2.5" />
          Failed
          {message._clientId && (
            <>
              <button
                onClick={() => handleRetry(message._clientId!)}
                className="underline hover:text-red-300"
              >
                Retry
              </button>
              <button
                onClick={() => handleRemove(message._clientId!)}
                className="underline hover:text-red-300"
              >
                Remove
              </button>
            </>
          )}
        </span>
      );
    }
    return null;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="absolute left-0 top-0 bottom-0 z-30 w-full max-w-sm lg:max-w-md flex flex-col"
          style={{
            background:
              "linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 70%, transparent 100%)",
            paddingTop: "max(80px, env(safe-area-inset-top) + 60px)",
            paddingBottom: "max(100px, env(safe-area-inset-bottom) + 80px)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <h3 className="text-white font-semibold">Live Chat</h3>
              <StatusIndicator />
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Pinned message banner */}
          {pinnedMessage && (
            <div className="px-4 pt-3">
              <div className="rounded-lg bg-gold/10 border border-gold/30 px-3 py-2 flex items-start gap-2">
                <Pin className="w-3.5 h-3.5 text-gold mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-gold text-[10px] uppercase tracking-wider font-semibold">
                      Pinned
                    </span>
                    <span className="text-white/80 text-xs font-medium truncate">
                      {pinnedMessage.display_name || "Viewer"}
                    </span>
                  </div>
                  <p className="text-white/90 text-sm break-words mt-0.5">
                    {pinnedMessage.message}
                  </p>
                </div>
                {isCreator && onUnpinMessage && (
                  <button
                    onClick={() => onUnpinMessage()}
                    className="shrink-0 p-1 rounded hover:bg-white/10 text-gold/80 hover:text-gold transition-colors"
                    title="Unpin"
                  >
                    <PinOff className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
          >
            {messages.length === 0 ? (
              <div className="text-center text-white/40 text-sm py-8">
                No messages yet. Be the first to say something!
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((msg) => {
                  const isPinned = msg.id === pinnedMessageId;
                  const canPin = isCreator && msg._status !== "sending" && msg._status !== "failed" && !msg.id.startsWith("optimistic-");
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ 
                        opacity: msg._status === "sending" ? 0.7 : 1, 
                        y: 0 
                      }}
                      exit={{ opacity: 0 }}
                      className={`group flex flex-col gap-0.5 ${
                        msg._status === "failed" ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-electric font-medium text-sm shrink-0">
                          {msg.display_name || "Viewer"}
                        </span>
                        {msg.role === "creator" && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gold/20 text-gold border border-gold/30">
                            Host
                          </span>
                        )}
                        {isPinned && (
                          <Pin className="w-3 h-3 text-gold" />
                        )}
                        <span className="text-white/30 text-[10px] ml-auto">
                          {format(new Date(msg.created_at), "HH:mm")}
                        </span>
                        <MessageStatus message={msg} />
                        {canPin && (
                          isPinned ? (
                            <button
                              onClick={() => onUnpinMessage?.()}
                              className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10 text-gold"
                              title="Unpin message"
                            >
                              <PinOff className="w-3 h-3" />
                            </button>
                          ) : (
                            <button
                              onClick={() => onPinMessage?.(msg.id)}
                              className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10 text-white/60 hover:text-gold"
                              title="Pin message"
                            >
                              <Pin className="w-3 h-3" />
                            </button>
                          )
                        )}
                      </div>
                      <span className="text-white/90 text-sm break-words">{msg.message}</span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 pt-3 border-t border-white/10">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.slice(0, 200))}
                onKeyPress={handleKeyPress}
                placeholder={isAuthenticated ? "Say something…" : "Sign in to chat"}
                disabled={!isAuthenticated || isCurrentlySending}
                maxLength={200}
                className="flex-1 h-10 px-4 rounded-full bg-white/10 border border-white/10 text-white placeholder:text-white/50 text-sm focus:outline-none focus:border-electric/50 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isCurrentlySending || !isAuthenticated}
                className="w-10 h-10 rounded-full bg-electric flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-electric/90 transition-colors"
              >
                {isCurrentlySending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
            {inputValue.length > 150 && (
              <div className="text-right text-[10px] text-white/40 mt-1">
                {inputValue.length}/200
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
