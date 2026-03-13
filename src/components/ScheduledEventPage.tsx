import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, BellOff, Play, Calendar, Clock } from "lucide-react";
import { SlideToAction } from "./SlideToAction";
import { triggerHaptic } from "@/lib/haptics";
import { toast } from "sonner";
import { calculateProcessingFee } from "@/lib/processingFee";

interface ScheduledEventPageProps {
  isOpen: boolean;
  onClose: () => void;
  onBuyTicket: () => void;
  artistName: string;
  eventTitle: string;
  price: number;
  coverImage: string;
  scheduledTime: string;
  description?: string;
  hasTrailer?: boolean;
}

export function ScheduledEventPage({
  isOpen,
  onClose,
  onBuyTicket,
  artistName,
  eventTitle,
  price,
  coverImage,
  scheduledTime,
  description,
  hasTrailer = false,
}: ScheduledEventPageProps) {
  const [reminded, setReminded] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);

  const handleRemindMe = () => {
    triggerHaptic("medium");
    setReminded(!reminded);
    toast.success(
      reminded ? "Reminder removed" : "You'll be notified when doors open"
    );
  };

  const handleBuyTicket = () => {
    triggerHaptic("medium");
    onBuyTicket();
    toast.success("Ticket secured! Added to your Passport");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-carbon overflow-y-auto"
        >
          {/* Movie Poster Style Layout */}
          <div className="min-h-screen flex flex-col">
            {/* Hero Cover Image */}
            <div className="relative h-[60vh] overflow-hidden">
              <img
                src={coverImage}
                alt={eventTitle}
                className="w-full h-full object-cover"
              />
              
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-carbon via-carbon/50 to-transparent" />

              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-3 rounded-full glass z-10"
              >
                <X className="w-5 h-5 text-foreground" />
              </button>

              {/* Trailer Play Button */}
              {hasTrailer && (
                <button
                  onClick={() => setShowTrailer(true)}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div className="p-4 rounded-full bg-electric/20 backdrop-blur-sm border border-electric/50">
                    <Play className="w-8 h-8 text-electric fill-electric" />
                  </div>
                </button>
              )}

              {/* Event Info Overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <p className="text-sm text-electric font-medium mb-2">
                  {artistName}
                </p>
                <h1 className="font-display text-3xl text-foreground mb-4">
                  {eventTitle}
                </h1>

                {/* Countdown / Schedule Badge */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-obsidian/80 backdrop-blur-sm border border-border/30">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">{scheduledTime}</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-obsidian/80 backdrop-blur-sm border border-border/30">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">~60 min</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Section */}
            <div className="flex-1 p-6 -mt-4">
              {/* Price Tag */}
              {price === 0 ? (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-obsidian border border-gold/30 mb-6">
                  <span className="text-gold font-semibold text-lg">Free Entry</span>
                </div>
              ) : (
                <div className="bg-obsidian/80 rounded-xl px-4 py-3 border border-border/30 space-y-1.5 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Entry ticket</span>
                    <span className="text-foreground">${price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Processing fee</span>
                    <span className="text-foreground">${calculateProcessingFee(price).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-1.5 border-t border-border/30">
                    <span className="text-foreground font-semibold">Total</span>
                    <span className="text-gold font-semibold">${(price + calculateProcessingFee(price)).toFixed(2)}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground/70 pt-1">
                    Processing fee supports secure card payments via Stripe.
                  </p>
                </div>
              )}

              {/* Description */}
              {description && (
                <p className="text-muted-foreground leading-relaxed mb-8">
                  {description}
                </p>
              )}

              {/* Action Buttons */}
              <div className="space-y-4">
                {/* Remind Me Button */}
                <button
                  onClick={handleRemindMe}
                  className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl border transition-all ${
                    reminded
                      ? "bg-electric/10 border-electric/50 text-electric"
                      : "bg-obsidian border-border/30 text-foreground hover:border-electric/50"
                  }`}
                >
                  {reminded ? (
                    <>
                      <BellOff className="w-5 h-5" />
                      <span className="font-medium">Reminder Set</span>
                    </>
                  ) : (
                    <>
                      <Bell className="w-5 h-5" />
                      <span className="font-medium">Remind Me</span>
                    </>
                  )}
                </button>

                {/* Buy Ticket - Slide Action */}
                <SlideToAction
                  onComplete={handleBuyTicket}
                  label={price === 0 ? "Slide to RSVP" : `Slide to Buy Ticket`}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
