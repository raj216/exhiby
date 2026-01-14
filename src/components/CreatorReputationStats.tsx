import { motion } from "framer-motion";
import { BarChart2, Star, Users } from "lucide-react";

interface CreatorReputationStatsProps {
  sessionsHosted: number;
  averageRating: number;
  totalGuests: number;
}

export function CreatorReputationStats({
  sessionsHosted,
  averageRating,
  totalGuests,
}: CreatorReputationStatsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22 }}
      className="flex items-center justify-center gap-4 text-sm text-muted-foreground flex-wrap"
    >
      <div className="flex items-center gap-1.5">
        <BarChart2 className="w-4 h-4 text-electric" />
        <span>
          <span className="text-foreground font-medium">{sessionsHosted}</span>{" "}
          sessions hosted
        </span>
      </div>
      
      <span className="text-border">|</span>
      
      <div className="flex items-center gap-1.5">
        <Star className="w-4 h-4 text-gold" />
        <span>
          {averageRating > 0 ? (
            <>
              <span className="text-foreground font-medium">{averageRating.toFixed(1)}</span>{" "}
              rating
            </>
          ) : (
            <span className="text-muted-foreground/70">No ratings yet</span>
          )}
        </span>
      </div>
      
      <span className="text-border">|</span>
      
      <div className="flex items-center gap-1.5">
        <Users className="w-4 h-4 text-electric" />
        <span>
          <span className="text-foreground font-medium">{totalGuests}</span>{" "}
          guests
        </span>
      </div>
    </motion.div>
  );
}
