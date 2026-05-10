/**
 * StudioBranding
 * Pro feature: customize public studio profile colors, URL slug, and cover photo.
 * Stored in auth user_metadata — no DB migration required for palette/slug.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palette,
  Link2,
  Image,
  Check,
  X,
  Loader2,
  Eye,
  CheckCircle2,
  XCircle,
  Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { triggerClickHaptic } from "@/lib/haptics";
import { toast } from "sonner";

interface BrandingData {
  accentColor: string;
  palette: string;
  customSlug: string;
  coverUrl: string;
}

const DEFAULT_BRANDING: BrandingData = {
  accentColor: "#FF6B58",
  palette: "midnight",
  customSlug: "",
  coverUrl: "",
};

const PALETTES = [
  {
    id: "midnight",
    label: "Midnight Atelier",
    primary: "#FF6B58",
    bg: "#0F0F11",
    preview: "from-[#0F0F11] to-[#1A1A1F]",
    dot: "bg-[#FF6B58]",
  },
  {
    id: "warm",
    label: "Warm Gallery",
    primary: "#C97B5A",
    bg: "#1A1209",
    preview: "from-[#1A1209] to-[#2A1E10]",
    dot: "bg-[#C97B5A]",
  },
  {
    id: "cool",
    label: "Cool Studio",
    primary: "#6B9ED2",
    bg: "#0D1520",
    preview: "from-[#0D1520] to-[#151F30]",
    dot: "bg-[#6B9ED2]",
  },
  {
    id: "natural",
    label: "Natural Light",
    primary: "#B89B72",
    bg: "#1C180F",
    preview: "from-[#1C180F] to-[#2A2417]",
    dot: "bg-[#B89B72]",
  },
  {
    id: "forest",
    label: "Forest Studio",
    primary: "#6B9E7A",
    bg: "#0D1510",
    preview: "from-[#0D1510] to-[#142018]",
    dot: "bg-[#6B9E7A]",
  },
];

const PALETTE_COLORS: Record<string, string> = {
  midnight: "#FF6B58",
  warm: "#C97B5A",
  cool: "#6B9ED2",
  natural: "#B89B72",
  forest: "#6B9E7A",
};

type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid";

function useSlugCheck(slug: string, currentSlug: string) {
  const [status, setStatus] = useState<SlugStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!slug || slug === currentSlug) {
      setStatus("idle");
      return;
    }

    if (!/^[a-z0-9-]{3,30}$/.test(slug)) {
      setStatus("invalid");
      return;
    }

    setStatus("checking");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      // Check if slug is taken in profiles
      const { data, error } = await supabase
        .from("profiles")
        .select("handle")
        .eq("handle", slug)
        .maybeSingle();

      if (error) {
        setStatus("idle");
        return;
      }
      setStatus(data ? "taken" : "available");
    }, 500);

    return () => clearTimeout(timerRef.current);
  }, [slug, currentSlug]);

  return status;
}

export function StudioBranding() {
  const { user } = useAuth();
  const [branding, setBranding] = useState<BrandingData>(DEFAULT_BRANDING);
  const [saved, setSaved] = useState<BrandingData>(DEFAULT_BRANDING);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slugInput, setSlugInput] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const slugStatus = useSlugCheck(slugInput, saved.customSlug);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.auth.getUser();
    const meta = data?.user?.user_metadata;
    const loaded: BrandingData = {
      accentColor: meta?.studio_accent_color ?? DEFAULT_BRANDING.accentColor,
      palette: meta?.studio_palette ?? DEFAULT_BRANDING.palette,
      customSlug: meta?.studio_slug ?? "",
      coverUrl: meta?.studio_cover_url ?? "",
    };
    setBranding(loaded);
    setSaved(loaded);
    setSlugInput(loaded.customSlug);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const selectPalette = (id: string) => {
    triggerClickHaptic();
    setBranding((prev) => ({
      ...prev,
      palette: id,
      accentColor: PALETTE_COLORS[id] ?? prev.accentColor,
    }));
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Cover photo must be under 5 MB");
      return;
    }

    setUploadingCover(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `covers/${user.id}/studio-cover.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const coverUrl = urlData.publicUrl;
      setBranding((prev) => ({ ...prev, coverUrl }));
      toast.success("Cover photo uploaded");
    } catch (err: any) {
      toast.error("Upload failed", { description: err.message });
    } finally {
      setUploadingCover(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (slugInput && slugStatus === "taken") {
      toast.error("That slug is already taken — choose another");
      return;
    }
    if (slugInput && slugStatus === "invalid") {
      toast.error("Slug must be 3–30 lowercase letters, numbers, or hyphens");
      return;
    }

    setSaving(true);
    try {
      const newSlug = slugStatus === "available" ? slugInput : saved.customSlug;
      await supabase.auth.updateUser({
        data: {
          studio_accent_color: branding.accentColor,
          studio_palette: branding.palette,
          studio_slug: newSlug || null,
          studio_cover_url: branding.coverUrl || null,
        },
      });

      // Sync cover_url, accent_color, and (if changed) handle to profiles table
      // PublicProfile reads these directly from DB — user_metadata alone isn't enough
      const profileUpdates: Record<string, string | null> = {
        cover_url: branding.coverUrl || null,
        accent_color: branding.accentColor,
      };
      if (newSlug && newSlug !== saved.customSlug) {
        profileUpdates.handle = newSlug;
      }
      await supabase
        .from("profiles")
        .update(profileUpdates)
        .eq("user_id", user.id);

      const updated = { ...branding, customSlug: newSlug };
      setSaved(updated);
      setBranding(updated);
      toast.success("Studio branding saved", { description: "Your public profile has been updated." });
    } catch (err: any) {
      toast.error("Failed to save", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const currentPalette = PALETTES.find((p) => p.id === branding.palette) ?? PALETTES[0];

  const hasChanges =
    branding.accentColor !== saved.accentColor ||
    branding.palette !== saved.palette ||
    branding.coverUrl !== saved.coverUrl ||
    (slugStatus === "available" && slugInput !== saved.customSlug);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  const profileUrl = saved.customSlug
    ? `${window.location.origin}/${saved.customSlug}`
    : `${window.location.origin}/u/${user?.id?.slice(0, 8)}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <p className="text-sm font-semibold text-foreground">Studio Branding</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Customize how your public studio looks
        </p>
      </div>

      {/* Live Preview */}
      <motion.div
        className="rounded-2xl overflow-hidden border border-border/30"
        style={{ background: currentPalette.bg }}
      >
        {/* Cover */}
        <div className="relative h-20 overflow-hidden">
          {branding.coverUrl ? (
            <img src={branding.coverUrl} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background: `linear-gradient(135deg, ${branding.accentColor}33 0%, ${currentPalette.bg} 100%)`,
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
        </div>
        {/* Profile stub */}
        <div className="px-3 pb-3 -mt-5 flex items-end gap-2">
          <div
            className="w-10 h-10 rounded-full border-2 flex-shrink-0"
            style={{ borderColor: branding.accentColor, background: currentPalette.bg }}
          />
          <div>
            <div className="w-20 h-2 rounded-full bg-white/30 mb-1" />
            <div className="w-12 h-1.5 rounded-full bg-white/15" />
          </div>
          <div
            className="ml-auto px-2.5 py-1 rounded-full text-[10px] font-semibold"
            style={{ background: branding.accentColor, color: "#fff" }}
          >
            Follow
          </div>
        </div>
        <p className="text-[10px] text-center pb-2" style={{ color: `${branding.accentColor}99` }}>
          Preview · {currentPalette.label}
        </p>
      </motion.div>

      {/* Studio Palette Presets */}
      <div className="bg-obsidian rounded-2xl border border-border/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Palette className="w-4 h-4 text-electric" />
          <h3 className="text-sm font-semibold text-foreground">Studio Palette</h3>
        </div>

        <div className="grid grid-cols-5 gap-2 mb-4">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              onClick={() => selectPalette(p.id)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                branding.palette === p.id
                  ? "border-electric/60 bg-electric/5"
                  : "border-border/20 bg-carbon hover:border-border/40"
              }`}
            >
              <div
                className="w-7 h-7 rounded-full shadow-md"
                style={{ background: p.primary }}
              />
              <p className="text-[9px] text-muted-foreground text-center leading-tight line-clamp-2">
                {p.label}
              </p>
            </button>
          ))}
        </div>

        {/* Manual color picker */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-muted-foreground flex-shrink-0">Custom color</label>
          <div className="relative flex-shrink-0">
            <div
              className="w-8 h-8 rounded-lg border border-border/40 cursor-pointer shadow-md overflow-hidden"
              style={{ background: branding.accentColor }}
            >
              <input
                type="color"
                value={branding.accentColor}
                onChange={(e) =>
                  setBranding((prev) => ({ ...prev, accentColor: e.target.value, palette: "custom" }))
                }
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </div>
          </div>
          <span className="text-xs text-muted-foreground/60 font-mono">{branding.accentColor}</span>
        </div>
      </div>

      {/* Custom URL Slug */}
      <div className="bg-obsidian rounded-2xl border border-border/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="w-4 h-4 text-electric" />
          <h3 className="text-sm font-semibold text-foreground">Custom Studio URL</h3>
        </div>

        <div className="flex items-center gap-1 mb-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {window.location.host}/
          </span>
          <div className="relative flex-1">
            <input
              className="w-full bg-carbon border border-border/40 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-electric/50 pr-7"
              placeholder="your-studio"
              value={slugInput}
              onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              maxLength={30}
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
              {slugStatus === "checking" && <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />}
              {slugStatus === "available" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              {slugStatus === "taken" && <XCircle className="w-3.5 h-3.5 text-rose-400" />}
            </div>
          </div>
        </div>

        {slugStatus === "available" && (
          <p className="text-[10px] text-emerald-400 flex items-center gap-1">
            <Check className="w-3 h-3" /> Available
          </p>
        )}
        {slugStatus === "taken" && (
          <p className="text-[10px] text-rose-400 flex items-center gap-1">
            <X className="w-3 h-3" /> Already taken
          </p>
        )}
        {slugStatus === "invalid" && (
          <p className="text-[10px] text-amber-400">
            3–30 lowercase letters, numbers, or hyphens only
          </p>
        )}

        {saved.customSlug && (
          <p className="text-[10px] text-muted-foreground/60 mt-2">
            Current: <span className="text-foreground/60">{profileUrl}</span>
          </p>
        )}
      </div>

      {/* Cover Photo */}
      <div className="bg-obsidian rounded-2xl border border-border/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Image className="w-4 h-4 text-electric" />
          <h3 className="text-sm font-semibold text-foreground">Cover Photo</h3>
          <span className="text-[10px] text-muted-foreground ml-auto">1200×400px recommended</span>
        </div>

        {branding.coverUrl ? (
          <div className="relative rounded-xl overflow-hidden border border-border/30 mb-3">
            <img
              src={branding.coverUrl}
              alt="Cover"
              className="w-full h-24 object-cover"
            />
            <button
              onClick={() => { triggerClickHaptic(); setBranding((prev) => ({ ...prev, coverUrl: "" })); }}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        ) : (
          <div
            className="h-16 rounded-xl border border-dashed border-border/40 flex items-center justify-center mb-3"
            style={{
              background: `linear-gradient(135deg, ${branding.accentColor}22 0%, transparent 100%)`,
            }}
          >
            <p className="text-xs text-muted-foreground/60">
              No cover photo — gradient from your accent color will be used
            </p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleCoverUpload}
        />
        <button
          onClick={() => { triggerClickHaptic(); fileInputRef.current?.click(); }}
          disabled={uploadingCover}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border/40 text-xs font-semibold text-muted-foreground hover:bg-muted/20 hover:text-foreground transition-colors disabled:opacity-50"
        >
          {uploadingCover ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          {branding.coverUrl ? "Replace Cover Photo" : "Upload Cover Photo"}
        </button>
      </div>

      {/* Save / Preview */}
      <div className="flex gap-2">
        <button
          onClick={() => { triggerClickHaptic(); setShowPreview(!showPreview); }}
          className="flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-border/40 text-sm font-semibold text-muted-foreground hover:bg-muted/20 transition-colors"
        >
          <Eye className="w-4 h-4" />
          Preview Studio
        </button>
        <button
          onClick={() => { triggerClickHaptic(); handleSave(); }}
          disabled={saving || !hasChanges}
          className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-electric to-crimson text-white text-sm font-semibold shadow-electric flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      {/* Preview banner */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-2xl border border-border/30 overflow-hidden bg-carbon p-3 text-center"
          >
            <p className="text-xs text-muted-foreground mb-2">
              Your public studio appears at:
            </p>
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-electric underline break-all"
            >
              {profileUrl}
            </a>
            <p className="text-[10px] text-muted-foreground/50 mt-1">
              Save your changes first to apply them
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
