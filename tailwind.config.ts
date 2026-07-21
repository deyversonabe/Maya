import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./modules/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        moss: {
          950: "#08160F",
          900: "#102118",
          800: "#1F3026",
          700: "#243728",
          600: "#31513B"
        },
        neon: {
          cyan: "#55F7FF",
          blue: "#6AA8FF",
          pink: "#FF4FD8",
          green: "#72FFB6",
          amber: "#FFD27A"
        },
        alert: {
          red: "#FF4D6D"
        },
        bronze: "#B87945",
        terracotta: "#C46A43",
        cream: "#FFF5E9",
        muted: "#D7CBBD",
        graphite: "#1D211F"
      },
      borderRadius: {
        card: "0.75rem"
      },
      boxShadow: {
        soft: "0 22px 80px rgba(0, 0, 0, 0.28)",
        neon: "0 0 28px rgba(85, 247, 255, 0.18), 0 0 72px rgba(184, 121, 69, 0.14)",
        "neon-red": "0 0 24px rgba(255, 77, 109, 0.24)"
      },
      keyframes: {
        "maya-scan": {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(120%)" }
        },
        "maya-grid": {
          "0%": { backgroundPosition: "0 0, 0 0" },
          "100%": { backgroundPosition: "48px 48px, 48px 48px" }
        },
        "maya-pulse": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" }
        },
        "maya-float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" }
        }
      },
      animation: {
        "maya-scan": "maya-scan 4.6s linear infinite",
        "maya-grid": "maya-grid 18s linear infinite",
        "maya-pulse": "maya-pulse 2.8s ease-in-out infinite",
        "maya-float": "maya-float 6s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
