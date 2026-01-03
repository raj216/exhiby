import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { triggerHaptic } from "@/lib/haptics";

interface LiveAccessCardProps {
  eventId: string;
  title: string;
  thumbnailUrl?: string | null;
}

export function LiveAccessCard({ eventId, title, thumbnailUrl }: LiveAccessCardProps) {
  const navigate = useNavigate();

  const handleJoin = () => {
    triggerHaptic("medium");
    navigate(`/live/${eventId}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      onClick={handleJoin}
      className="relative overflow-hidden rounded-2xl cursor-pointer group"
      style={{
        background: "rgba(20, 20, 20, 0.8)",
        border: "1px solid rgba(255, 59, 48, 0.5)",
        boxShadow: "0 0 30px rgba(255, 59, 48, 0.15)",
      }}
    >
      {/* Inner glow effect */}
      <div 
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at top left, rgba(255, 59, 48, 0.2), transparent 60%)",
        }}
      />

      <div className="relative flex items-center gap-4 p-4">
        {/* Thumbnail */}
        <div className="relative w-24 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-obsidian">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
            </div>
          )}
          {/* Live overlay on thumbnail */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Live Now indicator */}
          <div className="flex items-center gap-2 mb-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
            </span>
            <span 
              className="text-xs font-bold uppercase tracking-wide"
              style={{ color: "#FF3B30" }}
            >
              Live Now
            </span>
          </div>
          
          {/* Stream Title */}
          <p className="text-foreground font-semibold text-sm line-clamp-1">
            {title}
          </p>
        </div>

        {/* Join Button */}
        <Button
          onClick={(e) => {
            e.stopPropagation();
            handleJoin();
          }}
          className="flex-shrink-0 rounded-full px-5 font-semibold"
          style={{
            background: "#FF3B30",
            color: "white",
          }}
        >
          Join
        </Button>
      </div>

      {/* Animated border glow */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          border: "1px solid rgba(255, 59, 48, 0.5)",
        }}
        animate={{
          boxShadow: [
            "0 0 20px rgba(255, 59, 48, 0.2)",
            "0 0 30px rgba(255, 59, 48, 0.35)",
            "0 0 20px rgba(255, 59, 48, 0.2)",
          ],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </motion.div>
  );
}
