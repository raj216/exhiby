/**
 * ProAnalyticsDashboard
 * Advanced analytics for Pro/Plus plan creators.
 * Features: Revenue Trend, Session Performance Table, Audience Breakdown,
 * Dynamic Pricing Insights, Conversion Funnel.
 */

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Target,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Lightbulb,
  Copy,
  BarChart2,
} from "lucide-react";
import { toast } from "sonner";
import { triggerClickHaptic } from "@/lib/haptics";
import type { EarningRecord } from "@/hooks/useCreatorEarnings";
import type { CreatorAttendee } from "@/hooks/useCreatorAudience";

interface ProAnalyticsDashboardProps {
  transactions: EarningRecord[];
  attendees: CreatorAttendee[];
  showEarnings: boolean;
  profileSlug?: string;
}

// ── Revenue helpers ────────────────────────────────────────────────────────────

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

// ── Session Performance (Feature 3) ───────────────────────────────────────────

type SortColumn = "title" | "date" | "attendees" | "revenue" | "avgPrice";
type SortDir = "asc" | "desc";

interface SessionRow {
  eventId: string;
  title: string;
  date: string;
  attendees: number;
  revenue: number;   // cents
  avgPrice: number;  // cents
}

function buildSessionRows(transactions: EarningRecord[]): SessionRow[] {
  return transactions
    .filter((t) => t.type === "ticket")
    .map((t) => ({
      eventId: t.event_id,
      title: t.event_title,
      date: t.session_date, // use the session's scheduled_at, not purchase timestamp
      attendees: t.ticket_count,
      revenue: t.amount_net,
      avgPrice: t.ticket_count > 0 ? Math.round(t.amount_gross / t.ticket_count) : 0,
    }));
}

function computeSessionInsight(rows: SessionRow[]): string | null {
  if (rows.length < 3) return null;

  const weekendRows = rows.filter((r) => {
    const day = new Date(r.date).getDay();
    return day === 0 || day === 6;
  });
  const weekdayRows = rows.filter((r) => {
    const day = new Date(r.date).getDay();
    return day > 0 && day < 6;
  });

  if (weekendRows.length > 0 && weekdayRows.length > 0) {
    const weekendAvg = weekendRows.reduce((s, r) => s + r.revenue, 0) / weekendRows.length;
    const weekdayAvg = weekdayRows.reduce((s, r) => s + r.revenue, 0) / weekdayRows.length;
    if (weekdayAvg > 0) {
      const pct = Math.round(((weekendAvg - weekdayAvg) / weekdayAvg) * 100);
      if (pct > 10) return `Weekend sessions earn ${pct}% more than weekdays.`;
      if (pct < -10) return `Weekday sessions earn ${Math.abs(pct)}% more than weekend sessions.`;
    }
  }

  // Best price by attendance
  const priceGroups = new Map<number, number[]>();
  for (const r of rows) {
    const price = Math.round(r.avgPrice / 100);
    if (!priceGroups.has(price)) priceGroups.set(price, []);
    priceGroups.get(price)!.push(r.attendees);
  }
  if (priceGroups.size > 1) {
    let bestPrice = 0;
    let bestAvg = 0;
    for (const [price, list] of priceGroups) {
      if (price > 0 && list.length > 0) {
        const avg = list.reduce((s, n) => s + n, 0) / list.length;
        if (avg > bestAvg) { bestAvg = avg; bestPrice = price; }
      }
    }
    if (bestPrice > 0) return `Your $${bestPrice} sessions have the highest attendance.`;
  }

  return null;
}

// ── Pricing Insights (Feature 1) ──────────────────────────────────────────────

