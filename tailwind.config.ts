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
        soft: "0 22px 80px rgba(0, 0, 0, 0.28)"
      }
    }
  },
  plugins: []
};

export default config;
