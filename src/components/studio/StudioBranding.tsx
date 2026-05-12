/**
 * StudioBranding — "Studio Theme" (Pro)
 *
 * The single source of truth for a creator's studio theme:
 * an accent color (palette preset OR custom) that flows through the
 * public studio cover, live-room buttons, share cards, and email templates.
 *
 * Cover photo and username are intentionally NOT here — both already exist
 * in Edit Profile and writing them in two places creates duplication.
 *
 * Persistence:
 *   • profiles.accent_color  (read by PublicProfile and email functions)
 *   • user_metadata.studio_palette / studio_accent_color  (UI state cache)
 */

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Loader2,
  Sparkles,
  Pencil,
  ArrowUpRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { triggerClickHaptic } from "@/lib/haptics";
import { toast } from "sonner";

interface BrandingData {
  accentColor: string;
  palette: string;
}

const DEFAULT_BRANDING: BrandingData = {
  accentColor: "#FF6B58",
  palette: "midnight",
};

interface PaletteDef {
  id: string;
  label: string;
  primary: string;
  bg: string;
  surface: string;
}

const PALETTES: PaletteDef[] = [
  { id: "midnight", label: "Midnight", primary: "#FF6B58", bg: "#0F0F11", surface: "#1A1A1F" },
  { id: "warm",     label: "Warm",     primary: "#C97B5A", bg: "#1A1209", surface: "#2A1E10" },
  { id: "cool",     label: "Cool",     primary: "#6B9ED2", bg: "#0D1520", surface: "#151F30" },
  { id: "natural",  label: "Natural",  primary: "#B89B72", bg: "#1C180F", surface: "#2A2417" },
  { id: "forest",   label: "Forest",   primary: "#6B9E7A", bg: "#0D1510", surface: "#142018" },
];

const PALETTE_BY_ID = Object.fromEntries(PALETTES.map((p) => [p.id, p])) as Record<string, PaletteDef>;

/**
 * Mini visual mockup of a studio card — used as the palette-selector tile
 * AND as the hero preview. Same component, different sizes.
 */
function StudioMockup({
  primary,
  bg,
  surface,
  size = "tile",
  showLive = false,
  avatarUrl,
  name,
}: {
  primary: string;
  bg: string;
  surface: string;
  size?: "tile" | "hero";
  showLive?: boolean;
  avatarUrl?: string | null;
  name?: string;
}) {
  const isHero = size === "hero";
  return (
    <div
      className={`relative overflow-hidden rounded-xl ${isHero ? "h-[140px]" : "h-[110px]"}`}
      style={{ background: bg }}
    >
      {/* Cover */}
      <div
        className={isHero ? "h-[64px]" : "h-[44px]"}
        style={{
          background: `linear-gradient(135deg, ${primary}55 0%, ${bg} 75%)`,
        }}
      />
      {/* Subtle vignette */}
      <div className="absolute inset-x-0 top-0 h-[64px] bg-gradient-to-b from-transparent to-black/30 pointer-events-none" />

      {/* Profile row */}
      <div className={`px-3 ${isHero ? "-mt-6" : "-mt-4"} flex items-end gap-2`}>
        <div
          className={`rounded-full border-[2px] flex-shrink-0 overflow-hidden ${
            isHero ? "w-12 h-12" : "w-9 h-9"
          }`}
          style={{ borderColor: primary, background: surface }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : null}
        </div>
        <div className="flex-1 min-w-0 pb-0.5">
          {isHero && name ? (
            <p className="text-[13px] font-semibold text-white/90 truncate leading-tight">
              {name}
            </p>
          ) : (
            <div
              className={`rounded-full bg-white/30 ${isHero ? "h-2 w-24" : "h-1.5 w-14"} mb-1`}
            />
          )}
          <div
            className={`rounded-full bg-white/15 ${isHero ? "h-1.5 w-16" : "h-1 w-10"}`}
          />
        </div>
        <div
          className={`flex-shrink-0 rounded-full font-semibold text-white ${
            isHero ? "px-3 py-1 text-[11px]" : "px-2 py-0.5 text-[9px]"
          }`}
          style={{ background: primary }}
        >
          Follow
        </div>
      </div>

      {/* Live row (hero only) */}
      {isHero && showLive && (
        <div className="px-3 mt-2 flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: primary }} />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: primary }} />
          </span>
          <span className="text-[10px] font-bold tracking-wider text-white/80">LIVE NOW</span>
          <span className="text-[10px] text-white/40">·  234 watching</span>
        </div>
      )}
    </div>
  );
}

