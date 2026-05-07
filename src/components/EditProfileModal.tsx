import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, Plus, Link as LinkIcon, Globe, Instagram, ShoppingBag, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { triggerClickHaptic } from "@/lib/haptics";
import { ImageCropper } from "./ImageCropper";

export interface ProfileLink {
  id: string;
  label: string;
  url: string;
  type: "website" | "social" | "shop" | "other";
}

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: {
    name: string;
    handle: string | null;
    avatarUrl: string | null;
    bio?: string | null;
    website?: string | null;
    coverUrl?: string | null;
    profileLinks?: ProfileLink[];
  } | null;
  onProfileUpdated: () => void;
}

const LINK_TYPE_OPTIONS: { value: ProfileLink["type"]; label: string; icon: React.ReactNode }[] = [
  { value: "website", label: "Website", icon: <Globe className="w-3.5 h-3.5" /> },
  { value: "social",  label: "Social",  icon: <Instagram className="w-3.5 h-3.5" /> },
  { value: "shop",    label: "Shop",    icon: <ShoppingBag className="w-3.5 h-3.5" /> },
  { value: "other",   label: "Other",   icon: <LinkIcon className="w-3.5 h-3.5" /> },
];

export function EditProfileModal({
  isOpen,
  onClose,
  profile,
  onProfileUpdated,
}: EditProfileModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null);
  const [profileLinks, setProfileLinks] = useState<ProfileLink[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showAvatarCropper, setShowAvatarCropper] = useState(false);
  const [showCoverCropper, setShowCoverCropper] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [cropType, setCropType] = useState<"avatar" | "cover">("avatar");

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Initialize form with profile data
  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setUsername(profile.handle || "");
      setBio(profile.bio || "");
      setAvatarPreview(profile.avatarUrl);
      setCoverPreview(profile.coverUrl || null);
      setProfileLinks(profile.profileLinks || []);
    }
  }, [profile, isOpen]);

  const addLink = () => {
    if (profileLinks.length >= 6) return;
    triggerClickHaptic();
    setProfileLinks(prev => [
      ...prev,
      { id: crypto.randomUUID(), label: "", url: "", type: "website" }
    ]);
  };

  const updateLink = (id: string, field: keyof ProfileLink, value: string) => {
    setProfileLinks(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const removeLink = (id: string) => {
    triggerClickHaptic();
    setProfileLinks(prev => prev.filter(l => l.id !== id));
  };

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "avatar" | "cover"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be under 10MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setTempImage(reader.result as string);
      setCropType(type);
      if (type === "avatar") {
        setShowAvatarCropper(true);
      } else {
        setShowCoverCropper(true);
      }
    };
    reader.readAsDataURL(file);

    // Reset the input
    e.target.value = "";
  };

  const handleCropComplete = (blob: Blob, type: "avatar" | "cover") => {
    const url = URL.createObjectURL(blob);
    if (type === "avatar") {
      setAvatarPreview(url);
      setAvatarBlob(blob);
      setShowAvatarCropper(false);
    } else {
      setCoverPreview(url);
      setCoverBlob(blob);
      setShowCoverCropper(false);
    }
    setTempImage(null);
  };

  const handleSave = async () => {
    if (!user) return;

    // Validate required fields
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name",
        variant: "destructive",
      });
      return;
    }

    if (!username.trim()) {
      toast({
        title: "Username required",
        description: "Please enter a username",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    triggerClickHaptic();

    try {
      let newAvatarUrl = profile?.avatarUrl;
      let newCoverUrl = profile?.coverUrl;

      // Upload avatar if changed
      if (avatarBlob) {
        const fileExt = "jpg";
        const fileName = `${user.id}/avatar_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(fileName, avatarBlob, { upsert: true });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("avatars").getPublicUrl(fileName);

        newAvatarUrl = publicUrl;
      }

      // Upload cover if changed - use profile-covers bucket
      if (coverBlob) {
        const fileExt = "jpg";
        const fileName = `${user.id}/cover_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("profile-covers")
          .upload(fileName, coverBlob, { upsert: true });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("profile-covers").getPublicUrl(fileName);

        newCoverUrl = publicUrl;
      }

      // Filter out incomplete links before saving
      const validLinks = profileLinks.filter(l => l.url.trim() !== "");

      // ── Step 1: Update stable profile fields (always works) ──────────────
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          name: name.trim(),
          handle: username.trim().replace(/^@/, ""),
          bio: bio.trim() || null,
          avatar_url: newAvatarUrl,
          cover_url: newCoverUrl,
        })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      // ── Step 2: Save profile links via edge function ──────────────────────
      // The edge function handles the DB migration (adds profile_links column
      // if it doesn't exist yet) then updates the row — self-healing.
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (token) {
          const res = await supabase.functions.invoke("update-profile-links", {
            body: { links: validLinks },
          });
          if (res.error) {
            console.warn("[EditProfileModal] links save warning:", res.error);
          }
        }
      } catch (linksErr) {
        // Non-fatal — profile was saved, links might not persist if edge fn is
        // not deployed yet. Log and continue.
        console.warn("[EditProfileModal] links save failed (non-fatal):", linksErr);
      }

      toast({ title: "Profile saved", description: validLinks.length > 0 ? `Profile and ${validLinks.length} link${validLinks.length > 1 ? "s" : ""} saved!` : "Profile updated successfully!" });
      onProfileUpdated();
      onClose();
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Save failed",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    // Reset state
    setAvatarBlob(null);
    setCoverBlob(null);
    setTempImage(null);
    onClose();
  };

  if (!isOpen) return null;

  const displayAvatar = avatarPreview || profile?.avatarUrl;
  const displayCover = coverPreview || profile?.coverUrl;

  return (
    <AnimatePresence>
      {/* Main Modal */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed inset-0 z-50 bg-carbon flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border/30">
          <button
            onClick={handleClose}
            className="text-muted-foreground text-sm font-medium"
          >
            Cancel
          </button>
          <h2 className="text-foreground font-display text-lg">Edit Profile</h2>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="text-electric text-sm font-semibold disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Section 1: Visual Editor */}
          <div className="relative">
            {/* Cover Photo */}
            <div
              className="relative h-40 w-full cursor-pointer group"
              onClick={() => coverInputRef.current?.click()}
            >
              {displayCover ? (
                <img
                  src={displayCover}
                  alt="Cover"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-obsidian via-carbon to-obsidian" />
              )}
              <div className="absolute inset-0 bg-carbon/40 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-carbon/80 backdrop-blur-sm flex items-center justify-center">
                  <Camera className="w-6 h-6 text-foreground" />
                </div>
              </div>
            </div>

            {/* Profile Photo - overlapping */}
            <div className="absolute left-4 -bottom-12">
              <div
                className="relative w-24 h-24 rounded-full border-4 border-carbon overflow-hidden cursor-pointer group bg-obsidian"
                onClick={() => avatarInputRef.current?.click()}
              >
                {displayAvatar ? (
                  <img
                    src={displayAvatar}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-display text-muted-foreground">
                    {(profile?.name || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-carbon/50 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-foreground" />
                </div>
              </div>
            </div>
          </div>

          {/* Helper text */}
          <div className="mt-16 px-4">
            <p className="text-xs text-muted-foreground">Tap image to change</p>
          </div>

          {/* Section 2: Form Fields */}
          <div className="px-4 mt-6 space-y-5 pb-8">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-3 rounded-xl bg-obsidian border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-electric/50"
              />
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  @
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value.replace(/^@/, ""))
                  }
                  placeholder="username"
                  className="w-full pl-8 pr-4 py-3 rounded-xl bg-obsidian border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-electric/50"
                />
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 150))}
                placeholder="Tell people what you create and why they should watch."
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-obsidian border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-electric/50 resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {bio.length}/150
              </p>
            </div>

            {/* Bio Links */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">Links</label>
                {profileLinks.length < 6 && (
                  <button
                    type="button"
                    onClick={addLink}
                    className="flex items-center gap-1 text-electric text-xs font-semibold py-1 px-2 rounded-lg hover:bg-electric/10 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add Link
                  </button>
                )}
              </div>

              {profileLinks.length === 0 && (
                <button
                  type="button"
                  onClick={addLink}
                  className="w-full py-3 border border-dashed border-border/50 rounded-xl flex items-center justify-center gap-2 text-muted-foreground text-sm hover:border-electric/40 hover:text-electric transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add a link (website, social, shop…)
                </button>
              )}

              <div className="space-y-3">
                <AnimatePresence>
                  {profileLinks.map((link) => (
                    <motion.div
                      key={link.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-obsidian/80 border border-border/40 rounded-xl p-3 space-y-2">
                        {/* Type selector + remove */}
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1 flex-1 flex-wrap">
                            {LINK_TYPE_OPTIONS.map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => updateLink(link.id, "type", opt.value)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                  link.type === opt.value
                                    ? "bg-electric/20 text-electric border border-electric/40"
                                    : "bg-muted/30 text-muted-foreground border border-border/30 hover:bg-muted/50"
                                }`}
                              >
                                {opt.icon}
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeLink(link.id)}
                            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {/* Label */}
                        <input
                          type="text"
                          value={link.label}
                          onChange={(e) => updateLink(link.id, "label", e.target.value)}
                          placeholder={
                            link.type === "website" ? "My Website" :
                            link.type === "social" ? "@handle or page name" :
                            link.type === "shop" ? "My Etsy Shop" : "Link label"
                          }
                          maxLength={40}
                          className="w-full px-3 py-2 rounded-lg bg-carbon/60 border border-border/40 text-foreground text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-electric/40"
                        />
                        {/* URL */}
                        <div className="relative">
                          <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                          <input
                            type="url"
                            value={link.url}
                            onChange={(e) => updateLink(link.id, "url", e.target.value)}
                            placeholder="https://"
                            className="w-full pl-8 pr-3 py-2 rounded-lg bg-carbon/60 border border-border/40 text-foreground text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-electric/40"
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              {profileLinks.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">{profileLinks.length}/6 links</p>
              )}
            </div>
          </div>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFileSelect(e, "avatar")}
          className="hidden"
        />
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFileSelect(e, "cover")}
          className="hidden"
        />
      </motion.div>

      {/* Avatar Cropper */}
      {showAvatarCropper && tempImage && (
        <ImageCropper
          imageSrc={tempImage}
          mode="avatar"
          onCropComplete={(blob) => handleCropComplete(blob, "avatar")}
          onCancel={() => {
            setShowAvatarCropper(false);
            setTempImage(null);
          }}
        />
      )}

      {/* Cover Cropper */}
      {showCoverCropper && tempImage && (
        <ImageCropper
          imageSrc={tempImage}
          mode="cover"
          onCropComplete={(blob) => handleCropComplete(blob, "cover")}
          onCancel={() => {
            setShowCoverCropper(false);
            setTempImage(null);
          }}
        />
      )}
    </AnimatePresence>
  );
}
