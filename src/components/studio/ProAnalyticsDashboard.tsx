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
  Sparkles,
  Ticket,
  Calendar,
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
  /** True when the date fell back to purchase time (events.scheduled_at was null) */
  dateEstimated: boolean;
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
      dateEstimated: t.session_date_estimated,
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
                  {row.dateEstimated && (
                    <span
                      title="Session schedule wasn't recorded — using ticket purchase date instead."
                      className="px-1 py-0.5 rounded text-[8px] font-semibold tracking-wide bg-muted/40 text-muted-foreground/70 border border-border/30"
                    >
                      EST.
                    </span>
                  )}
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

  // Real conversion rate. We do NOT cap or floor it — surface the real number.
  // If attendance data is missing entirely (totalAttendances = 0 but purchases > 0)
  // we explain that separately rather than showing a misleading "100% drop-off".
  const rawRate = purchasedCount > 0 ? totalAttendances / purchasedCount : 0;
  const purchaseToAttended = rawRate;
  const hasAttendanceData = totalAttendances > 0;
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
      value: hasAttendanceData
        ? totalAttendances.toLocaleString()
        : "Not tracked yet",
      note: hasAttendanceData
        ? `Platform avg: ~${Math.round(BENCHMARKS.purchaseToAttended * 100)}% of buyers attend`
        : "Attendance is recorded when you mark check-ins on your live session.",
      dropoff: hasAttendanceData && purchasedCount > 0
        ? `↓ ${Math.round((1 - Math.min(purchaseToAttended, 1)) * 100)}% drop-off`
        : null,
      aboveBenchmark: hasAttendanceData ? isAboveAttendBenchmark : null,
      tip: hasAttendanceData && !isAboveAttendBenchmark
        ? "Try sending a reminder 30 mins before your session starts."
        : null,
    },
  ];

  // Stage helper text — explains what each empty stage measures
  const stageHelp: Record<string, string> = {
    "Profile Visits": "Tracks when someone lands on your studio link",
    "Session Page Views": "Tracks when someone opens a specific session page",
    "Checkout Started": "Tracks when someone clicks Buy Ticket",
  };

  return (
    <div className="bg-obsidian rounded-2xl border border-border/30 p-4">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="w-4 h-4 text-electric" />
        <h3 className="text-sm font-semibold text-foreground">Conversion Funnel</h3>
      </div>
      <p className="text-[11px] text-muted-foreground/60 mb-4">
        How visitors become attendees
      </p>

      {/* Visual funnel: stages 1-3 are aspirational widths (hint at funnel shape);
          stages 4-5 use REAL counts. Stage 5 width is proportional to conversion rate. */}
      <div className="space-y-1.5">
        {stages.map((stage, i) => {
          const isGathering = stage.value === "Gathering data...";
          const isAttendanceUntracked = i === 4 && !hasAttendanceData;
          const stage4Width = 65;
          // Bar width logic:
          //  • Gathering stages (1-3): aspirational taper (95%, 83%, 71%) hints at funnel
          //  • Stage 4 (purchases): fixed baseline width
          //  • Stage 5 (attendance): proportional to actual conversion, capped at 100%.
          //    If attendance hasn't been tracked at all → 0 (we hide the bar entirely)
          const barWidth = isGathering
            ? 95 - i * 12
            : i === 3
            ? stage4Width
            : i === 4
            ? isAttendanceUntracked
              ? 0
              : Math.round(Math.min(purchaseToAttended, 1) * stage4Width)
            : 100;

          const barBg = isGathering
            ? "bg-border/30"
            : i === 3
            ? "bg-gradient-to-r from-electric/80 to-electric"
            : "bg-gradient-to-r from-gold/80 to-gold";

          return (
            <div key={stage.label}>
              {/* Drop-off connector between stage 4 and 5 */}
              {stage.dropoff && (
                <div className="flex items-center justify-center py-1">
                  <span className="text-[10px] text-muted-foreground/50 italic">
                    {stage.dropoff}
                  </span>
                </div>
              )}

              {/* Funnel row — centered bar */}
              <div className="relative">
                <div className="flex items-center gap-3">
                  {/* Label column */}
                  <div className="w-[110px] flex-shrink-0">
                    <p className={`text-[12px] font-medium leading-tight ${isGathering ? "text-muted-foreground/60" : "text-foreground"}`}>
                      {stage.label}
                    </p>
                  </div>

                  {/* Bar (the funnel visual) — centered using flex */}
                  <div className="flex-1 flex justify-center">
                    <div className="w-full max-w-[300px] flex justify-center min-h-9 items-center">
                      {barWidth > 0 ? (
                        <motion.div
                          initial={{ width: 0, opacity: 0 }}
                          animate={{ width: `${barWidth}%`, opacity: 1 }}
                          transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                          className={`h-9 rounded-md ${barBg} flex items-center justify-center px-3`}
                        >
                          {!isGathering && (
                            <span className="text-xs font-bold text-white tabular-nums whitespace-nowrap">
                              {stage.value}
                            </span>
                          )}
                        </motion.div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/50 italic">
                          {stage.value}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Value column (right side, for gathering stages) */}
                  <div className="w-[60px] flex-shrink-0 text-right">
                    {isGathering && (
                      <span className="text-[10px] text-muted-foreground/40 italic">
                        Gathering
                      </span>
                    )}
                  </div>
                </div>

                {/* Helper line */}
                {isGathering && stageHelp[stage.label] && (
                  <p className="text-[10px] text-muted-foreground/40 mt-0.5 ml-[122px] leading-tight">
                    {stageHelp[stage.label]}
                  </p>
                )}

                {/* Benchmark + tip line */}
                {!isGathering && stage.note && (
                  <div className="ml-[122px] mt-1.5 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground/55">{stage.note}</span>
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

  // Funnel data — purchasedCount is paid tickets sold;
  // totalAttendances is REAL attendance (tickets with attended_at set), not ticket count
  const purchasedCount = useMemo(
    () => transactions.filter((t) => t.type === "ticket").reduce((s, t) => s + t.ticket_count, 0),
    [transactions]
  );
  const totalAttendances = useMemo(
    () => attendees.reduce((s, a) => s + (a.actualSessionsAttended || 0), 0),
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
      {/* ─── Section Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div>
          <h3 className="font-display text-base text-foreground tracking-tight">
            Studio Performance
          </h3>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">
            Insights into your studio's revenue, audience, and growth
          </p>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-electric/15 to-crimson/15 border border-electric/25 flex-shrink-0">
          <Sparkles className="w-2.5 h-2.5 text-electric" />
          <span className="text-[9px] font-bold tracking-[0.08em] text-electric uppercase">Pro</span>
        </span>
      </div>

      {/* ─── Hero Metric Card ────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-electric/20 p-5 bg-gradient-to-br from-electric/[0.06] via-obsidian to-obsidian">
        {/* Subtle glow */}
        <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-electric/10 blur-3xl pointer-events-none" />

        <div className="relative">
          {/* Eyebrow */}
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70 font-semibold">
            This month · revenue
          </p>

          {/* Hero number + MoM */}
          <div className="flex items-baseline gap-2.5 mt-1.5">
            <p
              className="font-display text-[40px] leading-none text-foreground"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {showEarnings ? `$${(currentMonthRevenue / 100).toFixed(2)}` : "••••"}
            </p>
            <MoMBadge current={currentMonthRevenue} previous={prevMonthRevenue} />
          </div>
          <p className="text-[11px] text-muted-foreground/60 mt-1">
            {prevMonthRevenue > 0
              ? `vs $${(prevMonthRevenue / 100).toFixed(2)} last month`
              : currentMonthRevenue > 0
              ? "First month earning revenue"
              : "No revenue yet this month"}
          </p>

          {/* Sparkline (6 months) */}
          {hasRevenue ? (
            <div className="mt-4 -ml-1">
              <ResponsiveContainer width="100%" height={72}>
                <BarChart data={monthlyRevenue} barSize={20}>
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground) / 0.6)" }}
                    interval={0}
                  />
                  <YAxis hide />
                  <Tooltip
                    content={<CustomTooltip showEarnings={showEarnings} />}
                    cursor={{ fill: "hsl(var(--border) / 0.15)", radius: 4 }}
                  />
                  <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                    {monthlyRevenue.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          entry.revenue === maxBarRevenue && entry.revenue > 0
                            ? GOLD_COLOR
                            : entry.revenue > 0
                            ? ELECTRIC_COLOR
                            : "hsl(var(--border) / 0.3)"
                        }
                        fillOpacity={i === monthlyRevenue.length - 1 ? 1 : 0.5}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-5 mb-1 h-[72px] rounded-xl border border-dashed border-border/30 flex items-center justify-center">
              <p className="text-[11px] text-muted-foreground/50">
                Revenue trend appears after your first paid session
              </p>
            </div>
          )}

          {/* Sub-KPIs */}
          <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-border/20">
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Ticket className="w-3 h-3 text-muted-foreground/60" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Tickets</p>
              </div>
              <p className="text-base font-bold text-foreground tabular-nums">
                {purchasedCount.toLocaleString()}
              </p>
            </div>
            <div className="border-l border-border/15 pl-2">
              <div className="flex items-center gap-1 mb-1">
                <Calendar className="w-3 h-3 text-muted-foreground/60" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Paid sessions</p>
              </div>
              <p className="text-base font-bold text-foreground tabular-nums">
                {paidSessionCount.toLocaleString()}
              </p>
            </div>
            <div className="border-l border-border/15 pl-2">
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp className="w-3 h-3 text-gold/80" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Avg / paid session</p>
              </div>
              <p className="text-base font-bold text-gold tabular-nums">
                {showEarnings
                  ? paidSessionCount > 0
                    ? `$${(avgPerPaidSession / 100).toFixed(2)}`
                    : "$0.00"
                  : "••••"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Insights (promoted) ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gold/20 p-4 bg-gradient-to-br from-gold/[0.04] to-transparent">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-4 h-4 text-gold" />
          <h3 className="text-sm font-semibold text-foreground">Smart Insights</h3>
          {pricingInsights.length > 0 && (
            <span className="ml-auto text-[10px] text-gold/80 font-semibold">
              {pricingInsights.length} {pricingInsights.length === 1 ? "insight" : "insights"}
            </span>
          )}
        </div>

        {pricingInsights.length > 0 ? (
          <div className="space-y-2">
            {pricingInsights.map((insight, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-obsidian/60 border border-gold/15"
              >
                <span className="w-5 h-5 rounded-full bg-gold/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Lightbulb className="w-2.5 h-2.5 text-gold" />
                </span>
                <p className="text-xs text-foreground/85 leading-relaxed">{insight}</p>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex items-start gap-3 px-3 py-3 rounded-xl bg-obsidian/40 border border-border/15">
            <Target className="w-4 h-4 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-foreground/80 font-medium">
                Insights unlock after 3 paid sessions
              </p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                We'll surface pricing suggestions, scheduling patterns, and audience signals once you've completed a few sessions.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Session Performance Table — Feature 3 (replaces redundant Top Sessions card) */}
      <SessionPerformanceTable rows={sessionRows} showEarnings={showEarnings} />

      {/* ─── Audience Breakdown ──────────────────────────────────────────── */}
      <div className="bg-obsidian rounded-2xl border border-border/30 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-electric" />
          <h3 className="text-sm font-semibold text-foreground">Audience Breakdown</h3>
          <span className="text-xs text-muted-foreground ml-auto tabular-nums">
            {totalAttendees} {totalAttendees === 1 ? "attendee" : "attendees"}
          </span>
        </div>

        {totalAttendees === 0 ? (
          <div className="py-6 text-center">
            <p className="text-xs text-muted-foreground/60">
              Your audience appears here after your first session.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {[
              { label: "VIP Fans", sub: "5+ sessions", count: vipCount, pct: segmentPct(vipCount), color: "bg-gold", textColor: "text-gold" },
              { label: "Repeat Attendees", sub: "2-4 sessions", count: repeatCount, pct: segmentPct(repeatCount), color: "bg-electric", textColor: "text-electric" },
              { label: "New Attendees", sub: "first session", count: newCount, pct: segmentPct(newCount), color: "bg-muted-foreground/40", textColor: "text-muted-foreground" },
            ].map(({ label, sub, count, pct, color, textColor }) => (
              <div key={label}>
                <div className="flex items-baseline justify-between mb-1.5">
                  <div>
                    <span className="text-sm font-medium text-foreground">{label}</span>
                    <span className="text-[10px] text-muted-foreground/60 ml-1.5">· {sub}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-base font-bold ${textColor} tabular-nums`}>{count}</span>
                    <span className="text-[11px] text-muted-foreground/60 tabular-nums">{pct}%</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-border/20 overflow-hidden">
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
