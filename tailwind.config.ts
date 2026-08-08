import type { Config } from "tailwindcss";

// Все цвета собраны на CSS-переменных (см. globals.css :root / .dark),
// поэтому next-themes может переключать светлую/тёмную тему, просто
// переключая класс "dark" на <html> — ни один компонент менять не нужно.
// Оставляем старые имена (ink/paper/mist/...) для обратной совместимости
// с уже написанным кодом и добавляем новые семантические алиасы
// (background/foreground/card/muted/primary), которые использует
// новый Admin Panel UI.
function withOpacity(variable: string) {
  return `rgb(var(${variable}) / <alpha-value>)`;
}

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // --- исходная палитра проекта ---
        ink: withOpacity("--color-ink"),
        paper: withOpacity("--color-paper"),
        mist: withOpacity("--color-mist"),
        accent: withOpacity("--color-accent"),
        "accent-soft": withOpacity("--color-accent-soft"),
        border: withOpacity("--color-border"),
        success: withOpacity("--color-success"),
        danger: withOpacity("--color-danger"),

        // --- новые семантические алиасы для Admin Panel (shadcn-style) ---
        background: withOpacity("--color-paper"),
        foreground: withOpacity("--color-ink"),
        card: {
          DEFAULT: withOpacity("--color-card"),
          foreground: withOpacity("--color-ink"),
        },
        muted: {
          DEFAULT: withOpacity("--color-mist"),
          foreground: withOpacity("--color-muted-foreground"),
        },
        primary: {
          DEFAULT: withOpacity("--color-accent"),
          foreground: withOpacity("--color-accent-foreground"),
        },
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,30,61,0.04), 0 8px 24px rgba(11,30,61,0.06)",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "message-in": {
          "0%": { opacity: "0", transform: "translateY(8px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "caret-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.35s ease-out both",
        "fade-in": "fade-in 0.2s ease-out both",
        "message-in": "message-in 0.25s ease-out both",
        "caret-blink": "caret-blink 1s step-start infinite",
      },
    },
  },
  plugins: [],
};

export default config;
