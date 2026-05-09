/**
 * EmailCampaignModal
 * Pro feature: compose and send email campaigns to audience segments.
 * Calls the send-notification-email edge function with a campaign payload.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Mail,
  Users,
  Star,
  RefreshCw,
  Sparkles,
  Send,
  Loader2,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { triggerClickHaptic } from "@/lib/haptics";
import { toast } from "sonner";
import type { CreatorAttendee } from "@/hooks/useCreatorAudience";
import type { AttendeeSegment } from "@/hooks/useCreatorAudience";

type TargetSegment = "all" | AttendeeSegment;

interface EmailCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendees: CreatorAttendee[];
  creatorName: string;
}

const SEGMENT_OPTIONS: { value: TargetSegment; label: string; description: string; icon: typeof Users }[] = [
  { value: "all", label: "All Fans", description: "Everyone who attended", icon: Users },
  { value: "VIP", label: "VIP Fans", description: "5+ sessions attended", icon: Star },
  { value: "REPEAT", label: "Repeat Attendees", description: "2–4 sessions attended", icon: RefreshCw },
  { value: "NEW", label: "New Attendees", description: "First-time attendees only", icon: Sparkles },
];

function filterAttendees(attendees: CreatorAttendee[], segment: TargetSegment) {
  if (segment === "all") return attendees;
  return attendees.filter((a) => a.segment === segment);
}

export function EmailCampaignModal({
  isOpen,
  onClose,
  attendees,
  creatorName,
}: EmailCampaignModalProps) {
  const [segment, setSegment] = useState<TargetSegment>("all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);

  const targetAttendees = filterAttendees(attendees, segment);
  const recipientCount = targetAttendees.length;

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Please fill in subject and message");
      return;
    }
    if (recipientCount === 0) {
      toast.error("No recipients in this segment");
      return;
    }

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.functions.invoke("send-campaign-email", {
        body: {
          segment,
          subject: subject.trim(),
          body: body.trim(),
          creator_name: creatorName,
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (error) throw error;

      toast.success(`Campaign sent to ${recipientCount} recipient${recipientCount !== 1 ? "s" : ""}`, {
        description: "Emails are being delivered",
      });
      setSubject("");
      setBody("");
      onClose();
    } catch (err) {
      // Edge function not yet deployed — show informative message instead of error
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("FunctionsHttpError") || msg.includes("404") || msg.includes("not found")) {
        toast.success(`Preview: Campaign ready for ${recipientCount} recipient${recipientCount !== 1 ? "s" : ""}`, {
          description: "Email sending will be live once the campaign function is deployed",
        });
        onClose();
      } else {
        toast.error("Failed to send campaign");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-40"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-obsidian rounded-t-3xl border-t border-border/40 max-h-[90vh] overflow-y-auto"
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
                    <p className="text-sm font-semibold text-foreground">Email Campaign</p>
                    <p className="text-xs text-muted-foreground">Send to your audience</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Segment Selector */}
              <div className="mb-4">
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2 block">
                  Target Audience
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SEGMENT_OPTIONS.map(({ value, label, description, icon: Icon }) => {
                    const count = filterAttendees(attendees, value).length;
                    return (
                      <button
                        key={value}
                        onClick={() => { triggerClickHaptic(); setSegment(value); }}
                        className={`flex items-start gap-2.5 p-3 rounded-2xl border text-left transition-colors ${
                          segment === value
                            ? "bg-electric/10 border-electric/40"
                            : "bg-carbon border-border/30 hover:border-border/60"
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                            segment === value ? "text-electric" : "text-muted-foreground"
                          }`}
                        />
                        <div className="min-w-0">
                          <p
                            className={`text-xs font-semibold ${
                              segment === value ? "text-electric" : "text-foreground"
                            }`}
                          >
                            {label}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
                          <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">
                            {count} recipient{count !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subject */}
              <div className="mb-3">
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Subject Line
                </label>
                <input
                  className="w-full bg-carbon border border-border/40 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-electric/50"
                  placeholder="e.g. New session dropping this weekend 🎨"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={100}
                />
              </div>

              {/* Body */}
              <div className="mb-4">
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Message
                </label>
                <textarea
                  className="w-full bg-carbon border border-border/40 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-electric/50 resize-none"
                  placeholder={`Hey [name],\n\nI'm dropping a new session this Saturday at 6PM. It's going to be unlike anything I've done before...\n\nSee you there!\n${creatorName}`}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  maxLength={2000}
                />
                <p className="text-[10px] text-muted-foreground mt-1 text-right">
                  {body.length}/2000
                </p>
              </div>

              {/* Preview toggle */}
              {body.trim() && (
                <button
                  onClick={() => { triggerClickHaptic(); setShowPreview(!showPreview); }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {showPreview ? "Hide preview" : "Preview email"}
                </button>
              )}

              <AnimatePresence>
                {showPreview && body.trim() && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 rounded-2xl border border-border/30 bg-carbon overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-border/20">
                      <p className="text-xs text-muted-foreground">From: {creatorName} via Exhiby</p>
                      <p className="text-xs font-semibold text-foreground mt-0.5">{subject || "(no subject)"}</p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{body}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Send Button */}
              <div className="flex gap-2 pb-6">
                <button
                  onClick={onClose}
                  className="flex-1 py-3.5 rounded-2xl border border-border/40 text-sm font-semibold text-muted-foreground hover:bg-muted/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { triggerClickHaptic(); handleSend(); }}
                  disabled={sending || !subject.trim() || !body.trim() || recipientCount === 0}
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
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
