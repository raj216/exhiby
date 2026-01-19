import { motion } from "framer-motion";
import { Home, Star, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StreamEndedScreenProps {
  creatorName: string;
  creatorAvatar: string | null;
  sessionTitle: string;
  coverUrl?: string | null;
  onBackToCreator: () => void;
  onExploreStudios: () => void;
}

export function StreamEndedScreen({
  creatorName,
  creatorAvatar,
  sessionTitle,
  coverUrl,
  onBackToCreator,
  onExploreStudios,
}: StreamEndedScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 bg-background z-50 flex items-center justify-center"
    >
      {/* Background with subtle artwork */}
      {coverUrl && (
        <div className="absolute inset-0 overflow-hidden">
          <motion.img
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1.15, opacity: 0.08 }}
            transition={{ duration: 0.8 }}
            src={coverUrl}
            alt=""
            className="w-full h-full object-cover blur-2xl"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/95 to-background/80" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 text-center max-w-md px-6">
        {/* Creator Avatar */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 20 }}
          className="mb-6"
        >
          {creatorAvatar ? (
            <img
              src={creatorAvatar}
              alt={creatorName}
              className="w-20 h-20 rounded-full mx-auto border-2 border-border/50 shadow-xl"
            />
          ) : (
            <div className="w-20 h-20 rounded-full mx-auto bg-muted flex items-center justify-center border-2 border-border/50 shadow-xl">
              <User className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          <h1 className="text-2xl font-display text-foreground mb-3">
            Studio Session Ended
          </h1>
          <p className="text-muted-foreground mb-3">
            Thanks for being here.
          </p>
          <p className="text-sm text-muted-foreground/70">
            {sessionTitle}
          </p>
          <p className="text-sm text-foreground/80 mt-1">
            by {creatorName}
          </p>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 space-y-3"
        >
          <Button
            onClick={onBackToCreator}
            className="w-full py-6 rounded-xl font-semibold gap-2"
            style={{
              background: "linear-gradient(135deg, hsl(7 100% 67%), hsl(345 100% 50%))",
            }}
          >
            <Star className="w-4 h-4" />
            Leave a Rating
          </Button>
          
          <Button
            onClick={onExploreStudios}
            variant="outline"
            className="w-full py-6 rounded-xl font-medium gap-2 border-border hover:bg-muted/50"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
