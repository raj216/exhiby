/**
 * ProAnalyticsDashboard
 * Advanced analytics for Pro/Plus plan creators.
 * Shown inside the Analytics tab, gated behind hasAdvancedAnalytics.
 */

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { motion } from "framer-motion";
import { TrendingUp, Award, Target, Users, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type { EarningRecord } from "@/hooks/useCreatorEarnings";
import type { CreatorAttendee } from "@/hooks/useCreatorAudience";

interface ProAnalyticsDashboardProps {
  transactions: EarningRecord[];
  attendees: CreatorAttendee[];
  showEarnings: boolean;
}

// Build last-N-months labels and map transaction data into them
function buildMonthlyRevenue(transactions: EarningRecord[], months = 6) {
  const now = new Date();
  const result: { month: string; revenue: number; tickets: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    result.push({
      month: d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
      revenue: 0,
      tickets: 0,
    });
  }

  for (const tx of transactions) {
    const txDate = new Date(tx.created_at);
    const txYear = txDate.getUTCFullYear();
    const txMonth = txDate.getUTCMonth();

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      if (d.getUTCFullYear() === txYear && d.getUTCMonth() === txMonth) {
        result[months - 1 - i].revenue += tx.amount_net;
        result[months - 1 - i].tickets += tx.ticket_count || 0;
        break;
      }
    }
  }
  return result;
}

// Top sessions by net earnings
function buildSessionRankings(transactions: EarningRecord[]) {
  const map = new Map<string, { title: string; net: number; tickets: number; date: string }>();
  for (const tx of transactions) {
    const existing = map.get(tx.event_id);
    if (existing) {
      existing.net += tx.amount_net;
      existing.tickets += tx.ticket_count || 0;
    } else {
      map.set(tx.event_id, {
        title: tx.event_title,
        net: tx.amount_net,
        tickets: tx.ticket_count || 0,
        date: tx.created_at,
      });
    }
  }
  return [...map.values()]
    .sort((a, b) => b.net - a.net)
    .slice(0, 5);
}

// Avg price per ticket across all sessions
function computePricingInsights(transactions: EarningRecord[]) {
  const paid = transactions.filter((t) => t.ticket_count > 0);
  if (paid.length === 0) return null;

  const totalRevenue = paid.reduce((s, t) => s + t.amount_gross, 0);
  const totalTickets = paid.reduce((s, t) => s + t.ticket_count, 0);
  const avgPricePerTicket = totalTickets > 0 ? totalRevenue / totalTickets : 0;

  // Group by event to find price distribution
  const sessionRevenues = buildSessionRankings(paid).map((s) => s.net);
  const maxNet = Math.max(...sessionRevenues, 0);
  const minNet = Math.min(...sessionRevenues, 0);

  return { avgPricePerTicket, totalRevenue, totalTickets, maxNet, minNet };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  showEarnings: boolean;
}

function CustomTooltip({ active, payload, label, showEarnings }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  return (
    <div className="bg-obsidian border border-border/50 rounded-xl px-3 py-2 shadow-deep">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-electric">
        {showEarnings ? `$${(val / 100).toFixed(2)}` : "••••"}
      </p>
    </div>
  );
}

function MoMBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const up = pct >= 0;
  const Icon = pct === 0 ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
        up ? "text-emerald-400 bg-emerald-400/10" : "text-rose-400 bg-rose-400/10"
      }`}
    >
      <Icon className="w-3 h-3" />
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

const ELECTRIC_COLOR = "hsl(7 100% 67%)";
const GOLD_COLOR = "hsl(45 100% 60%)";

export function ProAnalyticsDashboard({
  transactions,
  attendees,
  showEarnings,
}: ProAnalyticsDashboardProps) {
  const monthlyRevenue = useMemo(() => buildMonthlyRevenue(transactions, 6), [transactions]);
  const sessionRankings = useMemo(() => buildSessionRankings(transactions), [transactions]);
  const pricingInsights = useMemo(() => computePricingInsights(transactions), [transactions]);

  const currentMonthRevenue = monthlyRevenue[monthlyRevenue.length - 1]?.revenue ?? 0;
  const prevMonthRevenue = monthlyRevenue[monthlyRevenue.length - 2]?.revenue ?? 0;

  // Audience segment breakdown
  const vipCount = attendees.filter((a) => a.segment === "VIP").length;
  const repeatCount = attendees.filter((a) => a.segment === "REPEAT").length;
  const newCount = attendees.filter((a) => a.segment === "NEW").length;
  const totalAttendees = attendees.length;

  const segmentPct = (n: number) =>
    totalAttendees > 0 ? Math.round((n / totalAttendees) * 100) : 0;

  const hasRevenue = transactions.length > 0;
  const maxBarRevenue = Math.max(...monthlyRevenue.map((m) => m.revenue), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mt-4 space-y-4"
    >
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full bg-gradient-to-b from-electric to-crimson" />
        <h3 className="text-sm font-bold text-foreground tracking-wide uppercase">
          Pro Analytics
        </h3>
      </div>

      {/* Revenue Trend — 6-month bar chart */}
      <div className="bg-obsidian rounded-2xl border border-electric/20 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Revenue Trend
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="font-display text-2xl text-electric" style={{ fontVariantNumeric: "tabular-nums" }}>
                {showEarnings
                  ? `$${(currentMonthRevenue / 100).toFixed(2)}`
                  : "••••"}
              </p>
              <MoMBadge current={currentMonthRevenue} previous={prevMonthRevenue} />
            </div>
            <p className="text-[11px] text-muted-foreground">this month · vs last month</p>
          </div>
          <TrendingUp className="w-5 h-5 text-electric opacity-60" />
        </div>

        {hasRevenue ? (
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={monthlyRevenue} barSize={28}>
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis hide />
              <Tooltip
                content={<CustomTooltip showEarnings={showEarnings} />}
                cursor={{ fill: "hsl(var(--border) / 0.15)", radius: 6 }}
              />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                {monthlyRevenue.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={
                      entry.revenue === maxBarRevenue && entry.revenue > 0
                        ? GOLD_COLOR
                        : entry.revenue > 0
                        ? ELECTRIC_COLOR
                        : "hsl(var(--border) / 0.4)"
                    }
                    fillOpacity={
                      i === monthlyRevenue.length - 1 ? 1 : 0.55
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[120px] flex items-center justify-center">
            <p className="text-xs text-muted-foreground/60">
              Revenue chart appears after your first paid session
            </p>
          </div>
        )}
      </div>

      {/* Session Performance Rankings */}
      <div className="bg-obsidian rounded-2xl border border-border/30 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-gold" />
            <h3 className="text-sm font-semibold text-foreground">Top Sessions</h3>
          </div>
          <span className="text-xs text-muted-foreground">by earnings</span>
        </div>

        {sessionRankings.length > 0 ? (
          <div className="divide-y divide-border/20">
            {sessionRankings.map((session, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    i === 0
                      ? "bg-gold/20 text-gold"
                      : i === 1
                      ? "bg-electric/20 text-electric"
                      : i === 2
                      ? "bg-muted/40 text-muted-foreground"
                      : "text-muted-foreground/50"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{session.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {session.tickets} ticket{session.tickets !== 1 ? "s" : ""}
                  </p>
                </div>
                <p
                  className="text-sm font-semibold text-gold flex-shrink-0"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {showEarnings ? `$${(session.net / 100).toFixed(2)}` : "••••"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-muted-foreground/60">
              Session rankings appear after your first paid session
            </p>
          </div>
        )}
      </div>

      {/* Audience Breakdown */}
      <div className="bg-obsidian rounded-2xl border border-border/30 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-electric" />
          <h3 className="text-sm font-semibold text-foreground">Audience Breakdown</h3>
          <span className="text-xs text-muted-foreground ml-auto">{totalAttendees} total</span>
        </div>

        <div className="space-y-3">
          {[
            { label: "VIP Fans", count: vipCount, pct: segmentPct(vipCount), color: "bg-gold", textColor: "text-gold" },
            { label: "Repeat Attendees", count: repeatCount, pct: segmentPct(repeatCount), color: "bg-electric", textColor: "text-electric" },
            { label: "New Attendees", count: newCount, pct: segmentPct(newCount), color: "bg-muted-foreground/40", textColor: "text-muted-foreground" },
          ].map(({ label, count, pct, color, textColor }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{label}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${textColor}`}>{count}</span>
                  <span className="text-xs text-muted-foreground/60">({pct}%)</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-border/30 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                  className={`h-full rounded-full ${color}`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing Optimization */}
      {pricingInsights && (
        <div className="bg-obsidian rounded-2xl border border-border/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-gold" />
            <h3 className="text-sm font-semibold text-foreground">Pricing Insights</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Avg Price / Ticket</p>
              <p className="font-display text-xl text-gold" style={{ fontVariantNumeric: "tabular-nums" }}>
                {showEarnings
                  ? `$${(pricingInsights.avgPricePerTicket / 100).toFixed(2)}`
                  : "••••"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Tickets Sold</p>
              <p className="font-display text-xl text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
                {pricingInsights.totalTickets}
              </p>
            </div>
          </div>
          {pricingInsights.avgPricePerTicket > 0 && (
            <div className="mt-3 px-3 py-2 rounded-xl bg-electric/5 border border-electric/15">
              <p className="text-xs text-electric/80">
                {pricingInsights.avgPricePerTicket < 1500
                  ? "💡 Try increasing your ticket price by $5–$10 — your repeat audience suggests strong demand."
                  : pricingInsights.avgPricePerTicket > 5000
                  ? "🎯 Premium pricing detected — consider adding a free tier to grow your audience."
                  : "✅ Your pricing is in a healthy range for live studio sessions."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Conversion Funnel */}
      {totalAttendees > 0 && (
        <div className="bg-obsidian rounded-2xl border border-border/30 p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-electric" />
            <h3 className="text-sm font-semibold text-foreground">Retention Funnel</h3>
          </div>
          <div className="space-y-2">
            {[
              { label: "Attended at least once", value: totalAttendees, max: totalAttendees, color: "bg-muted-foreground/40" },
              { label: "Came back (2+ sessions)", value: repeatCount + vipCount, max: totalAttendees, color: "bg-electric" },
              { label: "Loyal fans (5+ sessions)", value: vipCount, max: totalAttendees, color: "bg-gold" },
            ].map(({ label, value, max, color }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[11px] text-muted-foreground">{label}</span>
                    <span className="text-[11px] font-semibold text-foreground">{value}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border/30 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }}
                      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                      className={`h-full rounded-full ${color}`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
