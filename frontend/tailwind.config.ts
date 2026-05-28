import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm off-white, softened for a calmer ambient canvas.
        canvas: "#FBFAF8",
        // Soft pastel accents with more room to breathe.
        mist: {
          50: "#F6F7FD",
          100: "#ECF0FA",
          200: "#DCE4F5",
          300: "#C1CCE8",
        },
        // Calm blue-purple gradient anchors.
        sky: {
          soft: "#BFD0FF",
        },
        violet: {
          soft: "#D2C2F5",
        },
        // Ink for text — slightly warm dark blue-gray.
        ink: {
          900: "#1E2238",
          700: "#3A3F5C",
          500: "#6A6F89",
          400: "#8A8FA5",
        },
      },
      fontFamily: {
        // body + UI
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        // the cursive welcome
        welcome: ["var(--font-dancing)", "cursive"],
      },
      keyframes: {
        drift: {
          "0%, 100%": { transform: "translate(0,0) scale(1)" },
          "33%": { transform: "translate(40px,-20px) scale(1.05)" },
          "66%": { transform: "translate(-30px,30px) scale(0.95)" },
        },
        "drift-slow": {
          "0%, 100%": { transform: "translate(0,0) scale(1)" },
          "50%": { transform: "translate(-50px,40px) scale(1.08)" },
        },
        "wave-drift": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        drift: "drift 22s ease-in-out infinite",
        "drift-slow": "drift-slow 30s ease-in-out infinite",
        "wave-drift": "wave-drift 40s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
