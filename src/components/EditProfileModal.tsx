import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { triggerClickHaptic } from "@/lib/haptics";
import { ImageCropper } from "./ImageCropper";
import defaultCover from "@/assets/default-cover.jpg";

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
  } | null;
  onProfileUpdated: () => void;
}

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
  const [website, setWebsite] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null);
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
      setWebsite(profile.website || "");
      setAvatarPreview(profile.avatarUrl);
      setCoverPreview(profile.coverUrl || null);
    }
  }, [profile, isOpen]);

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

      // Upload cover if changed
      if (coverBlob) {
        const fileExt = "jpg";
        const fileName = `${user.id}/cover_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(fileName, coverBlob, { upsert: true });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("avatars").getPublicUrl(fileName);

        newCoverUrl = publicUrl;
      }

      // Update profile in database
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          name: name.trim(),
          handle: username.trim().replace(/^@/, ""),
          bio: bio.trim() || null,
          website: website.trim() || null,
          avatar_url: newAvatarUrl,
          cover_url: newCoverUrl,
        })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      toast({ title: "Success", description: "Profile updated successfully!" });
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

  const displayAvatar =
    avatarPreview ||
    profile?.avatarUrl ||
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80";
  const displayCover = coverPreview || profile?.coverUrl || defaultCover;

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
              <img
                src={displayCover}
                alt="Cover"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-carbon/40 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-carbon/80 backdrop-blur-sm flex items-center justify-center">
                  <Camera className="w-6 h-6 text-foreground" />
                </div>
              </div>
            </div>

            {/* Profile Photo - overlapping */}
            <div className="absolute left-4 -bottom-12">
              <div
                className="relative w-24 h-24 rounded-full border-4 border-carbon overflow-hidden cursor-pointer group"
                onClick={() => avatarInputRef.current?.click()}
              >
                <img
                  src={displayAvatar}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
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
                placeholder="Tell us about yourself"
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-obsidian border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-electric/50 resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {bio.length}/150
              </p>
            </div>

            {/* Website */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Website
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yourwebsite.com"
                className="w-full px-4 py-3 rounded-xl bg-obsidian border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-electric/50"
              />
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
          aspectRatio={1}
          circularCrop={true}
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
          aspectRatio={16 / 9}
          circularCrop={false}
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
