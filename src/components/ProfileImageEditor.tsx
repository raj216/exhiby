import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Camera, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { triggerClickHaptic } from "@/lib/haptics";

interface ProfileImageEditorProps {
  isOpen: boolean;
  onClose: () => void;
  type: "avatar" | "cover";
  currentImage?: string | null;
  onImageUpdated: (url: string) => void;
}

export function ProfileImageEditor({
  isOpen,
  onClose,
  type,
  currentImage,
  onImageUpdated,
}: ProfileImageEditorProps) {
  const { user } = useAuth();
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Image must be under 5MB", variant: "destructive" });
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!preview || !user) return;

    setIsUploading(true);
    triggerClickHaptic();

    try {
      // Convert base64 to blob
      const response = await fetch(preview);
      const blob = await response.blob();
      const fileExt = blob.type.split("/")[1];
      const fileName = `${user.id}/${type}_${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, blob, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      // Update profile - currently only avatar_url is in the schema
      if (type === "avatar") {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ avatar_url: publicUrl })
          .eq("user_id", user.id);

        if (updateError) throw updateError;
      }

      onImageUpdated(publicUrl);
      toast({ title: "Success", description: `${type === "avatar" ? "Profile photo" : "Cover photo"} updated!` });
      onClose();
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "Upload failed", description: "Please try again", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setPreview(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-carbon/90 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          className="relative w-full max-w-md bg-obsidian rounded-t-3xl sm:rounded-3xl p-6 border border-border/30"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl text-foreground">
              {type === "avatar" ? "Change Profile Photo" : "Change Cover Photo"}
            </h2>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Preview Area */}
          <div className={`relative overflow-hidden mb-6 ${
            type === "avatar" 
              ? "w-32 h-32 mx-auto rounded-full" 
              : "w-full h-40 rounded-2xl"
          } bg-surface border border-border/50`}>
            {(preview || currentImage) ? (
              <img
                src={preview || currentImage || ""}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Camera className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Actions */}
          <div className="space-y-3">
            {!preview ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 rounded-2xl bg-surface-elevated border border-border/50 text-foreground font-medium flex items-center justify-center gap-2"
              >
                <Upload className="w-5 h-5" />
                Choose Photo
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => setPreview(null)}
                  className="flex-1 py-4 rounded-2xl bg-surface-elevated border border-border/50 text-muted-foreground font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-electric to-crimson text-foreground font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isUploading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      className="w-5 h-5 border-2 border-foreground/30 border-t-foreground rounded-full"
                    />
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Save
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
