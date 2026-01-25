import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";

interface LiveCountdownProps {
  targetDate: Date;
  onComplete?: () => void;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function calculateTimeRemaining(targetDate: Date): TimeRemaining {
  const now = Date.now();
  const total = targetDate.getTime() - now;
  
  if (total <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  }
  
  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  
  return { days, hours, minutes, seconds, total };
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <motion.div 
        key={value}
        initial={{ scale: 1.1, opacity: 0.8 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-electric/15 border border-electric/30 flex items-center justify-center"
      >
        <span className="text-xl sm:text-2xl font-display font-bold text-electric">
          {value.toString().padStart(2, "0")}
        </span>
      </motion.div>
      <span className="text-xs text-muted-foreground mt-1.5 uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

export function LiveCountdown({ targetDate, onComplete }: LiveCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>(() => 
    calculateTimeRemaining(targetDate)
  );
  
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining(targetDate);
      setTimeRemaining(remaining);
      
      if (remaining.total <= 0) {
        clearInterval(interval);
        onComplete?.();
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [targetDate, onComplete]);
  
  // Show different layouts based on time remaining
  const showDays = timeRemaining.days > 0;
  const showHours = timeRemaining.days > 0 || timeRemaining.hours > 0;
  
  if (timeRemaining.total <= 0) {
    return (
      <div className="flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full bg-electric animate-pulse" />
        <span className="text-lg font-semibold text-electric">Starting any moment...</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      {showDays && (
        <>
          <TimeUnit value={timeRemaining.days} label="Days" />
          <span className="text-xl text-muted-foreground/50 font-light self-start mt-4">:</span>
        </>
      )}
      {showHours && (
        <>
          <TimeUnit value={timeRemaining.hours} label="Hours" />
          <span className="text-xl text-muted-foreground/50 font-light self-start mt-4">:</span>
        </>
      )}
      <TimeUnit value={timeRemaining.minutes} label="Min" />
      <span className="text-xl text-muted-foreground/50 font-light self-start mt-4">:</span>
      <TimeUnit value={timeRemaining.seconds} label="Sec" />
    </div>
  );
}
