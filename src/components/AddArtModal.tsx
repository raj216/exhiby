import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, ImageIcon } from "lucide-react";
import { triggerClickHaptic } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface AddArtModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (imageBlob: Blob, title: string, description: string) => Promise<boolean>;
  isUploading: boolean;
}

export function AddArtModal({ isOpen, onClose, onUpload, isUploading }: AddArtModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<{ title?: string; description?: string; image?: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setTitle("");
      setDescription("");
      setErrors({});
    }
  }, [isOpen]);

  // Cleanup preview URL
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrors(prev => ({ ...prev, image: "Please select an image file" }));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, image: "Image must be under 10MB" }));
      return;
    }

    // Clean up previous preview
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setErrors(prev => ({ ...prev, image: undefined }));
  };

  const handleImageClick = () => {
    triggerClickHaptic();
    fileInputRef.current?.click();
  };

  const validateForm = (): boolean => {
    const newErrors: { title?: string; description?: string; image?: string } = {};

    if (!selectedFile) {
      newErrors.image = "Please select an image";
    }

    if (!title.trim()) {
      newErrors.title = "Title is required";
    } else if (title.length > 10) {
      newErrors.title = "Title must be 10 characters or less";
    }

    if (!description.trim()) {
      newErrors.description = "Description is required";
    } else if (description.length > 50) {
      newErrors.description = "Description must be 50 characters or less";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !selectedFile) return;

    triggerClickHaptic();

    const arrayBuffer = await selectedFile.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: selectedFile.type });

    const success = await onUpload(blob, title.trim(), description.trim());
    if (success) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-carbon/95 backdrop-blur-xl flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-md bg-surface-elevated border border-border/50 rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/30">
              <h2 className="font-display text-lg text-foreground">Add Artwork</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-muted/20 flex items-center justify-center hover:bg-muted/40 transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />

              {/* Image Upload Area */}
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">Artwork Image</Label>
                <button
                  onClick={handleImageClick}
                  className={`w-full aspect-video rounded-xl border-2 border-dashed overflow-hidden flex flex-col items-center justify-center transition-colors ${
                    errors.image 
                      ? "border-destructive bg-destructive/5" 
                      : "border-border/50 hover:border-primary/50 bg-muted/10"
                  }`}
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      <ImageIcon className="w-10 h-10 text-muted-foreground/50 mb-2" />
                      <span className="text-sm text-muted-foreground">Tap to select image</span>
                    </>
                  )}
                </button>
                {errors.image && (
                  <p className="text-xs text-destructive mt-1">{errors.image}</p>
                )}
              </div>

              {/* Title */}
              <div>
                <Label htmlFor="title" className="text-sm text-muted-foreground mb-2 block">
                  Title <span className="text-muted-foreground/50">({title.length}/10)</span>
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 10))}
                  placeholder="Artwork title"
                  maxLength={10}
                  className={`bg-muted/20 border-border/50 ${errors.title ? "border-destructive" : ""}`}
                />
                {errors.title && (
                  <p className="text-xs text-destructive mt-1">{errors.title}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description" className="text-sm text-muted-foreground mb-2 block">
                  Description <span className="text-muted-foreground/50">({description.length}/50)</span>
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 50))}
                  placeholder="Brief description of your artwork"
                  maxLength={50}
                  rows={2}
                  className={`bg-muted/20 border-border/50 resize-none ${errors.description ? "border-destructive" : ""}`}
                />
                {errors.description && (
                  <p className="text-xs text-destructive mt-1">{errors.description}</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border/30">
              <Button
                onClick={handleSubmit}
                disabled={isUploading}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isUploading ? (
                  <span className="flex items-center gap-2">
                    <Upload className="w-4 h-4 animate-pulse" />
                    Uploading...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Upload
                  </span>
                )}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
