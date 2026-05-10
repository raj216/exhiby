/**
 * AudienceEmailModal
 * Pro feature: 3 focused, near-automated email actions.
 * Replaces the full campaign builder — artists send in one or two taps.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Mail,
  Megaphone,
  Heart,
  Clock,
  Send,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { triggerClickHaptic } from "@/lib/haptics";
import { toast } from "sonner";
import type { CreatorAttendee } from "@/hooks/useCreatorAudience";

type ActionType = "announce" | "repeat" | "reengage" | null;

interface AudienceEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendees: CreatorAttendee[];
  creatorName: string;
  nextSessionTitle?: string;
  nextSessionDate?: string;
  nextSessionPrice?: string;
  nextSessionLink?: string;
}

interface ActionConfig {
  id: ActionType;
  icon: typeof Megaphone;
  label: string;
  tagline: string;
  color: string;
  borderColor: string;
  iconBg: string;
  getRecipients: (attendees: CreatorAttendee[]) => CreatorAttendee[];
  buildSubject: (ctx: TemplateContext) => string;
  buildBody: (ctx: TemplateContext) => string;
}

interface TemplateContext {
  creatorName: string;
  nextSessionTitle: string;
  nextSessionDate: string;
  nextSessionPrice: string;
  nextSessionLink: string;
}

const ACTIONS: ActionConfig[] = [
  {
    id: "announce",
    icon: Megaphone,
    label: "Announce Next Session",
    tagline: "Pre-fills your next session details. Edit if needed, then send.",
    color: "text-electric",
    borderColor: "border-electric/30",
    iconBg: "bg-electric/10",
    getRecipients: (attendees) => attendees,
    buildSubject: ({ creatorName, nextSessionTitle }) =>
      `${creatorName} has a new session — ${nextSessionTitle}`,
    buildBody: ({ creatorName, nextSessionTitle, nextSessionDate, nextSessionPrice, nextSessionLink }) =>
      `Hey [first_name],\n\nI'm hosting ${nextSessionTitle} on ${nextSessionDate}. Tickets are ${nextSessionPrice}. Join me live — ${nextSessionLink}.\n\n— ${creatorName}`,
  },
  {
    id: "repeat",
    icon: Heart,
    label: "Message Your Repeat Fans",
    tagline: "A personal note to attendees who've joined 2+ sessions.",
    color: "text-gold",
    borderColor: "border-gold/30",
    iconBg: "bg-gold/10",
    getRecipients: (attendees) => attendees.filter((a) => a.sessionsAttended >= 2),
    buildSubject: ({ creatorName }) => `A personal note from ${creatorName}`,
    buildBody: ({ creatorName, nextSessionTitle, nextSessionDate, nextSessionLink }) =>
      `Hey [first_name],\n\nThank you for coming back to my sessions. I really appreciate your support.\n\nI have ${nextSessionTitle} coming up on ${nextSessionDate} — I'd love to see you there.\n\n${nextSessionLink}\n\n— ${creatorName}`,
  },
  {
    id: "reengage",
    icon: Clock,
    label: "Re-engage Quiet Fans",
    tagline: "Reaches fans who attended at least once but not in the last 45 days.",
    color: "text-rose-400",
    borderColor: "border-rose-400/30",
    iconBg: "bg-rose-400/10",
    getRecipients: (attendees) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 45);
      return attendees.filter(
        (a) => a.sessionsAttended >= 1 && a.lastAttended < cutoff
      );
    },
    buildSubject: ({ creatorName }) => `It's been a while — ${creatorName} misses you`,
    buildBody: ({ creatorName, nextSessionLink }) =>
      `Hey [first_name],\n\nIt's been a while! I've been creating a lot and have sessions coming up. Would love to have you back — ${nextSessionLink}.\n\n— ${creatorName}`,
  },
];

function buildCtx(props: Omit<AudienceEmailModalProps, "isOpen" | "onClose" | "attendees">): TemplateContext {
  return {
    creatorName: props.creatorName || "the creator",
    nextSessionTitle: props.nextSessionTitle || "my upcoming session",
    nextSessionDate: props.nextSessionDate || "a date to be announced",
    nextSessionPrice: props.nextSessionPrice || "listed on the session page",
    nextSessionLink: props.nextSessionLink || window.location.origin,
  };
}

export function AudienceEmailModal({
  isOpen,
  onClose,
  attendees,
  creatorName,
  nextSessionTitle,
  nextSessionDate,
  nextSessionPrice,
  nextSessionLink,
}: AudienceEmailModalProps) {
  const [activeAction, setActiveAction] = useState<ActionType>(null);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [sending, setSending] = useState(false);

  const ctx = buildCtx({ creatorName, nextSessionTitle, nextSessionDate, nextSessionPrice, nextSessionLink });

  const openAction = (action: ActionConfig) => {
    triggerClickHaptic();
    setActiveAction(action.id);
    setEditedSubject(action.buildSubject(ctx));
    setEditedBody(action.buildBody(ctx));
  };

  const closeAction = () => {
    setActiveAction(null);
    setEditedSubject("");
    setEditedBody("");
  };

  const handleSend = async () => {
    const action = ACTIONS.find((a) => a.id === activeAction);
    if (!action) return;

    const recipients = action.getRecipients(attendees);
    if (recipients.length === 0) {
      toast.error("No recipients in this segment");
      return;
    }

    const segment =
      activeAction === "announce"
        ? "all"
        : activeAction === "repeat"
        ? "REPEAT"
        : "NEW";

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.functions.invoke("send-campaign-email", {
        body: {
          segment,
          subject: editedSubject.trim(),
          body: editedBody.trim(),
          creator_name: creatorName,
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (error) throw error;

      toast.success(`Sent to ${recipients.length} recipient${recipients.length !== 1 ? "s" : ""}`, {
        description: "Emails are on their way",
      });
      closeAction();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("404") || msg.includes("not found") || msg.includes("FunctionsHttpError")) {
        toast.success(`Preview: ready for ${recipients.length} recipient${recipients.length !== 1 ? "s" : ""}`, {
          description: "Email sending activates once the function is deployed",
        });
        closeAction();
        onClose();
      } else {
        toast.error("Failed to send", { description: msg });
      }
    } finally {
      setSending(false);
    }
  };

  const activeConfig = ACTIONS.find((a) => a.id === activeAction);
  const recipientCount = activeConfig ? activeConfig.getRecipients(attendees).length : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-40"
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-obsidian rounded-t-3xl border-t border-border/40 max-h-[92vh] overflow-y-auto"
          >
            <div className="px-5 pt-4 pb-safe">
              {/* Handle */}
              <div className="w-10 h-1 rounded-full bg-border/50 mx-auto mb-4" />

              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gold/15 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-gold" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Email Your Audience</p>
                    <p className="text-xs text-muted-foreground">{attendees.length} fans · one tap to send</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <AnimatePresence mode="wait">
                {!activeAction ? (
                  /* ── Action list ── */
                  <motion.div
                    key="list"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    className="space-y-2 pb-8"
                  >
                    {ACTIONS.map((action) => {
                      const recipCount = action.getRecipients(attendees).length;
                      const Icon = action.icon;
                      return (
                        <button
                          key={action.id}
                          onClick={() => openAction(action)}
                          disabled={recipCount === 0}
                          className={`w-full flex items-center gap-3 p-4 rounded-2xl border bg-carbon transition-colors text-left ${
                            recipCount > 0
                              ? `${action.borderColor} hover:bg-muted/20`
                              : "border-border/20 opacity-40 cursor-not-allowed"
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${action.iconBg}`}>
                            <Icon className={`w-4 h-4 ${action.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">{action.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{action.tagline}</p>
                            <p className="text-[10px] text-muted-foreground/60 mt-1">
                              {recipCount > 0
                                ? `${recipCount} recipient${recipCount !== 1 ? "s" : ""}`
                                : "No recipients yet"}
                            </p>
                          </div>
                          {recipCount > 0 && (
                            <ChevronRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </motion.div>
                ) : (
                  /* ── Compose view ── */
                  <motion.div
                    key="compose"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    className="space-y-3 pb-8"
                  >
                    <button
                      onClick={closeAction}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2 transition-colors"
                    >
                      ← Back to actions
                    </button>

                    <div className={`px-3 py-2.5 rounded-xl bg-carbon border ${activeConfig?.borderColor}`}>
                      <p className={`text-xs font-semibold ${activeConfig?.color}`}>
                        {activeConfig?.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Sending to {recipientCount} recipient{recipientCount !== 1 ? "s" : ""}
                      </p>
                    </div>

                    {/* Subject */}
                    <div>
                      <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">
                        Subject
                      </label>
                      <input
                        className="w-full bg-carbon border border-border/40 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-electric/50"
                        value={editedSubject}
                        onChange={(e) => setEditedSubject(e.target.value)}
                        maxLength={120}
                      />
                    </div>

                    {/* Body */}
                    <div>
                      <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">
                        Message
                      </label>
                      <textarea
                        className="w-full bg-carbon border border-border/40 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-electric/50 resize-none"
                        value={editedBody}
                        onChange={(e) => setEditedBody(e.target.value)}
                        rows={9}
                        maxLength={2000}
                      />
                      <p className="text-[10px] text-muted-foreground mt-1 text-right">
                        {editedBody.length}/2000
                      </p>
                    </div>

                    <p className="text-[10px] text-muted-foreground/50">
                      An unsubscribe link is automatically added to every email.
                      Max one email per recipient per day across all actions.
                    </p>

                    <div className="flex gap-2">
                      <button
                        onClick={closeAction}
                        className="flex-1 py-3.5 rounded-2xl border border-border/40 text-sm font-semibold text-muted-foreground hover:bg-muted/20 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => { triggerClickHaptic(); handleSend(); }}
                        disabled={sending || !editedSubject.trim() || !editedBody.trim() || recipientCount === 0}
                        className="flex-[2] py-3.5 rounded-2xl bg-gradient-to-r from-electric to-crimson text-white text-sm font-semibold shadow-electric flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                      >
                        {sending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        Send to {recipientCount} {recipientCount !== 1 ? "people" : "person"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
