import { useState } from "react";
import { motion } from "framer-motion";

interface PriceSliderProps {
  value: number;
  onChange: (value: number) => void;
}

const priceStops = [0, 1, 5, 10, 50];

export function PriceSlider({ value, onChange }: PriceSliderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const currentIndex = priceStops.indexOf(value);
  const percentage = (currentIndex / (priceStops.length - 1)) * 100;

  const handleStopClick = (price: number) => {
    onChange(price);
  };

  return (
    <div className="py-6">
      {/* Price Display */}
      <div className="text-center mb-8">
        <motion.div
          key={value}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-block"
        >
          <span className="text-5xl font-serif text-gradient-gold">
            {value === 0 ? "Free" : `$${value}`}
          </span>
        </motion.div>
      </div>

      {/* Slider Track */}
      <div className="relative h-2 bg-surface-elevated rounded-full mx-4">
        {/* Filled Track */}
        <motion.div
          className="absolute left-0 top-0 h-full bg-gradient-gold rounded-full"
          animate={{ width: `${percentage}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />

        {/* Price Stops */}
        <div className="absolute inset-0 flex justify-between items-center">
          {priceStops.map((price, index) => {
            const isActive = priceStops.indexOf(value) >= index;
            const isCurrent = value === price;

            return (
              <button
                key={price}
                onClick={() => handleStopClick(price)}
                className="relative -translate-y-1/2 top-1/2"
              >
                <motion.div
                  className={`w-6 h-6 rounded-full border-2 transition-colors ${
                    isActive
                      ? "bg-primary border-primary"
                      : "bg-surface border-border"
                  }`}
                  animate={isCurrent ? { scale: 1.3 } : { scale: 1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {isCurrent && (
                    <motion.div
                      className="absolute inset-0 rounded-full bg-primary/30"
                      animate={{ scale: [1, 1.5, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}
                </motion.div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-4 px-2">
        {priceStops.map((price) => (
          <button
            key={price}
            onClick={() => handleStopClick(price)}
            className={`text-sm transition-colors ${
              value === price
                ? "text-primary font-semibold"
                : "text-muted-foreground"
            }`}
          >
            {price === 0 ? "Free" : `$${price}`}
          </button>
        ))}
      </div>
    </div>
  );
}