function computeDynamicPricingInsights(
  transactions: EarningRecord[],
  attendees: CreatorAttendee[]
): string[] {
  const ticketSessions = transactions.filter((t) => t.type === "ticket" && t.ticket_count > 0);
  const insights: string[] = [];

  // Insight 1: price vs revenue (3+ sessions)
  if (ticketSessions.length >= 3) {
    const priceGroups = new Map<number, { totalRevenue: number; count: number }>();
    for (const s of ticketSessions) {
      const price = Math.round(s.amount_gross / s.ticket_count / 100);
      const g = priceGroups.get(price) ?? { totalRevenue: 0, count: 0 };
      priceGroups.set(price, { totalRevenue: g.totalRevenue + s.amount_net, count: g.count + 1 });
    }
    let bestPrice = 0;
    let bestAvg = 0;
    for (const [price, { totalRevenue, count }] of priceGroups) {
      if (price > 0) {
        const avg = totalRevenue / count;
        if (avg > bestAvg) { bestAvg = avg; bestPrice = price; }
      }
    }
    if (bestPrice > 0) {
      insights.push(`Sessions priced at $${bestPrice} generated your highest revenue per session.`);
    }
  }

  // Insight 2: day-of-week performance (5+ sessions) — use SESSION date, not purchase date
  if (ticketSessions.length >= 5) {
    const dayStats = Array.from({ length: 7 }, () => ({ revenue: 0, count: 0 }));
    for (const s of ticketSessions) {
      const day = new Date(s.session_date).getDay();
      dayStats[day].revenue += s.amount_net;
      dayStats[day].count += 1;
    }

    const weekendRevenue = dayStats[0].revenue + dayStats[6].revenue;
    const weekendCount = dayStats[0].count + dayStats[6].count;
    const weekdayRevenue = dayStats.slice(1, 6).reduce((s, d) => s + d.revenue, 0);
    const weekdayCount = dayStats.slice(1, 6).reduce((s, d) => s + d.count, 0);

    if (weekendCount > 0 && weekdayCount > 0) {
      const weekendAvg = weekendRevenue / weekendCount;
      const weekdayAvg = weekdayRevenue / weekdayCount;
      if (weekdayAvg > 0) {
        const outperformPct = ((weekendAvg - weekdayAvg) / weekdayAvg) * 100;
        if (outperformPct > 20) {
          const sunAvg = dayStats[0].count > 0 ? dayStats[0].revenue / dayStats[0].count : 0;
          const satAvg = dayStats[6].count > 0 ? dayStats[6].revenue / dayStats[6].count : 0;
          const bestDay = sunAvg > satAvg ? "Sunday" : "Saturday";
          const pct = Math.round(outperformPct);
          insights.push(
            `Your ${bestDay} sessions fill ${pct}% faster than weekday sessions. Consider scheduling more on ${bestDay}.`
          );
        }
      }
    }
  }

  // Insight 3: repeat audience signal
  const totalA = attendees.length;
  const repeatA = attendees.filter((a) => a.segment !== "NEW").length;
  if (totalA >= 5 && repeatA / totalA > 0.3) {
    insights.push(
      "Your repeat audience suggests strong demand — try increasing your ticket price by $5–$10."
    );
  }

  return insights;
}

// ── Tooltip + MoM badge ────────────────────────────────────────────────────────

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
  // First-time revenue: show a celebration pill instead of a percentage
  if (previous === 0) {
    if (current === 0) return null;
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full text-emerald-400 bg-emerald-400/10">
        <ArrowUpRight className="w-3 h-3" />
        New
      </span>
    );
  }
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

// ── Session Performance Table (Feature 3) ─────────────────────────────────────

