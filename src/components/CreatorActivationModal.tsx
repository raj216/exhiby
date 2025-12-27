import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Check, Sparkles, Link as LinkIcon } from "lucide-react";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { useUserMode } from "@/contexts/UserModeContext";
import { ImageCropper } from "./ImageCropper";
import { toast } from "@/hooks/use-toast";

interface CreatorActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreatorActivationModal({ isOpen, onClose, onSuccess }: CreatorActivationModalProps) {
  const [uploadedImages, setUploadedImages] = useState<(string | null)[]>([null, null, null]);
  // Track original file data (before cropping) to detect duplicates
  const [originalFileData, setOriginalFileData] = useState<(string | null)[]>([null, null, null]);
  const [socialLink, setSocialLink] = useState("");
  const [pledgeChecked, setPledgeChecked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [cropperState, setCropperState] = useState<{ isOpen: boolean; imageSrc: string; index: number }>({
    isOpen: false,
    imageSrc: "",
    index: 0,
  });
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null]);
  const { setVerifiedCreator, setMode } = useUserMode();

  const uploadedCount = uploadedImages.filter(img => img !== null).length;
  const canUnlock = uploadedCount === 3 && pledgeChecked;

  const handleImageUpload = (index: number) => {
    fileInputRefs.current[index]?.click();
  };

  // Check if an image is already uploaded (prevent duplicates using original file data)
  const isDuplicateImage = (newImageData: string): boolean => {
    return originalFileData.some(data => data === newImageData);
  };

  const handleFileChange = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        
        // Check for duplicate
        if (isDuplicateImage(imageData)) {
          toast({
            title: "Duplicate Image",
            description: "This image has already been uploaded. Please select a different image.",
            variant: "destructive",
          });
          // Reset the file input
          if (fileInputRefs.current[index]) {
            fileInputRefs.current[index]!.value = "";
          }
          return;
        }
        
        // Open cropper instead of directly setting the image
        setCropperState({
          isOpen: true,
          imageSrc: imageData,
          index,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const croppedImageData = e.target?.result as string;
      
      // Save cropped image for display
      const newImages = [...uploadedImages];
      newImages[cropperState.index] = croppedImageData;
      setUploadedImages(newImages);
      
      // Store original file data for duplicate detection
      const newOriginalData = [...originalFileData];
      newOriginalData[cropperState.index] = cropperState.imageSrc;
      setOriginalFileData(newOriginalData);
      
      setCropperState({ isOpen: false, imageSrc: "", index: 0 });
      
      // Reset the file input
      if (fileInputRefs.current[cropperState.index]) {
        fileInputRefs.current[cropperState.index]!.value = "";
      }
    };
    reader.readAsDataURL(croppedBlob);
  };

  const handleCropCancel = () => {
    setCropperState({ isOpen: false, imageSrc: "", index: 0 });
    // Reset the file input
    if (fileInputRefs.current[cropperState.index]) {
      fileInputRefs.current[cropperState.index]!.value = "";
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...uploadedImages];
    newImages[index] = null;
    setUploadedImages(newImages);
    
    // Also clear the original data for this slot
    const newOriginalData = [...originalFileData];
    newOriginalData[index] = null;
    setOriginalFileData(newOriginalData);
  };

  const handleUnlock = async () => {
    if (!canUnlock) return;
    
    setIsUnlocking(true);
    
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Update user state
    setVerifiedCreator(true);
    setMode("creator");
    
    // Trigger success
    onSuccess();
    onClose();
  };

  const handleClose = () => {
    if (!isUnlocking) {
      setUploadedImages([null, null, null]);
      setOriginalFileData([null, null, null]);
      setSocialLink("");
      setPledgeChecked(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogPortal>
        <DialogOverlay className="bg-black/90 backdrop-blur-md" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 sm:py-12"
        >
          <div className="w-full max-w-lg px-4">
          <div className="relative rounded-3xl overflow-hidden">
            {/* Premium gradient border effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-crimson/30 via-transparent to-electric/30 rounded-3xl" />
            
            {/* Main content */}
            <div className="relative bg-obsidian border border-border/30 rounded-3xl p-6 sm:p-8">
              {/* Close button */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-surface hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>

              {/* Header */}
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                  className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-crimson/20 to-electric/20 mb-4"
                >
                  <Sparkles className="w-8 h-8 text-crimson" />
                </motion.div>
                <h2 className="font-display text-2xl sm:text-3xl text-foreground mb-2">
                  Unlock Your Studio
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground max-w-sm mx-auto">
                  Exhiby is for creators. Upload 3 examples of your work to start streaming instantly.
                </p>
              </div>

              {/* Upload Section */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground mb-3">
                  Your Work <span className="text-crimson">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="relative">
                      <input
                        ref={(el) => (fileInputRefs.current[index] = el)}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange(index, e)}
                        className="hidden"
                      />
                      {uploadedImages[index] ? (
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="relative aspect-square rounded-xl overflow-hidden group"
                        >
                          <img
                            src={uploadedImages[index]!}
                            alt={`Artwork ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              onClick={() => removeImage(index)}
                              className="p-2 rounded-full bg-crimson/80 hover:bg-crimson transition-colors"
                            >
                              <X className="w-4 h-4 text-white" />
                            </button>
                          </div>
                          <div className="absolute bottom-2 right-2">
                            <div className="w-5 h-5 rounded-full bg-success flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <button
                          onClick={() => handleImageUpload(index)}
                          className="aspect-square w-full rounded-xl border-2 border-dashed border-border/50 hover:border-crimson/50 bg-surface/50 hover:bg-surface transition-all flex items-center justify-center group"
                        >
                          <div className="p-3 rounded-full bg-surface-elevated group-hover:bg-crimson/20 transition-colors">
                            <Plus className="w-5 h-5 text-muted-foreground group-hover:text-crimson transition-colors" />
                          </div>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {uploadedCount}/3 images uploaded
                </p>
              </div>

              {/* Social Link (Optional) */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Portfolio or Social Link <span className="text-muted-foreground font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="url"
                    value={socialLink}
                    onChange={(e) => setSocialLink(e.target.value)}
                    placeholder="Instagram or Portfolio URL"
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-surface border border-border/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-crimson/50 transition-all"
                  />
                </div>
              </div>

              {/* Creator Pledge */}
              <div className="mb-8">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative mt-0.5">
                    <input
                      type="checkbox"
                      checked={pledgeChecked}
                      onChange={(e) => setPledgeChecked(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${
                        pledgeChecked
                          ? "bg-crimson border-crimson"
                          : "border-border/50 group-hover:border-crimson/50"
                      }`}
                    >
                      {pledgeChecked && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                    I certify these are my original works and I will not stream inappropriate content.
                  </span>
                </label>
              </div>

              {/* Unlock Button */}
              <motion.button
                onClick={handleUnlock}
                disabled={!canUnlock || isUnlocking}
                whileHover={canUnlock ? { scale: 1.02 } : {}}
                whileTap={canUnlock ? { scale: 0.98 } : {}}
                className={`w-full py-4 rounded-2xl font-semibold text-base transition-all relative overflow-hidden ${
                  canUnlock
                    ? "bg-gradient-to-r from-crimson to-destructive text-white shadow-lg"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
                style={canUnlock ? {
                  boxShadow: "0 0 40px hsl(345 100% 50% / 0.4)"
                } : {}}
              >
                {/* Animated glow effect when ready */}
                {canUnlock && !isUnlocking && (
                  <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                  />
                )}
                
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isUnlocking ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                      Unlocking...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Unlock Studio Access
                    </>
                  )}
                </span>
              </motion.button>
            </div>
          </div>
          </div>
        </motion.div>
      </DialogPortal>
      
      {/* Image Cropper */}
      <AnimatePresence>
        {cropperState.isOpen && (
          <ImageCropper
            imageSrc={cropperState.imageSrc}
            mode="avatar"
            onCropComplete={handleCropComplete}
            onCancel={handleCropCancel}
          />
        )}
      </AnimatePresence>
    </Dialog>
  );
}
