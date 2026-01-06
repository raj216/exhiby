import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        md: "2rem",
        lg: "4rem",
      },
      screens: {
        sm: "100%",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Clash Display', 'serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Brand colors
        electric: {
          DEFAULT: "hsl(var(--electric-clay))",
          clay: "hsl(var(--electric-clay))",
        },
        crimson: {
          DEFAULT: "hsl(var(--hyper-crimson))",
          hyper: "hsl(var(--hyper-crimson))",
        },
        gold: {
          DEFAULT: "hsl(var(--muted-gold))",
          muted: "hsl(var(--muted-gold))",
        },
        carbon: {
          DEFAULT: "hsl(var(--carbon-black))",
          black: "hsl(var(--carbon-black))",
        },
        obsidian: {
          DEFAULT: "hsl(var(--obsidian-glass))",
          glass: "hsl(var(--obsidian-glass))",
        },
        surface: {
          DEFAULT: "hsl(var(--surface))",
          elevated: "hsl(var(--surface-elevated))",
          overlay: "hsl(var(--surface-overlay))",
        },
        live: "hsl(var(--live))",
        success: "hsl(var(--success))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      backdropBlur: {
        '3xl': '64px',
      },
      /* Luxury Motion System - Calm, deliberate, premium timing */
      transitionTimingFunction: {
        'luxury': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'luxury-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'luxury-in-out': 'cubic-bezier(0.45, 0, 0.15, 1)',
      },
      transitionDuration: {
        'luxury': '400ms',
        'luxury-slow': '500ms',
        'luxury-fast': '300ms',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0", opacity: "0" },
          to: { height: "var(--radix-accordion-content-height)", opacity: "1" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)", opacity: "1" },
          to: { height: "0", opacity: "0" },
        },
        /* Luxury slide - minimal vertical movement */
        "slide-up": {
          from: { transform: "translateY(16px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "slide-down": {
          from: { transform: "translateY(0)", opacity: "1" },
          to: { transform: "translateY(16px)", opacity: "0" },
        },
        /* Premium fade - deliberate timing */
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        /* Subtle scale - never exaggerated */
        "scale-in": {
          from: { transform: "scale(0.98)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
        "scale-out": {
          from: { transform: "scale(1)", opacity: "1" },
          to: { transform: "scale(0.98)", opacity: "0" },
        },
        /* Modal entry - fade with minimal vertical movement */
        "modal-in": {
          from: { transform: "scale(0.98) translateY(8px)", opacity: "0" },
          to: { transform: "scale(1) translateY(0)", opacity: "1" },
        },
        "modal-out": {
          from: { transform: "scale(1) translateY(0)", opacity: "1" },
          to: { transform: "scale(0.98) translateY(8px)", opacity: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-glow": {
          "0%, 100%": { 
            boxShadow: "0 0 0 3px hsl(var(--hyper-crimson) / 0.5), 0 0 20px hsl(var(--hyper-crimson) / 0.4)" 
          },
          "50%": { 
            boxShadow: "0 0 0 4px hsl(var(--hyper-crimson) / 0.7), 0 0 30px hsl(var(--hyper-crimson) / 0.6)" 
          },
        },
      },
      animation: {
        /* Luxury timing - slower, deliberate, calm */
        "accordion-down": "accordion-down 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
        "accordion-up": "accordion-up 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
        "slide-up": "slide-up 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
        "slide-down": "slide-down 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
        "fade-in": "fade-in 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
        "fade-out": "fade-out 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
        "scale-in": "scale-in 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
        "scale-out": "scale-out 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
        "modal-in": "modal-in 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
        "modal-out": "modal-out 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
        shimmer: "shimmer 3s cubic-bezier(0.45, 0, 0.15, 1) infinite",
        "pulse-glow": "pulse-glow 2.5s cubic-bezier(0.45, 0, 0.15, 1) infinite",
      },
      backgroundImage: {
        "gradient-electric": "linear-gradient(135deg, hsl(var(--electric-clay)), hsl(var(--hyper-crimson)))",
        "gradient-gold": "linear-gradient(135deg, hsl(var(--muted-gold)), hsl(38 80% 45%))",
        "gradient-dark": "linear-gradient(180deg, hsl(240 6% 14%), hsl(var(--carbon-black)))",
        "gradient-card": "linear-gradient(180deg, hsl(240 6% 14%), hsl(240 6% 10%))",
        "gradient-spotlight": "radial-gradient(ellipse at center, hsl(var(--electric-clay) / 0.15), transparent 70%)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;