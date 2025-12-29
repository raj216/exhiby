import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { triggerClickHaptic } from "@/lib/haptics";
import { ImageCropper } from "@/components/ImageCropper";

interface GoLiveWizardProps {
  onClose: () => void;
  onGoLive: (data: EventData) => void;
}

export interface EventData {
  coverImage: string | null;
  category: string;
  title: string;
  description: string;
  price: number;
  scheduleType: "now" | "scheduled";
  eventId?: string;
}

const MAX_TITLE_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 140;

const categories = [
  { id: "oil", label: "Oil" },
  { id: "digital", label: "Digital" },
  { id: "sketch", label: "Sketch" },
  { id: "watercolor", label: "Watercolor" },
  { id: "acrylic", label: "Acrylic" },
  { id: "mixed", label: "Mixed Media" },
];

export function GoLiveWizard({ onClose, onGoLive }: GoLiveWizardProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState("");
  const [coverImage, setCoverImage] = useState<Blob | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);

  // Validation - all fields required
  const isCoverUploaded = coverPreview !== null;
  const isTitleValid = title.trim().length > 0;
  const isDescriptionValid = description.trim().length > 0;
  const isCategorySelected = category !== "";
  const isPriceValid = isFree || (parseFloat(price) >= 1);
  
  const canGoLive = isCoverUploaded && isTitleValid && isDescriptionValid && isCategorySelected && isPriceValid;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setRawImageSrc(reader.result as string);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    setCoverImage(croppedBlob);
    const url = URL.createObjectURL(croppedBlob);
    setCoverPreview(url);
    setShowCropper(false);
    setRawImageSrc(null);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setRawImageSrc(null);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_TITLE_LENGTH) {
      setTitle(value);
    }
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_DESCRIPTION_LENGTH) {
      setDescription(value);
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
      setPrice(value);
    }
  };

  const handleGoLive = async () => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in", variant: "destructive" });
      return;
    }

    if (!canGoLive) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    triggerClickHaptic();

    try {
      let coverUrl: string | null = null;

      if (coverImage) {
        const fileName = `${user.id}/${Date.now()}.jpg`;
        
        const { error: uploadError } = await supabase.storage
          .from('event-covers')
          .upload(fileName, coverImage, {
            contentType: 'image/jpeg',
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('event-covers')
          .getPublicUrl(fileName);
        
        coverUrl = publicUrl;
      }

      const now = new Date();
      const durationMinutes = 60;
      const endTime = new Date(now.getTime() + durationMinutes * 60 * 1000);

      const eventRecord = {
        creator_id: user.id,
        title: title.trim(),
        description: description.trim() || category || null,
        cover_url: coverUrl,
        scheduled_at: now.toISOString(),
        end_time: endTime.toISOString(),
        duration_minutes: durationMinutes,
        is_free: isFree,
        price: isFree ? 0 : parseFloat(price) || 0,
        is_live: true,
        live_started_at: now.toISOString(),
        viewer_count: 0,
      };

      const { data: insertedEvent, error: insertError } = await supabase
        .from("events")
        .insert(eventRecord)
        .select()
        .single();

      if (insertError) {
        console.error("Error creating event:", insertError);
        toast({ 
          title: "Error", 
          description: insertError.message || "Failed to go live", 
          variant: "destructive" 
        });
        return;
      }

      onGoLive({
        coverImage: coverUrl || coverPreview,
        category,
        title: title.trim(),
        description: description.trim(),
        price: isFree ? 0 : parseFloat(price) || 0,
        scheduleType: "now",
        eventId: insertedEvent.id,
      });
    } catch (err: any) {
      console.error("Error in handleGoLive:", err);
      toast({ 
        title: "Error", 
        description: err.message || "Something went wrong", 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50"
      />

      <motion.div
        initial={{ y: "100%", x: "-50%" }}
        animate={{ y: 0, x: "-50%" }}
        exit={{ y: "100%", x: "-50%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full bg-obsidian rounded-t-3xl z-50 max-h-[90vh] max-w-lg lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:rounded-3xl lg:max-h-[85vh] lg:mx-4 flex flex-col"
      >
        {/* Handle - Mobile only */}
        <div className="flex justify-center pt-3 pb-2 lg:hidden flex-shrink-0">
          <div className="w-10 h-1 bg-border/50 rounded-full" />
        </div>

        {/* Header - Sticky */}
        <div className="flex items-center justify-between px-5 pb-4 pt-2 lg:pt-5 border-b border-border/30 bg-obsidian sticky top-0 z-10 flex-shrink-0 lg:rounded-t-3xl">
          <h2 className="font-display text-xl text-foreground">Go Live</h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center hover:bg-surface transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        
        {/* Scrollable Content Area */}
        <div className="overflow-y-auto flex-1 min-h-0">

        {/* Form */}
        <div className="p-5 space-y-5">
          {/* Cover Image Upload - 2:3 aspect ratio (portrait) */}
          <div className="flex justify-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-40 rounded-2xl border-2 border-dashed border-border/50 bg-surface flex flex-col items-center justify-center gap-2 overflow-hidden transition-colors hover:border-electric/50"
              style={{ aspectRatio: "2/3" }}
            >
              {coverPreview ? (
                <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover" />
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-obsidian flex items-center justify-center border border-border/50">
                    <ImagePlus className="w-5 h-5 text-electric" />
                  </div>
                  <span className="text-muted-foreground text-xs text-center px-2">Upload Cover</span>
                </>
              )}
            </button>
          </div>

          {/* Category Chips - Moved to top */}
          <div>
            <Label className="text-sm text-muted-foreground mb-3 block">
              Category <span className="text-electric">*</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    triggerClickHaptic();
                    setCategory(category === cat.id ? "" : cat.id);
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    category === cat.id
                      ? "bg-electric text-white"
                      : "bg-surface border border-border/30 text-muted-foreground hover:border-electric/50"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label htmlFor="title" className="text-sm text-muted-foreground">
                Title <span className="text-electric">*</span>
              </Label>
              <span className="text-xs text-muted-foreground">
                {title.length}/{MAX_TITLE_LENGTH}
              </span>
            </div>
            <Input
              id="title"
              value={title}
              onChange={handleTitleChange}
              placeholder="What are you working on?"
              maxLength={MAX_TITLE_LENGTH}
              className="bg-surface border-border/30"
            />
          </div>

          {/* Description */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label htmlFor="description" className="text-sm text-muted-foreground">
                Description <span className="text-electric">*</span>
              </Label>
              <span className="text-xs text-muted-foreground">
                {description.length}/{MAX_DESCRIPTION_LENGTH}
              </span>
            </div>
            <Textarea
              id="description"
              value={description}
              onChange={handleDescriptionChange}
              placeholder="Short description..."
              rows={2}
              maxLength={MAX_DESCRIPTION_LENGTH}
              className="bg-surface border-border/30 resize-none"
            />
          </div>

          {/* Price Toggle */}
          <div className="flex items-center justify-between py-3 px-4 bg-surface rounded-xl border border-border/30">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-foreground font-medium text-sm">Free Entrance</p>
                <p className="text-xs text-muted-foreground">Toggle off to set a price</p>
              </div>
              {isFree && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                  Free
                </Badge>
              )}
            </div>
            <Switch
              checked={isFree}
              onCheckedChange={setIsFree}
            />
          </div>

          {/* Price Input (when paid) */}
          <AnimatePresence>
            {!isFree && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center justify-center py-3">
                  <div className="relative flex items-center">
                    <span className="text-2xl font-semibold text-muted-foreground mr-1">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={price}
                      onChange={handlePriceChange}
                      placeholder="5"
                      className="w-20 text-center text-2xl font-bold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">Minimum: $1.00</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit Button */}
          <Button
            onClick={handleGoLive}
            disabled={isSubmitting || !canGoLive}
            className="w-full py-5 rounded-2xl bg-gradient-to-r from-electric to-crimson text-white font-semibold text-base disabled:opacity-40"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Going Live...
              </>
            ) : (
              "GO LIVE NOW"
            )}
          </Button>

          {/* Validation hint */}
          {!canGoLive && (
            <p className="text-xs text-muted-foreground text-center">
              Fill all required fields to go live
            </p>
          )}

          {/* Bottom padding for safe area */}
          <div className="h-4" />
        </div>
        </div>
      </motion.div>

      {/* Image Cropper Modal */}
      <AnimatePresence>
        {showCropper && rawImageSrc && (
          <ImageCropper
            imageSrc={rawImageSrc}
            mode="poster"
            onCropComplete={handleCropComplete}
            onCancel={handleCropCancel}
          />
        )}
      </AnimatePresence>
    </>
  );
}