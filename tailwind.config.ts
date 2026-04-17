import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["'DM Serif Display'", "serif"],
        sans: ["'DM Sans'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        ink: {
          50: "#f7f6f3",
          100: "#edeae3",
          200: "#d8d3c8",
          300: "#bdb5a6",
          400: "#9e9282",
          500: "#867768",
          600: "#72635a",
          700: "#5e514c",
          800: "#4f4441",
          900: "#453c39",
          950: "#251f1d",
        },
        gold: {
          400: "#d4a847",
          500: "#c49630",
          600: "#a87d1e",
        },
        emerald: {
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
        },
        rose: {
          400: "#fb7185",
          500: "#f43f5e",
        },
      },
    },
  },
  plugins: [],
};

export default config;
