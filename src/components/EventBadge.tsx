import { motion } from "framer-motion";

interface EventBadgeProps {
  title: string;
  image: string;
  date: string;
  index?: number;
}

export function EventBadge({ title, image, date, index = 0 }: EventBadgeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 }}
      className="relative flex flex-col items-center"
    >
      {/* Badge container with Gold shine effect */}
      <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 shadow-gold"
        style={{
          background: "linear-gradient(135deg, hsl(43 72% 52% / 0.2), hsl(43 72% 52% / 0.05))",
          borderColor: "hsl(43 72% 52% / 0.3)"
        }}
      >
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover"
        />
        {/* Shine overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent" />
        {/* Badge corner ribbon */}
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center shadow-md"
          style={{
            background: "linear-gradient(135deg, hsl(43 72% 52%), hsl(38 80% 45%))"
          }}
        >
          <span className="text-[10px] font-bold text-carbon">✓</span>
        </div>
      </div>
      <p className="mt-2 text-xs font-medium text-foreground text-center line-clamp-2 w-20">
        {title}
      </p>
      <p className="text-[10px] text-muted-foreground">{date}</p>
    </motion.div>
  );
}