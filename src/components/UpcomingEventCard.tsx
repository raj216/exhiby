import { motion } from "framer-motion";
import { BadgeCheck, Bell, BellRing, Calendar, Check, Loader2, Share } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { triggerClickHaptic } from "@/lib/haptics";
import { format } from "date-fns";
import { useSavedSessions } from "@/hooks/useSavedSessions";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useProfilePrefetch } from "@/hooks/useProfilePrefetch";
interface UpcomingEventCardProps {
  id: string;
  coverImage: string;
  title: string;
  scheduledAt: string;
  price: number;
  isFree: boolean;
  category?: string;
  description?: string;
  artistName?: string;
  artistAvatar?: string;
  artistIsVerified?: boolean;
  creatorId?: string;
  onClick?: () => void;
  onRemind?: () => void;
  desktopSize?: boolean;
}

export function UpcomingEventCard({
  id,
  coverImage,
  title,
  scheduledAt,
  price,
  isFree,
  category,
  description,
  artistName,
  artistAvatar,
  artistIsVerified,
  creatorId,
  onClick,
  onRemind,
  desktopSize = false,
}: UpcomingEventCardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isEventSaved, saveSession, removeSession } = useSavedSessions();
  const { prefetchProfile } = useProfilePrefetch();
  const [isLoading, setIsLoading] = useState(false);
  
  // Check if this event is already saved
  const isSaved = isEventSaved(id);

  // Prefetch profile on hover for instant navigation
  const handleCreatorHover = () => {
    if (creatorId) {
      prefetchProfile(creatorId);
    }
  };

  const handleRemind = async (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerClickHaptic();
    
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to set reminders",
      });
      return;
    }
    
    if (!creatorId) {
      // Fallback to old behavior if no creatorId
      onRemind?.();
      return;
    }
    
    // Prevent saving own events
    if (user.id === creatorId) {
      toast({
        title: "Can't remind yourself",
        description: "This is your own studio session",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      if (isSaved) {
        const success = await removeSession(id);
        if (success) {
          toast({ title: "Reminder removed" });
        }
      } else {
        const success = await saveSession(id, creatorId);
        if (success) {
          toast({
            title: "Reminder set!",
            description: "We'll notify you when this studio starts",
          });
          onRemind?.();
        }
      }
    } catch (error) {
      console.error("Error toggling reminder:", error);
      toast({
        title: "Error",
        description: "Failed to update reminder",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCardTap = () => {
    triggerClickHaptic();
    onClick?.();
  };

  const handleCreatorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerClickHaptic();
    
    if (!creatorId) return;
    
    // Navigate to the creator's profile, preserving return context.
    const baseState =
      location.state && typeof location.state === "object" ? (location.state as Record<string, unknown>) : {};
    const returnTo = {
      pathname: location.pathname,
      search: location.search,
      state: baseState,
    };

    try {
      sessionStorage.setItem("exhiby_return_to", JSON.stringify(returnTo));
    } catch {
      // ignore
    }

    // If it's the current user, PublicProfile will redirect to internal profile.
    navigate(`/profile/${creatorId}`, { state: { returnTo } });
  };

  // Format the scheduled date
  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, "MMM d • h:mm a");
  };

  return (
    <motion.div
      className="w-full flex-shrink-0 snap-center flex flex-col cursor-pointer"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleCardTap}
    >
      {/* Artist Header - Above Image (if available) */}
      {artistName && (
        <div 
          className="flex items-center gap-2 mb-2 px-1 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleCreatorClick}
          onMouseEnter={handleCreatorHover}
        >
          {artistAvatar ? (
            <img 
              src={artistAvatar} 
              alt={artistName}
              className="w-8 h-8 rounded-full object-cover border border-border/30"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border border-border/30">
              <span className="text-xs font-medium text-muted-foreground">
                {artistName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-medium text-foreground truncate">{artistName}</span>
            {artistIsVerified === true && (
              <BadgeCheck className="w-4 h-4 text-gold fill-gold/20 flex-shrink-0" />
            )}
          </div>
        </div>
      )}

      {/* Image Container */}
      <div 
        className={`poster-card relative w-full rounded-xl overflow-hidden ${desktopSize ? 'aspect-[4/5]' : ''}`} 
        style={{ minHeight: desktopSize ? undefined : '200px' }}
      >
        {/* Cover Image */}
        <img
          src={coverImage}
          alt={title}
          className="w-full h-full object-cover"
        />

        {/* Date Badge - Top Left */}
        <div className="absolute top-3 left-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-obsidian/80 backdrop-blur-sm border border-border/30">
            <Calendar className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground whitespace-nowrap">
              {formatEventDate(scheduledAt)}
            </span>
          </div>
        </div>

        {/* Price Badge - Top Right */}
        <div className="absolute top-3 right-3">
          <div className={`inline-flex items-center px-2.5 py-1.5 rounded-full ${
            isFree 
              ? 'bg-muted/80 border border-border/40' 
              : 'bg-accent/15 border border-accent/40'
          }`}>
            <span className={`text-xs font-semibold ${
              isFree ? 'text-muted-foreground' : 'text-accent'
            }`}>
              {isFree ? "Free" : `$${price}`}
            </span>
          </div>
        </div>

        {/* Bottom Section - inside image */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-carbon via-carbon/80 to-transparent">
          <div className="flex items-stretch gap-2">
            {/* Remind Me Button - flex-1 */}
            <button 
              onClick={handleRemind}
              disabled={isLoading}
              className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all duration-luxury ease-luxury disabled:opacity-50 ${
                isSaved 
                  ? 'bg-electric/10 text-electric border border-electric/50' 
                  : 'bg-transparent border border-electric/60 text-electric/90 hover:bg-electric/10 hover:text-electric'
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  Reminder Set
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  Remind Me
                </>
              )}
            </button>
            
            {/* Share Button - Square */}
            <button
              onClick={async (e) => {
                e.stopPropagation();
                triggerClickHaptic();
                
                const shareUrl = `${window.location.origin}/s/${id}`;
                const shareData = {
                  title: title,
                  text: "Join this session on Exhiby!",
                  url: shareUrl,
                };
                
                if (navigator.share && navigator.canShare?.(shareData)) {
                  try {
                    await navigator.share(shareData);
                  } catch (err) {
                    // User cancelled or share failed silently
                    if ((err as Error).name !== 'AbortError') {
                      console.error('Share failed:', err);
                    }
                  }
                } else {
                  // Fallback: copy to clipboard
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    toast({
                      title: "Link Copied",
                      description: "Event link copied to clipboard",
                    });
                  } catch (err) {
                    console.error('Clipboard failed:', err);
                  }
                }
              }}
              className="aspect-square h-full px-3 rounded-lg bg-muted/50 border border-border/50 flex items-center justify-center hover:bg-muted transition-all duration-luxury"
            >
              <Share className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Info Section - below image */}
      <div className="pt-3 pb-1 px-1">
        {/* Title - 2 lines max */}
        <h3 className="font-display text-base sm:text-lg text-foreground font-semibold line-clamp-2 leading-tight">
          {title}
        </h3>
        
        {/* Category • Description */}
        {(category || description) && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
            {category && <span>{category}</span>}
            {category && description && <span className="mx-1">•</span>}
            {description && <span>{description}</span>}
          </p>
        )}
      </div>
    </motion.div>
  );
}
