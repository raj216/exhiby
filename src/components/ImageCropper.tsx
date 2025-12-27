import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Check, RotateCcw } from "lucide-react";

export type CropMode = "avatar" | "cover" | "poster";

interface ImageCropperProps {
  imageSrc: string;
  mode: CropMode;
  onCropComplete: (croppedImageBlob: Blob) => void;
  onCancel: () => void;
}

const ASPECT_RATIOS: Record<CropMode, number> = {
  avatar: 1,       // 1:1 square
  cover: 3,        // 3:1 wide banner
  poster: 3 / 4,   // 3:4 portrait
};

export const ImageCropper = React.forwardRef<HTMLDivElement, ImageCropperProps>(
  function ImageCropper({ imageSrc, mode, onCropComplete, onCancel }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    
    // Transform state
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [imageLoaded, setImageLoaded] = useState(false);
    const [cropZone, setCropZone] = useState({ width: 0, height: 0 });
    const [minScale, setMinScale] = useState(1);

    const aspectRatio = ASPECT_RATIOS[mode];
    const isCircular = mode === "avatar";

    // Calculate crop zone dimensions on mount
    useEffect(() => {
      const calculateCropZone = () => {
        if (!containerRef.current) return;
        
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;
        
        // Max crop zone is 90% of container
        const maxWidth = containerWidth * 0.9;
        const maxHeight = containerHeight * 0.7;
        
        let cropWidth: number;
        let cropHeight: number;
        
        if (aspectRatio >= 1) {
          // Landscape or square
          cropWidth = Math.min(maxWidth, maxHeight * aspectRatio);
          cropHeight = cropWidth / aspectRatio;
        } else {
          // Portrait
          cropHeight = Math.min(maxHeight, maxWidth / aspectRatio);
          cropWidth = cropHeight * aspectRatio;
        }
        
        // Ensure it fits
        if (cropWidth > maxWidth) {
          cropWidth = maxWidth;
          cropHeight = cropWidth / aspectRatio;
        }
        if (cropHeight > maxHeight) {
          cropHeight = maxHeight;
          cropWidth = cropHeight * aspectRatio;
        }
        
        setCropZone({ width: cropWidth, height: cropHeight });
      };
      
      calculateCropZone();
      window.addEventListener("resize", calculateCropZone);
      return () => window.removeEventListener("resize", calculateCropZone);
    }, [aspectRatio]);

    // Calculate minimum scale when image loads
    const handleImageLoad = useCallback(() => {
      if (!imgRef.current || cropZone.width === 0) return;
      
      const img = imgRef.current;
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const cropAspect = cropZone.width / cropZone.height;
      
      let newMinScale: number;
      
      if (imgAspect > cropAspect) {
        // Image is wider than crop zone - scale to fit height
        newMinScale = cropZone.height / img.naturalHeight;
      } else {
        // Image is taller than crop zone - scale to fit width
        newMinScale = cropZone.width / img.naturalWidth;
      }
      
      // Ensure minimum scale fills the crop zone
      const scaledWidth = img.naturalWidth * newMinScale;
      const scaledHeight = img.naturalHeight * newMinScale;
      
      if (scaledWidth < cropZone.width) {
        newMinScale = cropZone.width / img.naturalWidth;
      }
      if (scaledHeight < cropZone.height) {
        newMinScale = cropZone.height / img.naturalHeight;
      }
      
      setMinScale(newMinScale);
      setScale(newMinScale);
      setPosition({ x: 0, y: 0 });
      setImageLoaded(true);
    }, [cropZone]);

    useEffect(() => {
      if (cropZone.width > 0 && imgRef.current?.complete) {
        handleImageLoad();
      }
    }, [cropZone, handleImageLoad]);

    // Constrain position to keep image covering crop zone
    const constrainPosition = useCallback((pos: { x: number; y: number }, currentScale: number) => {
      if (!imgRef.current) return pos;
      
      const img = imgRef.current;
      const scaledWidth = img.naturalWidth * currentScale;
      const scaledHeight = img.naturalHeight * currentScale;
      
      const maxX = Math.max(0, (scaledWidth - cropZone.width) / 2);
      const maxY = Math.max(0, (scaledHeight - cropZone.height) / 2);
      
      return {
        x: Math.max(-maxX, Math.min(maxX, pos.x)),
        y: Math.max(-maxY, Math.min(maxY, pos.y)),
      };
    }, [cropZone]);

    // Touch/mouse handlers for panning
    const handlePointerDown = (e: React.PointerEvent) => {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
      if (!isDragging) return;
      const newPos = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      };
      setPosition(constrainPosition(newPos, scale));
    };

    const handlePointerUp = (e: React.PointerEvent) => {
      setIsDragging(false);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    };

    // Wheel zoom
    const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newScale = Math.max(minScale, Math.min(minScale * 3, scale + delta));
      setScale(newScale);
      setPosition(constrainPosition(position, newScale));
    };

    // Reset
    const handleReset = () => {
      setScale(minScale);
      setPosition({ x: 0, y: 0 });
    };

    // Zoom controls
    const handleZoomIn = () => {
      const newScale = Math.min(minScale * 3, scale + 0.15);
      setScale(newScale);
      setPosition(constrainPosition(position, newScale));
    };

    const handleZoomOut = () => {
      const newScale = Math.max(minScale, scale - 0.15);
      setScale(newScale);
      setPosition(constrainPosition(position, newScale));
    };

    // Crop and export
    const handleComplete = async () => {
      if (!imgRef.current) return;
      
      const img = imgRef.current;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      
      // Output dimensions (high quality)
      const outputWidth = mode === "avatar" ? 400 : mode === "cover" ? 1200 : 600;
      const outputHeight = outputWidth / aspectRatio;
      
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      
      // Calculate source rectangle from the image
      const scaledWidth = img.naturalWidth * scale;
      const scaledHeight = img.naturalHeight * scale;
      
      // Center of crop zone in scaled image coordinates
      const centerX = scaledWidth / 2 - position.x;
      const centerY = scaledHeight / 2 - position.y;
      
      // Source rectangle in original image coordinates
      const srcX = (centerX - cropZone.width / 2) / scale;
      const srcY = (centerY - cropZone.height / 2) / scale;
      const srcWidth = cropZone.width / scale;
      const srcHeight = cropZone.height / scale;
      
      ctx.drawImage(
        img,
        srcX,
        srcY,
        srcWidth,
        srcHeight,
        0,
        0,
        outputWidth,
        outputHeight
      );
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            onCropComplete(blob);
          }
        },
        "image/jpeg",
        0.92
      );
    };

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 bg-black/80 backdrop-blur-sm">
          <button
            onClick={onCancel}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <h3 className="text-white font-medium text-sm uppercase tracking-wider">
            {mode === "avatar" ? "Profile Photo" : mode === "cover" ? "Cover Photo" : "Poster"}
          </h3>
          <button
            onClick={handleComplete}
            className="w-10 h-10 rounded-full bg-electric flex items-center justify-center text-white shadow-electric"
          >
            <Check className="w-5 h-5" />
          </button>
        </div>

        {/* Crop Area */}
        <div 
          ref={containerRef}
          className="flex-1 relative overflow-hidden flex items-center justify-center"
          onWheel={handleWheel}
        >
          {/* Dark overlay mask */}
          <div className="absolute inset-0 bg-black/80 pointer-events-none" />
          
          {/* Image container */}
          <div
            className="absolute cursor-grab active:cursor-grabbing touch-none"
            style={{
              width: imgRef.current ? imgRef.current.naturalWidth * scale : "auto",
              height: imgRef.current ? imgRef.current.naturalHeight * scale : "auto",
              transform: `translate(${position.x}px, ${position.y}px)`,
              willChange: "transform",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop preview"
              onLoad={handleImageLoad}
              className="select-none"
              style={{
                width: imgRef.current ? imgRef.current.naturalWidth * scale : "auto",
                height: imgRef.current ? imgRef.current.naturalHeight * scale : "auto",
                maxWidth: "none",
              }}
              draggable={false}
            />
          </div>

          {/* Crop zone window (bright area) */}
          {cropZone.width > 0 && (
            <div
              className="absolute pointer-events-none"
              style={{
                width: cropZone.width,
                height: cropZone.height,
                boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.75)",
                borderRadius: isCircular ? "50%" : "8px",
              }}
            >
              {/* Rule of thirds grid */}
              <div className="absolute inset-0 opacity-40" style={{ borderRadius: isCircular ? "50%" : "8px", overflow: "hidden" }}>
                {/* Vertical lines */}
                <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/60" />
                <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/60" />
                {/* Horizontal lines */}
                <div className="absolute top-1/3 left-0 right-0 h-px bg-white/60" />
                <div className="absolute top-2/3 left-0 right-0 h-px bg-white/60" />
              </div>
              
              {/* Border */}
              <div 
                className="absolute inset-0 border-2 border-white/80"
                style={{ borderRadius: isCircular ? "50%" : "8px" }}
              />
              
              {/* Corner indicators (non-circular only) */}
              {!isCircular && (
                <>
                  <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-white rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-white rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-white rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-white rounded-br-lg" />
                </>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="px-6 py-8 bg-black/80 backdrop-blur-sm">
          <div className="flex items-center justify-center gap-8">
            <button
              onClick={handleZoomOut}
              className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/80 hover:bg-white/20 transition-colors"
            >
              <span className="text-2xl font-light">−</span>
            </button>
            <button
              onClick={handleReset}
              className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/80 hover:bg-white/20 transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button
              onClick={handleZoomIn}
              className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/80 hover:bg-white/20 transition-colors"
            >
              <span className="text-2xl font-light">+</span>
            </button>
          </div>
          <p className="text-center text-white/50 text-xs mt-4">
            Pinch or scroll to zoom • Drag to position
          </p>
        </div>
      </motion.div>
    );
  }
);