function SortIcon({ column, active, dir }: { column: string; active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="w-3 h-3 text-muted-foreground/40 ml-0.5" />;
  return dir === "asc"
    ? <ChevronUp className="w-3 h-3 text-electric ml-0.5" />
    : <ChevronDown className="w-3 h-3 text-electric ml-0.5" />;
}

interface SessionTableProps {
  rows: SessionRow[];
  showEarnings: boolean;
}

function SessionPerformanceTable({ rows, showEarnings }: SessionTableProps) {
  const [sortCol, setSortCol] = useState<SortColumn>("revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (col: SortColumn) => {
    triggerClickHaptic();
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let aVal: string | number = a[sortCol];
      let bVal: string | number = b[sortCol];
      if (sortCol === "date") {
        aVal = new Date(a.date).getTime();
        bVal = new Date(b.date).getTime();
      }
      if (typeof aVal === "string") return sortDir === "asc" ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [rows, sortCol, sortDir]);

  // Badge targets
  const bestRevenueId = rows.length > 0 ? rows.reduce((a, b) => (b.revenue > a.revenue ? b : a)).eventId : "";
  const mostAttendedId = rows.length > 0 ? rows.reduce((a, b) => (b.attendees > a.attendees ? b : a)).eventId : "";

  const insight = useMemo(() => computeSessionInsight(rows), [rows]);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 bg-obsidian rounded-2xl border border-border/30">
        <BarChart2 className="w-8 h-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground text-center px-6">
          Your session performance will appear here after your first paid session.
        </p>
      </div>
    );
  }

  const col = (label: string, key: SortColumn, align: "left" | "right" = "right") => (
    <button
      onClick={() => handleSort(key)}
      className={`flex items-center gap-0.5 text-[10px] text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors ${
        align === "right" ? "ml-auto" : ""
      }`}
    >
      {label}
      <SortIcon column={key} active={sortCol === key} dir={sortDir} />
    </button>
  );

  return (
    <div className="bg-obsidian rounded-2xl border border-border/30 overflow-hidden">
      {/* Table header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-electric" />
          <h3 className="text-sm font-semibold text-foreground">Session Performance</h3>
        </div>
        <span className="text-xs text-muted-foreground">{rows.length} sessions</span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-4 py-2 border-b border-border/10">
        <div className="flex items-center">{col("Session", "title", "left")}</div>
        <div className="flex items-center justify-end">{col("Attendees", "attendees")}</div>
        <div className="flex items-center justify-end">{col("Revenue", "revenue")}</div>
        <div className="hidden sm:flex items-center justify-end">{col("Avg Price", "avgPrice")}</div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/10">
        {sorted.map((row, i) => {
          const isBestRevenue = row.eventId === bestRevenueId;
          const isMostAttended = row.eventId === mostAttendedId;
          return (
            <motion.div
              key={row.eventId}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-4 py-3 items-center"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{row.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(row.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  {isBestRevenue && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide bg-rose-500/15 text-rose-400 border border-rose-500/25">
                      Best Revenue
                    </span>
                  )}
                  {isMostAttended && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide bg-muted/40 text-muted-foreground border border-border/30">
                      Most Attended
                    </span>
                  )}
                </div>
              </div>

              <p className="text-sm font-semibold text-foreground text-right tabular-nums">
                {row.attendees}
              </p>

              <p className="text-sm font-semibold text-gold text-right tabular-nums">
                {showEarnings ? `$${(row.revenue / 100).toFixed(0)}` : "••••"}
              </p>

              <p className="hidden sm:block text-sm text-muted-foreground text-right tabular-nums">
                {row.avgPrice > 0 ? `$${(row.avgPrice / 100).toFixed(0)}` : "Free"}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Insight line */}
      {insight && (
        <div className="px-4 py-3 border-t border-border/15 flex items-start gap-2">
          <Lightbulb className="w-3.5 h-3.5 text-gold flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">{insight}</p>
        </div>
      )}
    </div>
  );
}

// ── Conversion Funnel (Feature 2) ─────────────────────────────────────────────

interface FunnelStage {
  label: string;
  value: number | null; // null = gathering data
  benchmark?: number;   // platform avg conversion rate to this stage (0-1)
  conversionFromPrev?: number | null; // actual conversion rate from prev stage
}

const BENCHMARKS = {
  profileToSession: 0.40,
  sessionToCheckout: 0.30,
  checkoutToPurchase: 0.60,
  purchaseToAttended: 0.90,
};

