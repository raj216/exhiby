/**
 * AudienceTab
 * Premium audience analytics for creator dashboard.
 * Shows unique attendees, VIP fans, repeat stats + attendee table.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Star, RefreshCw, Mail, Lock, Loader2 } from "lucide-react";
import { triggerClickHaptic } from "@/lib/haptics";
import { useCreatorAudience, type CreatorAttendee } from "@/hooks/useCreatorAudience";
import { useNavigate } from "react-router-dom";
import type { PlanGateResult } from "@/hooks/usePlanGate";
import { AudienceEmailModal } from "./AudienceEmailModal";

interface AudienceTabProps {
  creatorId: string | undefined;
  planGate: PlanGateResult;
  creatorName?: string;
}

const SEGMENT_CONFIG = {
  VIP:    { label: "VIP",    bg: "bg-gold/15",     text: "text-gold",     border: "border-gold/30" },
  REPEAT: { label: "REPEAT", bg: "bg-electric/10", text: "text-electric", border: "border-electric/20" },
  NEW:    { label: "NEW",    bg: "bg-muted/40",    text: "text-muted-foreground", border: "border-border/30" },
};

function AttendeeRow({ attendee, index }: { attendee: CreatorAttendee; index: number }) {
  const seg = SEGMENT_CONFIG[attendee.segment];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center gap-3 py-3 border-b border-border/20 last:border-0"
    >
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-obsidian border border-border/40 overflow-hidden flex-shrink-0">
        {attendee.avatarUrl ? (
          <img src={attendee.avatarUrl} alt={attendee.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm font-bold text-muted-foreground">
            {attendee.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Name + last attended */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{attendee.name}</p>
        <p className="text-xs text-muted-foreground">
          Last: {attendee.lastAttended.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      </div>

      {/* Sessions count */}
      <div className="text-center hidden sm:block">
        <p className="text-sm font-semibold text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
          {attendee.sessionsAttended}
        </p>
        <p className="text-[10px] text-muted-foreground">sessions</p>
      </div>

      {/* Segment badge */}
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider border ${seg.bg} ${seg.text} ${seg.border}`}>
        {seg.label}
      </span>
    </motion.div>
  );
}

export function AudienceTab({ creatorId, planGate, creatorName = "Creator" }: AudienceTabProps) {
  const navigate = useNavigate();
  const { attendees, stats, isLoading } = useCreatorAudience(creatorId);
  const hasAdvancedAnalytics = planGate.can("hasAdvancedAnalytics");
  const [showEmailModal, setShowEmailModal] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Audience Stats - 3 KPI cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-obsidian rounded-xl p-3 border border-border/30 text-center">
          <p className="font-display text-xl text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
            {stats.uniqueAttendees}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Unique<br />Attendees</p>
        </div>
        <div className="bg-obsidian rounded-xl p-3 border border-gold/20 text-center">
          <p className="font-display text-xl text-gold" style={{ fontVariantNumeric: "tabular-nums" }}>
            {stats.vipFans}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">VIP Fans<br />(5+ sessions)</p>
        </div>
        <div className="bg-obsidian rounded-xl p-3 border border-electric/20 text-center">
          <p className="font-display text-xl text-electric" style={{ fontVariantNumeric: "tabular-nums" }}>
            {stats.uniqueAttendees > 0
              ? `${Math.round((stats.repeatAttendees / stats.uniqueAttendees) * 100)}%`
              : "0%"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Repeat<br />Rate</p>
        </div>
      </div>

      {/* Attendee Table */}
      {attendees.length > 0 ? (
        <div className="bg-obsidian rounded-2xl border border-border/30 overflow-hidden">
          {/* Table Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
            <h3 className="text-sm font-semibold text-foreground">Your Audience</h3>
            <span className="text-xs text-muted-foreground">{attendees.length} attendees</span>
          </div>
          <div className="px-4">
            {attendees.slice(0, 20).map((attendee, i) => (
              <AttendeeRow key={attendee.userId} attendee={attendee} index={i} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 bg-obsidian rounded-2xl border border-border/30">
          <Users className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No audience data yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1 text-center px-6">
            Audience stats appear after your first paid session
          </p>
        </div>
      )}

      {/* Email Your Audience — Pro feature or upsell */}
      {hasAdvancedAnalytics ? (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => { triggerClickHaptic(); setShowEmailModal(true); }}
          className="w-full rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/5 to-transparent p-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gold/15 flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Email Your Audience</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Send campaigns to {attendees.length} fan{attendees.length !== 1 ? "s" : ""} · VIP, Repeat, or All
              </p>
            </div>
            <RefreshCw className="w-4 h-4 text-gold/60 flex-shrink-0" />
          </div>
        </motion.button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/5 to-transparent p-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-gold/15 flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Email Your Audience</p>
                <Lock className="w-3 h-3 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Send newsletters, session announcements, and updates to all your fans with Pro.
              </p>
              <button
                onClick={() => { triggerClickHaptic(); navigate("/pricing"); }}
                className="mt-2.5 px-3 py-1.5 rounded-full bg-gold/15 text-gold text-xs font-semibold hover:bg-gold/25 transition-colors border border-gold/30"
              >
                Upgrade to Pro →
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Audience Email Modal */}
      <AudienceEmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        attendees={attendees}
        creatorName={creatorName}
      />
    </div>
  );
}
