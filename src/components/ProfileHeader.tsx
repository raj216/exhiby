import { motion } from "framer-motion";
import { BadgeCheck, Pencil, GraduationCap, Trophy } from "lucide-react";

interface ProfileHeaderProps {
  coverImage: string;
  avatarImage: string;
  name: string;
  handle?: string | null;
  bio: string;
  isLive?: boolean;
  livePreviewUrl?: string;
  signatureImage?: string;
  tags: Array<{
    icon: string;
    label: string;
  }>;
  isVerified?: boolean;
}

const tagIcons: Record<string, typeof Pencil> = {
  pencil: Pencil,
  teacher: GraduationCap,
  trophy: Trophy,
};

export function ProfileHeader({
  coverImage,
  avatarImage,
  name,
  handle,
  bio,
  isLive = false,
  livePreviewUrl,
  signatureImage,
  tags,
  isVerified = false,
}: ProfileHeaderProps) {
  return (
    <div className="relative">
      {/* Dynamic Banner with Cinematic Vignette */}
      <div className="relative h-64 w-full overflow-hidden">
        {isLive && livePreviewUrl ? (
          <video
            src={livePreviewUrl}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={coverImage}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        )}
        
        {/* Live indicator with Hyper-Crimson glow */}
        {isLive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-crimson/90 backdrop-blur-sm flex items-center gap-2 live-ring"
          >
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-xs font-semibold text-white">LIVE NOW</span>
          </motion.div>
        )}
        
        {/* Signature overlay */}
        {signatureImage && (
          <img
            src={signatureImage}
            alt="Artist signature"
            className="absolute bottom-4 right-4 h-12 w-auto opacity-60"
          />
        )}
      </div>

      {/* Avatar overlapping banner */}
      <div className="relative px-4 -mt-16">
        <div className="flex items-end gap-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="relative"
          >
            <div className={`w-28 h-28 rounded-full border-4 border-carbon overflow-hidden bg-obsidian ${isLive ? 'live-ring' : ''}`}>
              <img
                src={avatarImage}
                alt={name}
                className="w-full h-full object-cover"
              />
            </div>
            {isLive && (
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-crimson text-white text-xs font-bold">
                LIVE
              </div>
            )}
          </motion.div>

          <div className="flex-1 pb-2">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl text-foreground">{handle ? `@${handle}` : name}</h1>
              {isVerified && (
                <BadgeCheck className="w-5 h-5 text-gold fill-gold/20" />
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{name}</p>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {bio}
            </p>
          </div>
        </div>

        {/* Tags / Pills with Gold border */}
        <div className="flex flex-wrap gap-2 mt-4">
          {tags.map((tag, index) => {
            const IconComponent = tagIcons[tag.icon] || Pencil;
            return (
              <motion.button
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.05 }}
                whileTap={{ scale: 0.95 }}
                className="badge-gold flex items-center gap-1.5"
              >
                <IconComponent className="w-3.5 h-3.5" />
                <span>{tag.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}