interface StudioBrandingProps {
  /** Opens the Edit Profile modal — wired from the parent that owns it. */
  onEditProfile?: () => void;
}

export function StudioBranding({ onEditProfile }: StudioBrandingProps = {}) {
  const { user } = useAuth();
  const [branding, setBranding] = useState<BrandingData>(DEFAULT_BRANDING);
  const [saved, setSaved] = useState<BrandingData>(DEFAULT_BRANDING);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<{ name: string; avatar_url: string | null } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;

    const [{ data: authData }, { data: profileData }] = await Promise.all([
      supabase.auth.getUser(),
      (supabase
        .from("profiles")
        .select("name, avatar_url, accent_color" as any)
        .eq("user_id", user.id)
        .maybeSingle() as any),
    ]);

    const meta = authData?.user?.user_metadata;
    const profileRow = profileData as { name?: string; avatar_url?: string | null; accent_color?: string | null } | null;
    const accentFromDb = profileRow?.accent_color;

    // Prefer DB over metadata (DB is the source of truth on the public side)
    const accent = accentFromDb || meta?.studio_accent_color || DEFAULT_BRANDING.accentColor;
    // Match the accent against a known preset, else "custom"
    const matchingPreset = PALETTES.find((p) => p.primary.toLowerCase() === accent.toLowerCase());
    const paletteId = matchingPreset?.id || meta?.studio_palette || "custom";

    const loaded: BrandingData = { accentColor: accent, palette: paletteId };
    setBranding(loaded);
    setSaved(loaded);
    setProfile({
      name: profileRow?.name || "Your Studio",
      avatar_url: profileRow?.avatar_url ?? null,
    });
    setIsLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const selectPalette = (p: PaletteDef) => {
    triggerClickHaptic();
    setBranding({ palette: p.id, accentColor: p.primary });
  };

  const handleSave = async () => {
    if (!user) return;
    triggerClickHaptic();
    setSaving(true);
    try {
      // Write canonical accent_color to profiles (read by PublicProfile, share cards, emails)
      await supabase
        .from("profiles")
        .update({ accent_color: branding.accentColor } as any)
        .eq("user_id", user.id);

      // Mirror to user_metadata for UI cache
      await supabase.auth.updateUser({
        data: {
          studio_accent_color: branding.accentColor,
          studio_palette: branding.palette,
        },
      });

      setSaved(branding);
      toast.success("Studio theme saved", {
        description: "Your accent color is now live on your studio.",
      });
    } catch (err: any) {
      toast.error("Failed to save", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    branding.accentColor !== saved.accentColor || branding.palette !== saved.palette;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  // Resolve current palette colors for the hero preview.
  // Falls back to "midnight" surface if we're on a custom color.
  const currentPalette = PALETTE_BY_ID[branding.palette] ?? PALETTES[0];
  const heroBg = currentPalette.bg;
  const heroSurface = currentPalette.surface;

  return (
    <div className="space-y-5">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold text-foreground tracking-tight">
              Studio Theme
            </p>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-electric/15 to-crimson/15 border border-electric/25">
              <Sparkles className="w-2.5 h-2.5 text-electric" />
              <span className="text-[9px] font-bold tracking-[0.08em] text-electric uppercase">Pro</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-md">
            Your accent color flows through your studio cover, live room, share cards, and email templates.
          </p>
        </div>
      </div>

      {/* ─── Hero Live Preview ───────────────────────────────────────────── */}
      <motion.div
        layout
        className="rounded-2xl overflow-hidden border border-border/30 shadow-lg"
      >
        <StudioMockup
          primary={branding.accentColor}
          bg={heroBg}
          surface={heroSurface}
          size="hero"
          showLive
          avatarUrl={profile?.avatar_url}
          name={profile?.name}
        />
        <div className="px-3 py-2 bg-obsidian/60 border-t border-border/20 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70 font-semibold">
            Live preview
          </p>
          <p className="text-[10px] text-muted-foreground font-mono">{branding.accentColor.toUpperCase()}</p>
        </div>
      </motion.div>

      {/* ─── Palette Tiles ───────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-foreground mb-2.5 tracking-wide">
          Choose a palette
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {PALETTES.map((p) => {
            const active = branding.palette === p.id;
            return (
              <motion.button
                key={p.id}
                onClick={() => selectPalette(p)}
                whileTap={{ scale: 0.97 }}
                className={`group relative rounded-2xl p-1.5 border transition-all text-left ${
                  active
                    ? "border-electric/60 bg-electric/5 shadow-[0_0_0_1px_rgba(102,170,255,0.3)]"
                    : "border-border/25 hover:border-border/50 bg-carbon/40"
                }`}
                aria-pressed={active}
              >
                <StudioMockup primary={p.primary} bg={p.bg} surface={p.surface} />
                <div className="flex items-center justify-between px-1 pt-2 pb-0.5">
                  <span className={`text-[11px] font-semibold ${active ? "text-foreground" : "text-muted-foreground"}`}>
                    {p.label}
                  </span>
                  {active && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-4 h-4 rounded-full bg-electric flex items-center justify-center"
                    >
                      <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                    </motion.span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ─── Custom Color ────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-foreground mb-2.5 tracking-wide">
          Or pick a custom color
        </p>
        <label
          className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
            branding.palette === "custom"
              ? "border-electric/60 bg-electric/5"
              : "border-border/25 bg-carbon/40 hover:border-border/50"
          }`}
        >
          <div
            className="w-10 h-10 rounded-xl shadow-md flex-shrink-0 ring-1 ring-white/10"
            style={{ background: branding.accentColor }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Custom hex</p>
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
              {branding.accentColor.toUpperCase()}
            </p>
          </div>
          <span className="text-[11px] font-semibold text-electric flex items-center gap-1 flex-shrink-0">
            <Pencil className="w-3 h-3" />
            Edit
          </span>
          <input
            type="color"
            value={branding.accentColor}
            onChange={(e) =>
              setBranding({ palette: "custom", accentColor: e.target.value })
            }
            className="sr-only"
            aria-label="Pick a custom accent color"
          />
        </label>
      </div>

      {/* ─── Edit Profile note (dedupe redirect) ─────────────────────────── */}
      {onEditProfile && (
        <button
          type="button"
          onClick={() => { triggerClickHaptic(); onEditProfile(); }}
          className="group w-full flex items-center gap-3 p-3 rounded-2xl border border-border/20 bg-carbon/30 hover:bg-carbon/60 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0">
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">
              Cover photo &amp; studio URL
            </p>
            <p className="text-[11px] text-muted-foreground/80 mt-0.5">
              Manage these in your profile — your username is your studio URL.
            </p>
          </div>
          <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
        </button>
      )}

      {/* ─── Sticky save action ──────────────────────────────────────────── */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="sticky bottom-3 z-10"
          >
            <div className="flex items-center gap-3 p-2 pl-4 rounded-full bg-obsidian/95 border border-electric/30 backdrop-blur-md shadow-2xl">
              <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-electric animate-pulse" />
                Unsaved changes
              </span>
              <button
                onClick={() => { triggerClickHaptic(); setBranding(saved); }}
                disabled={saving}
                className="ml-auto px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-full bg-gradient-to-r from-electric to-crimson text-white text-xs font-bold shadow-electric flex items-center gap-1.5 disabled:opacity-50 transition-all active:scale-95"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save Theme
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
