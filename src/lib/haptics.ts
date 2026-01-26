// Haptic feedback utility for premium tactile feel
export const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'pulse' = 'light') => {
  if ('vibrate' in navigator) {
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30],
      pulse: [15, 50, 15], // Double pulse for attention-grabbing notifications
    };
    navigator.vibrate(patterns[type]);
  }
};

export const triggerClickHaptic = () => triggerHaptic('light');
export const triggerSuccessHaptic = () => triggerHaptic('medium');
export const triggerActionHaptic = () => triggerHaptic('heavy');
export const triggerNotificationHaptic = () => triggerHaptic('pulse');
