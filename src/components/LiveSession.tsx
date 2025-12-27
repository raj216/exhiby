import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Users, MessageCircle, Gift, Package } from "lucide-react";
import { ProductDropCard } from "./ProductDropCard";
import { useLiveViewers } from "@/hooks/useLiveViewers";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface LiveSessionProps {
  eventData: {
    coverImage: string | null;
    title: string;
    category: string;
    price: number;
    eventId?: string;
    creatorId?: string;
  };
  onClose: () => void;
}

export function LiveSession({ eventData, onClose }: LiveSessionProps) {
  const [showProductDrop, setShowProductDrop] = useState(false);
  const { viewerCount } = useLiveViewers(eventData.eventId || null);
  const { user } = useAuth();

  // End session: set is_live to false (with creator verification)
  const handleClose = async () => {
    if (eventData.eventId) {
      // Verify current user is the creator before attempting update
      if (!user || (eventData.creatorId && user.id !== eventData.creatorId)) {
        toast.error("You don't have permission to end this session");
        onClose();
        return;
      }
      
      const { error } = await supabase
        .from("events")
        .update({
          is_live: false,
          end_time: new Date().toISOString(),
        })
        .eq("id", eventData.eventId);
      
      if (error) {
        toast.error("Failed to end session");
      }
    }
    onClose();
  };

  const handleDropProduct = () => {
    setShowProductDrop(true);
  };

  const handlePurchaseComplete = () => {
    setShowProductDrop(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-background z-50"
    >
      {/* Video Feed Placeholder */}
      <div className="absolute inset-0">
        {eventData.coverImage && (
          <img
            src={eventData.coverImage}
            alt=""
            className="w-full h-full object-cover opacity-40"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/50" />
      </div>

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10">
        {/* Live Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-live" />
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-live animate-ping" />
            </div>
            <span className="text-xs font-semibold">LIVE</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass">
            <Users className="w-4 h-4 text-muted-foreground" />
            <motion.span 
              key={viewerCount}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="text-xs"
            >
              {viewerCount}
            </motion.span>
          </div>
        </div>

        {/* Close */}
        <button onClick={handleClose} className="p-2 rounded-full glass">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Session Info */}
      <div className="absolute bottom-32 left-0 right-0 px-4">
        <h2 className="font-serif text-2xl text-foreground mb-1">
          {eventData.title || "Untitled Session"}
        </h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {eventData.price === 0 ? "Free Entry" : `$${eventData.price} Entry`}
          </span>
          <span>•</span>
          <span>
            {eventData.category === "reveal"
              ? "The Reveal"
              : eventData.category === "workshop"
              ? "The Workshop"
              : "Studio Hangout"}
          </span>
        </div>
      </div>

      {/* Creator Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 glass">
        <div className="flex items-center justify-around">
          <button className="flex flex-col items-center gap-1 text-muted-foreground">
            <div className="p-3 rounded-full bg-surface-elevated">
              <MessageCircle className="w-5 h-5" />
            </div>
            <span className="text-xs">Chat</span>
          </button>

          <button className="flex flex-col items-center gap-1 text-muted-foreground">
            <div className="p-3 rounded-full bg-surface-elevated">
              <Gift className="w-5 h-5" />
            </div>
            <span className="text-xs">Tips</span>
          </button>

          {/* Drop Product Button */}
          <button
            onClick={handleDropProduct}
            className="flex flex-col items-center gap-1"
          >
            <div className="p-3 rounded-full bg-gradient-gold shadow-gold">
              <Package className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xs text-primary font-medium">Drop Product</span>
          </button>
        </div>
      </div>

      {/* Product Drop Card */}
      <ProductDropCard
        isOpen={showProductDrop}
        onClose={() => setShowProductDrop(false)}
        productTitle="Reference Photo + Brush Pack"
        price={5}
        onPurchase={handlePurchaseComplete}
      />
    </motion.div>
  );
}
