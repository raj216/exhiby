/**
 * RecurringSessions
 * Pro feature: create and manage recurring session series.
 * Stored in auth user_metadata.recurring_series — no DB migration required.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  CalendarClock,
  DollarSign,
  Gift,
  Loader2,
  X,
  Check,
  RefreshCw,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { triggerClickHaptic } from "@/lib/haptics";
import { toast } from "sonner";

type Cadence = "weekly" | "biweekly" | "monthly";

export interface RecurringSeries {
  id: string;
  title: string;
  description: string;
  cadence: Cadence;
  dayOfWeek: number; // 0=Sun, 6=Sat
  timeHour: number; // 0-23 (local)
  timeMinute: number; // 0, 15, 30, 45
  isFree: boolean;
  price: number; // dollars
  isActive: boolean;
  createdAt: string;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const CADENCE_LABELS: Record<Cadence, string> = {
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly: "Once a month",
};

function generateId() {
  return `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function nextOccurrences(series: RecurringSeries, count = 3): Date[] {
  const now = new Date();
  const dates: Date[] = [];
  const candidate = new Date();
  candidate.setHours(series.timeHour, series.timeMinute, 0, 0);

  // Advance to the correct day of week
  while (candidate.getDay() !== series.dayOfWeek || candidate <= now) {
    candidate.setDate(candidate.getDate() + 1);
  }

  for (let i = 0; i < count; i++) {
    dates.push(new Date(candidate));
    if (series.cadence === "weekly") candidate.setDate(candidate.getDate() + 7);
    else if (series.cadence === "biweekly") candidate.setDate(candidate.getDate() + 14);
    else candidate.setMonth(candidate.getMonth() + 1);
  }
  return dates;
}

const DEFAULT_FORM: Omit<RecurringSeries, "id" | "createdAt" | "isActive"> = {
  title: "",
  description: "",
  cadence: "weekly",
  dayOfWeek: 6, // Saturday
  timeHour: 18,
  timeMinute: 0,
  isFree: false,
  price: 25,
};

interface SeriesFormProps {
  onSave: (data: Omit<RecurringSeries, "id" | "createdAt" | "isActive">) => void;
  onCancel: () => void;
  saving: boolean;
}

function SeriesForm({ onSave, onCancel, saving }: SeriesFormProps) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const formatTime = (h: number, m: number) => {
    const period = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="bg-obsidian rounded-2xl border border-electric/30 p-4 space-y-3"
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-foreground">New Recurring Series</p>
        <button onClick={onCancel} className="p-1 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Title */}
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Series Title</label>
        <input
          className="mt-1 w-full bg-carbon border border-border/40 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-electric/50"
          placeholder="e.g. Saturday Live Studio"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          maxLength={80}
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Description</label>
        <textarea
          className="mt-1 w-full bg-carbon border border-border/40 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-electric/50 resize-none"
          placeholder="What happens in each session..."
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={2}
          maxLength={300}
        />
      </div>

      {/* Cadence */}
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Cadence</label>
        <div className="mt-1 grid grid-cols-3 gap-1.5">
          {(["weekly", "biweekly", "monthly"] as Cadence[]).map((c) => (
            <button
              key={c}
              onClick={() => set("cadence", c)}
              className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${
                form.cadence === c
                  ? "bg-electric/15 border-electric/40 text-electric"
                  : "bg-carbon border-border/30 text-muted-foreground"
              }`}
            >
              {c === "biweekly" ? "Bi-weekly" : c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Day + Time */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Day</label>
          <select
            className="mt-1 w-full bg-carbon border border-border/40 rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-electric/50"
            value={form.dayOfWeek}
            onChange={(e) => set("dayOfWeek", Number(e.target.value))}
          >
            {DAY_NAMES.map((d, i) => (
              <option key={d} value={i}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Time</label>
          <select
            className="mt-1 w-full bg-carbon border border-border/40 rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-electric/50"
            value={`${form.timeHour}:${form.timeMinute}`}
            onChange={(e) => {
              const [h, m] = e.target.value.split(":").map(Number);
              set("timeHour", h);
              set("timeMinute", m);
            }}
          >
            {Array.from({ length: 24 }, (_, h) =>
              [0, 30].map((m) => (
                <option key={`${h}:${m}`} value={`${h}:${m}`}>
                  {formatTime(h, m)}
                </option>
              ))
            ).flat()}
          </select>
        </div>
      </div>

      {/* Pricing */}
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Pricing</label>
        <div className="mt-1 flex gap-2">
          <button
            onClick={() => set("isFree", false)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
              !form.isFree
                ? "bg-electric/15 border-electric/40 text-electric"
                : "bg-carbon border-border/30 text-muted-foreground"
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" /> Paid
          </button>
          <button
            onClick={() => set("isFree", true)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
              form.isFree
                ? "bg-electric/15 border-electric/40 text-electric"
                : "bg-carbon border-border/30 text-muted-foreground"
            }`}
          >
            <Gift className="w-3.5 h-3.5" /> Free
          </button>
        </div>
        {!form.isFree && (
          <div className="mt-2 flex items-center gap-2 bg-carbon border border-border/40 rounded-xl px-3 py-2.5">
            <span className="text-muted-foreground text-sm">$</span>
            <input
              type="number"
              min={1}
              max={9999}
              className="flex-1 bg-transparent text-sm text-foreground focus:outline-none"
              value={form.price}
              onChange={(e) => set("price", Number(e.target.value))}
            />
          </div>
        )}
      </div>

      {/* Upcoming preview */}
      {form.title && (
        <div className="px-3 py-2 rounded-xl bg-carbon border border-border/30">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Next 3 Occurrences</p>
          {nextOccurrences(form as RecurringSeries, 3).map((d, i) => (
            <p key={i} className="text-xs text-foreground/80">
              {d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              {" · "}
              {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </p>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-border/40 text-xs font-semibold text-muted-foreground hover:bg-muted/30 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.title.trim()}
          className="flex-1 py-2.5 rounded-xl bg-electric/15 border border-electric/30 text-xs font-semibold text-electric hover:bg-electric/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Create Series
        </button>
      </div>
    </motion.div>
  );
}

interface SeriesCardProps {
  series: RecurringSeries;
  onToggle: () => void;
  onDelete: () => void;
}

function SeriesCard({ series, onToggle, onDelete }: SeriesCardProps) {
  const upcoming = nextOccurrences(series, 2);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={`bg-obsidian rounded-2xl border p-4 ${
        series.isActive ? "border-electric/20" : "border-border/20 opacity-60"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            series.isActive ? "bg-electric/10" : "bg-muted/20"
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${series.isActive ? "text-electric" : "text-muted-foreground"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{series.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {CADENCE_LABELS[series.cadence]} · {DAY_NAMES[series.dayOfWeek]}s ·{" "}
            {series.isFree ? "Free" : `$${series.price}`}
          </p>

          {/* Upcoming dates */}
          {series.isActive && upcoming.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {upcoming.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  {d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  {" · "}
                  {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/20">
        <button
          onClick={() => { triggerClickHaptic(); onToggle(); }}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
            series.isActive
              ? "bg-muted/30 border-border/30 text-muted-foreground hover:bg-muted/50"
              : "bg-electric/15 border-electric/30 text-electric hover:bg-electric/25"
          }`}
        >
          {series.isActive ? "Pause" : "Resume"}
        </button>
        <button
          onClick={() => { triggerClickHaptic(); onDelete(); }}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-rose-500/10 hover:text-rose-400 transition-colors border border-border/30"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

export function RecurringSessions() {
  const { user } = useAuth();
  const [series, setSeries] = useState<RecurringSeries[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.auth.getUser();
    const stored = data?.user?.user_metadata?.recurring_series;
    setSeries(Array.isArray(stored) ? stored : []);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const persist = async (updated: RecurringSeries[]) => {
    await supabase.auth.updateUser({ data: { recurring_series: updated } });
  };

  const handleSave = async (form: Omit<RecurringSeries, "id" | "createdAt" | "isActive">) => {
    setSaving(true);
    try {
      const newSeries: RecurringSeries = {
        ...form,
        id: generateId(),
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      const updated = [newSeries, ...series];
      await persist(updated);
      setSeries(updated);
      setShowForm(false);
      toast.success("Recurring series created");
    } catch {
      toast.error("Failed to create series");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string) => {
    const updated = series.map((s) =>
      s.id === id ? { ...s, isActive: !s.isActive } : s
    );
    await persist(updated);
    setSeries(updated);
  };

  const handleDelete = async (id: string) => {
    const updated = series.filter((s) => s.id !== id);
    await persist(updated);
    setSeries(updated);
    toast.success("Series removed");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Recurring Sessions</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Set a cadence and Exhiby reminds your audience
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { triggerClickHaptic(); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-electric/15 border border-electric/30 text-xs font-semibold text-electric hover:bg-electric/25 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {showForm && (
          <SeriesForm
            onSave={handleSave}
            onCancel={() => setShowForm(false)}
            saving={saving}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {series.length > 0 ? (
          series.map((s) => (
            <SeriesCard
              key={s.id}
              series={s}
              onToggle={() => handleToggle(s.id)}
              onDelete={() => handleDelete(s.id)}
            />
          ))
        ) : !showForm ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-10 bg-obsidian rounded-2xl border border-border/30"
          >
            <CalendarClock className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No recurring series</p>
            <p className="text-xs text-muted-foreground/60 mt-1 text-center px-6">
              Create a recurring series to build a loyal weekly audience
            </p>
            <button
              onClick={() => { triggerClickHaptic(); setShowForm(true); }}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-full bg-electric/15 border border-electric/30 text-xs font-semibold text-electric hover:bg-electric/25 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Series
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
