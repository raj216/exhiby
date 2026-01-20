import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useScrollLock } from "@/hooks/useScrollLock";
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
import { GO_LIVE_CATEGORIES } from "@/lib/categories";

interface ScheduleEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventCreated: () => void;
}

const MAX_TITLE_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 140;

export function ScheduleEventModal({ isOpen, onClose, onEventCreated }: ScheduleEventModalProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Lock body scroll when modal is open
  useScrollLock(isOpen);
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [isFree, setIsFree] = useState(true);
  const [capacity, setCapacity] = useState<string>("10");
  const [price, setPrice] = useState("");
  const [coverImage, setCoverImage] = useState<Blob | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);

  // Validation checks
  const isCoverUploaded = coverPreview !== null;
  const isCategorySelected = category !== "";
  const isTitleValid = title.trim().length > 0;
  const isDescriptionValid = description.trim().length > 0;
  const isDateValid = scheduledDate !== "";
  const isTimeValid = scheduledTime !== "";
  const isPriceValid = isFree || (parseFloat(price) >= 1);

  const canPublish = isCoverUploaded && isCategorySelected && isTitleValid && isDescriptionValid && isDateValid && isTimeValid && isPriceValid;

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
    // Reset file input so user can select the same file again
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
    // Only allow numeric input with decimals
    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
      setPrice(value);
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    triggerClickHaptic();
    setCategory(categoryId);
  };

  const validateDateTime = (): boolean => {
    if (!scheduledDate || !scheduledTime) {
      toast({ title: "Error", description: "Please select date and time", variant: "destructive" });
      return false;
    }

    // Create date in user's local timezone
    const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    const now = new Date();

    if (scheduledDateTime <= now) {
      toast({ title: "Error", description: "Please select a future date and time", variant: "destructive" });
      return false;
    }

    return true;
  };

  const validatePrice = (): boolean => {
    if (isFree) return true;

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 1) {
      toast({ title: "Error", description: "Minimum ticket price is $1.00", variant: "destructive" });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in", variant: "destructive" });
      return;
    }

    if (!canPublish) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    if (!validateDateTime()) return;
    if (!validatePrice()) return;

    setIsSubmitting(true);
    triggerClickHaptic();

    try {
      let coverUrl: string | null = null;

      // Upload cropped cover image if selected
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

      // Combine date and time in user's local timezone, then convert to UTC ISO string
      const localDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
      const scheduledAt = localDateTime.toISOString(); // Automatically converts to UTC

      // Insert event
      const { data: insertedEvent, error } = await supabase
        .from('events')
        .insert({
          creator_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          cover_url: coverUrl,
          category: category,
          scheduled_at: scheduledAt,
          is_free: isFree,
          price: isFree ? 0 : parseFloat(price) || 0,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Trigger notifications for followers (fire and forget)
      if (insertedEvent?.id) {
        const { data: session } = await supabase.auth.getSession();
        fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-followers`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session?.session?.access_token}`,
            },
            body: JSON.stringify({
              event_id: insertedEvent.id,
              notification_type: "studio_scheduled",
            }),
          }
        ).catch((err) => console.error("Failed to trigger notifications:", err));
      }

      toast({ title: "Success", description: "Studio scheduled!" });
      
      // Reset form
      setTitle("");
      setDescription("");
      setCategory("");
      setScheduledDate("");
      setScheduledTime("");
      setIsFree(true);
      setPrice("");
      setCoverImage(null);
      setCoverPreview(null);
      
      onEventCreated();
      onClose();
    } catch (error: any) {
      console.error("Error creating event:", error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create event", 
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

  // Get today's date for min attribute
  const today = new Date().toISOString().split('T')[0];

  // Premium spring physics for modal - matching GoLiveWizard
  const modalSpring = {
    type: "spring" as const,
    stiffness: 300,
    damping: 30,
    mass: 1,
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop with premium easing */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
        onClick={handleClose}
        className="fixed inset-0 bg-carbon/80 backdrop-blur-sm z-50"
      />

      {/* Modal with spring physics - slides up from bottom */}
      <motion.div
        initial={{ y: "100%", x: "-50%" }}
        animate={{ y: 0, x: "-50%" }}
        exit={{ y: "100%", x: "-50%" }}
        transition={modalSpring}
        className="fixed bottom-0 left-1/2 w-full bg-obsidian rounded-t-3xl z-50 max-h-[90dvh] max-w-lg flex flex-col lg:bottom-auto lg:top-0 lg:rounded-3xl lg:max-h-[92dvh] lg:my-[4vh]"
        style={{ 
          transform: "translateX(-50%)",
          willChange: "transform",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
            {/* Handle - Mobile only */}
            <div className="flex justify-center pt-3 pb-2 lg:hidden flex-shrink-0">
              <div className="w-10 h-1 bg-border/50 rounded-full" />
            </div>

            {/* Header - Sticky */}
            <div className="flex items-center justify-between px-5 pb-4 pt-2 lg:pt-5 border-b border-border/30 bg-obsidian sticky top-0 z-10 flex-shrink-0 lg:rounded-t-3xl">
              <h2 className="font-display text-xl text-foreground">Open Studio</h2>
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
              {/* Cover Image Upload - centered, narrow design matching GoLive */}
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Cover Photo <span className="text-electric">*</span>
                </Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <div className="flex justify-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-40 rounded-2xl border-2 border-dashed border-border/50 bg-surface flex flex-col items-center justify-center gap-2 overflow-hidden hover:border-electric/50 transition-colors"
                    style={{ aspectRatio: "2/3" }}
                  >
                    {coverPreview ? (
                      <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-obsidian flex items-center justify-center border border-border/50">
                          <ImagePlus className="w-5 h-5 text-electric" />
                        </div>
                        <span className="text-sm text-muted-foreground">Upload Cover</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Medium Selection */}
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Medium <span className="text-electric">*</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {GO_LIVE_CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => handleCategorySelect(cat.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors duration-luxury ease-luxury ${
                          isSelected
                            ? "bg-muted text-foreground font-medium border border-border/50"
                            : "bg-surface border border-border/50 text-muted-foreground hover:border-border/80 hover:text-foreground"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Studio Title */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label htmlFor="title" className="text-sm text-muted-foreground">
                    Studio Title <span className="text-electric">*</span>
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

              {/* Studio Notes */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label htmlFor="description" className="text-sm text-muted-foreground">
                    Studio Notes <span className="text-electric">*</span>
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {description.length}/{MAX_DESCRIPTION_LENGTH}
                  </span>
                </div>
                <Textarea
                  id="description"
                  value={description}
                  onChange={handleDescriptionChange}
                  placeholder="Tell your audience what they'll experience inside your studio"
                  rows={3}
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  className="bg-surface border-border/30 resize-none"
                />
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="date" className="text-sm text-muted-foreground mb-2 block">
                    Date <span className="text-electric">*</span>
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={today}
                    className="bg-surface border-border/30"
                  />
                </div>
                <div>
                  <Label htmlFor="time" className="text-sm text-muted-foreground mb-2 block">
                    Time <span className="text-electric">*</span>
                  </Label>
                  <Input
                    id="time"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="bg-surface border-border/30"
                  />
                </div>
              </div>

              {/* Studio Capacity */}
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Studio Capacity <span className="text-electric">*</span>
                </Label>
                <div className="flex gap-2">
                  {["5", "10", "25", "unlimited"].map((option) => {
                    const isUnlimited = option === "unlimited";
                    const isDisabled = isUnlimited && !isFree;
                    const isSelected = capacity === option;
                    
                    return (
                      <button
                        key={option}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => setCapacity(option)}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                          isSelected
                            ? "bg-electric text-white"
                            : isDisabled
                            ? "bg-surface/50 text-muted-foreground/40 cursor-not-allowed"
                            : "bg-surface border border-border/30 text-muted-foreground hover:bg-surface/80"
                        }`}
                      >
                        {isUnlimited ? "Unlimited" : `${option} seats`}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground/70 mt-2">
                  Limited seats create better interaction inside the studio
                </p>
              </div>

              {/* Entry Type Toggle */}
              <div className="flex items-center justify-between py-3 px-4 bg-surface rounded-xl border border-border/30">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-foreground font-medium text-sm">{isFree ? "Free Studio" : "Paid Studio"}</p>
                    <p className="text-xs text-muted-foreground">
                      {isFree ? "Toggle off to set a price" : "Paid studios support focused interaction."}
                    </p>
                  </div>
                  {isFree && (
                    <Badge variant="neutral" className="text-xs">
                      Free
                    </Badge>
                  )}
                </div>
                <Switch
                  checked={isFree}
                  onCheckedChange={(checked) => {
                    setIsFree(checked);
                    // Reset to non-unlimited if switching to paid
                    if (!checked && capacity === "unlimited") {
                      setCapacity("10");
                    }
                  }}
                />
              </div>

              {/* Price Input (when paid) */}
              <AnimatePresence>
                {!isFree && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <Label htmlFor="price" className="text-sm text-muted-foreground mb-2 block">
                      Ticket Price (USD)
                    </Label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                        $
                      </div>
                      <Input
                        id="price"
                        type="text"
                        inputMode="decimal"
                        value={price}
                        onChange={handlePriceChange}
                        placeholder="5.00"
                        className="bg-surface border-border/30 pl-7"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Minimum: $1.00</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !canPublish}
                className="w-full py-6 rounded-2xl bg-gradient-to-r from-electric to-crimson text-foreground font-semibold text-base disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  "SCHEDULE STUDIO"
                )}
              </Button>

              {/* Validation Hint */}
              {!canPublish && (
                <p className="text-xs text-muted-foreground text-center">
                  Fill all required fields to schedule your studio
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