function ConversionFunnel({
  purchasedCount,
  totalAttendances,
  profileSlug,
}: {
  /** Total tickets sold across all paid sessions */
  purchasedCount: number;
  /** Sum of attendees.sessionsAttended — total times anyone joined a session
   *  (apples-to-apples with purchasedCount: both at the per-attendance level) */
  totalAttendances: number;
  profileSlug?: string;
}) {
  const handleCopyLink = () => {
    const link = profileSlug
      ? `${window.location.origin}/${profileSlug}`
      : window.location.origin;
    navigator.clipboard.writeText(link).then(() => {
      toast.success("Profile link copied");
    });
  };

  const hasData = purchasedCount > 0;

  if (!hasData) {
    return (
      <div className="bg-obsidian rounded-2xl border border-border/30 p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-electric" />
          <h3 className="text-sm font-semibold text-foreground">Conversion Funnel</h3>
        </div>
        <div className="flex flex-col items-center py-4 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Share your profile link to start tracking your funnel.
          </p>
          <button
            onClick={() => { triggerClickHaptic(); handleCopyLink(); }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-electric/15 border border-electric/30 text-xs font-semibold text-electric hover:bg-electric/25 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy Profile Link
          </button>
        </div>
      </div>
    );
  }

  // Cap at 1.0 — if attendances > purchases (e.g. free attendees joined paid sessions),
  // the rate caps at 100% rather than showing nonsense like 150%.
  const rawRate = purchasedCount > 0 ? totalAttendances / purchasedCount : 0;
  const purchaseToAttended = Math.min(rawRate, 1);
  const isAboveAttendBenchmark = purchaseToAttended >= BENCHMARKS.purchaseToAttended;

  const stages: { label: string; value: string; note: string | null; dropoff: string | null; aboveBenchmark: boolean | null; tip: string | null }[] = [
    {
      label: "Profile Visits",
      value: "Gathering data...",
      note: null,
      dropoff: null,
      aboveBenchmark: null,
      tip: null,
    },
    {
      label: "Session Page Views",
      value: "Gathering data...",
      note: null,
      dropoff: null,
      aboveBenchmark: null,
      tip: null,
    },
    {
      label: "Checkout Started",
      value: "Gathering data...",
      note: null,
      dropoff: null,
      aboveBenchmark: null,
      tip: null,
    },
    {
      label: "Ticket Purchased",
      value: purchasedCount.toLocaleString(),
      note: `Platform avg: ~${Math.round(BENCHMARKS.checkoutToPurchase * 100)}% from checkout`,
      dropoff: null,
      aboveBenchmark: null,
      tip: null,
    },
    {
      label: "Session Attended",
      value: totalAttendances.toLocaleString(),
      note: `Platform avg: ~${Math.round(BENCHMARKS.purchaseToAttended * 100)}% of buyers attend`,
      dropoff: purchasedCount > 0
        ? `↓ ${Math.round((1 - purchaseToAttended) * 100)}% drop-off`
        : null,
      aboveBenchmark: isAboveAttendBenchmark,
      tip: !isAboveAttendBenchmark
        ? "Try sending a reminder 30 mins before your session starts."
        : null,
    },
  ];

  return (
    <div className="bg-obsidian rounded-2xl border border-border/30 p-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-electric" />
        <h3 className="text-sm font-semibold text-foreground">Conversion Funnel</h3>
      </div>

      {/* Bar widths: stages 1-3 are aspirational (hint at funnel shape while data is gathered).
          Stages 4-5 use REAL counts. Stage 4 (Ticket Purchased) is the largest known value.
          Stage 5 (Attended) shrinks proportionally to its conversion rate from stage 4. */}
      <div className="space-y-1">
        {stages.map((stage, i) => {
          const isGathering = stage.value === "Gathering data...";
          const stage4Width = 60; // visual width when data exists
          const barWidth = isGathering
            ? 100 - i * 14    // 100, 86, 72 — hints at narrowing funnel
            : i === 3
            ? stage4Width      // ticket purchased baseline
            : i === 4
            ? Math.max(8, Math.round(purchaseToAttended * stage4Width))
            : 100;

          return (
            <div key={stage.label} className="space-y-1">
              {/* Drop-off line */}
              {stage.dropoff && (
                <p className="text-[10px] text-muted-foreground/60 pl-2 py-0.5">
                  {stage.dropoff}
                </p>
              )}

              <div className="rounded-xl bg-carbon/60 border border-border/20 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-foreground">{stage.label}</span>
                  <span className={`text-xs font-semibold tabular-nums ${isGathering ? "text-muted-foreground/50 italic" : "text-foreground"}`}>
                    {stage.value}
                  </span>
                </div>

                {/* Bar */}
                <div className="h-1 rounded-full bg-border/20 overflow-hidden mb-1.5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                    className={`h-full rounded-full ${
                      isGathering
                        ? "bg-border/40"
                        : i <= 2
                        ? "bg-border/40"
                        : i === 3
                        ? "bg-electric"
                        : "bg-gold"
                    }`}
                  />
                </div>

                {/* Note + badge */}
                {stage.note && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground/60">{stage.note}</span>
                    {stage.aboveBenchmark === true && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                        Above avg
                      </span>
                    )}
                    {stage.aboveBenchmark === false && stage.tip && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25">
                        {stage.tip}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground/40 mt-3 text-center">
        Profile visit tracking will fill in stages 1–3 automatically
      </p>
    </div>
  );
}

// ── Colors ─────────────────────────────────────────────────────────────────────

const ELECTRIC_COLOR = "hsl(7 100% 67%)";
const GOLD_COLOR = "hsl(45 100% 60%)";

// ── Main component ─────────────────────────────────────────────────────────────

export function ProAnalyticsDashboard({
  transactions,
  attendees,
  showEarnings,
  profileSlug,
}: ProAnalyticsDashboardProps) {
  const monthlyRevenue = useMemo(() => buildMonthlyRevenue(transactions, 6), [transactions]);
  const sessionRows = useMemo(() => buildSessionRows(transactions), [transactions]);
  const pricingInsights = useMemo(
    () => computeDynamicPricingInsights(transactions, attendees),
    [transactions, attendees]
  );

  const currentMonthRevenue = monthlyRevenue[monthlyRevenue.length - 1]?.revenue ?? 0;
  const prevMonthRevenue = monthlyRevenue[monthlyRevenue.length - 2]?.revenue ?? 0;

  const vipCount = attendees.filter((a) => a.segment === "VIP").length;
  const repeatCount = attendees.filter((a) => a.segment === "REPEAT").length;
  const newCount = attendees.filter((a) => a.segment === "NEW").length;
  const totalAttendees = attendees.length;

  const segmentPct = (n: number) =>
    totalAttendees > 0 ? Math.round((n / totalAttendees) * 100) : 0;

  const hasRevenue = transactions.length > 0;
  const maxBarRevenue = Math.max(...monthlyRevenue.map((m) => m.revenue), 1);

  // Funnel data — both metrics measured at the per-attendance level for valid comparison
  const purchasedCount = useMemo(
    () => transactions.filter((t) => t.type === "ticket").reduce((s, t) => s + t.ticket_count, 0),
    [transactions]
  );
  const totalAttendances = useMemo(
    () => attendees.reduce((s, a) => s + (a.sessionsAttended || 0), 0),
    [attendees]
  );

  // Number of paid sessions — used for "Avg per paid session" instead of dividing
  // by all hosted sessions (which includes free ones)
  const paidSessionCount = useMemo(
    () => new Set(transactions.filter((t) => t.type === "ticket").map((t) => t.event_id)).size,
    [transactions]
  );
  const totalPaidNet = useMemo(
    () => transactions.filter((t) => t.type === "ticket").reduce((s, t) => s + t.amount_net, 0),
    [transactions]
  );
  const avgPerPaidSession = paidSessionCount > 0 ? totalPaidNet / paidSessionCount : 0;

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
              <p
                className="font-display text-2xl text-electric"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {showEarnings ? `$${(currentMonthRevenue / 100).toFixed(2)}` : "••••"}
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
                    fillOpacity={i === monthlyRevenue.length - 1 ? 1 : 0.55}
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

      {/* Session Performance Table — Feature 3 (replaces redundant Top Sessions card) */}
      <SessionPerformanceTable rows={sessionRows} showEarnings={showEarnings} />

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

      {/* Pricing Insights — Feature 1 */}
      <div className="bg-obsidian rounded-2xl border border-border/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-gold" />
          <h3 className="text-sm font-semibold text-foreground">Pricing Insights</h3>
        </div>

        {pricingInsights.length > 0 ? (
          <div className="space-y-2">
            {pricingInsights.map((insight, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-electric/5 border border-electric/15"
              >
                <Lightbulb className="w-3.5 h-3.5 text-electric flex-shrink-0 mt-0.5" />
                <p className="text-xs text-electric/80 leading-relaxed">{insight}</p>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="px-3 py-3 rounded-xl bg-muted/20 border border-border/20">
            <p className="text-xs text-muted-foreground/60 text-center">
              Insights appear after 3+ completed paid sessions.
            </p>
          </div>
        )}
      </div>

      {/* Conversion Funnel — Feature 2 */}
      <ConversionFunnel
        purchasedCount={purchasedCount}
        totalAttendances={totalAttendances}
        profileSlug={profileSlug}
      />
    </motion.div>
  );
}
