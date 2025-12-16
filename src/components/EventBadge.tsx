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
      {/* Badge container with shine effect */}
      <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/30 shadow-lg">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover"
        />
        {/* Shine overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent" />
        {/* Badge corner ribbon */}
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-md">
          <span className="text-[10px] font-bold text-primary-foreground">✓</span>
        </div>
      </div>
      <p className="mt-2 text-xs font-medium text-foreground text-center line-clamp-2 w-20">
        {title}
      </p>
      <p className="text-[10px] text-muted-foreground">{date}</p>
    </motion.div>
  );
}
