import { useState, useRef, useCallback } from "react";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { motion } from "framer-motion";
import { Check, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

interface ImageCropperProps {
  imageSrc: string;
  aspectRatio?: number;
  circularCrop?: boolean;
  onCropComplete: (croppedImageBlob: Blob) => void;
  onCancel: () => void;
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

export function ImageCropper({
  imageSrc,
  aspectRatio = 1,
  circularCrop = false,
  onCropComplete,
  onCancel,
}: ImageCropperProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [scale, setScale] = useState(1);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget;
      setCrop(centerAspectCrop(width, height, aspectRatio));
    },
    [aspectRatio]
  );

  const getCroppedImg = async (): Promise<Blob> => {
    const image = imgRef.current;
    if (!image || !completedCrop) {
      throw new Error("Crop data not available");
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("No 2d context");
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Canvas is empty"));
          }
        },
        "image/jpeg",
        0.9
      );
    });
  };

  const handleComplete = async () => {
    try {
      const croppedBlob = await getCroppedImg();
      onCropComplete(croppedBlob);
    } catch (error) {
      console.error("Error cropping image:", error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-carbon flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border/30">
        <button
          onClick={onCancel}
          className="text-muted-foreground text-sm font-medium"
        >
          Cancel
        </button>
        <h3 className="text-foreground font-medium">Adjust Photo</h3>
        <button
          onClick={handleComplete}
          className="text-electric text-sm font-semibold"
        >
          Done
        </button>
      </div>

      {/* Crop Area */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <ReactCrop
          crop={crop}
          onChange={(_, percentCrop) => setCrop(percentCrop)}
          onComplete={(c) => setCompletedCrop(c)}
          aspect={aspectRatio}
          circularCrop={circularCrop}
          className="max-h-full"
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Crop preview"
            style={{ transform: `scale(${scale})` }}
            onLoad={onImageLoad}
            className="max-h-[60vh] object-contain"
          />
        </ReactCrop>
      </div>

      {/* Controls */}
      <div className="px-4 py-6 border-t border-border/30">
        <div className="flex items-center justify-center gap-8">
          <button
            onClick={() => setScale(Math.max(0.5, scale - 0.1))}
            className="w-12 h-12 rounded-full bg-obsidian border border-border/50 flex items-center justify-center"
          >
            <ZoomOut className="w-5 h-5 text-foreground" />
          </button>
          <button
            onClick={() => {
              setCrop(undefined);
              setScale(1);
            }}
            className="w-12 h-12 rounded-full bg-obsidian border border-border/50 flex items-center justify-center"
          >
            <RotateCcw className="w-5 h-5 text-foreground" />
          </button>
          <button
            onClick={() => setScale(Math.min(2, scale + 0.1))}
            className="w-12 h-12 rounded-full bg-obsidian border border-border/50 flex items-center justify-center"
          >
            <ZoomIn className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
