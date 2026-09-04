import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ardoise: {
          50: "#f6f7f9", 100: "#eceef2", 200: "#d5dae2",
          300: "#b0b9c8", 400: "#8593a9", 500: "#66758e",
          600: "#515e75", 700: "#434d5f", 800: "#3a4251", 900: "#343a46",
        },
        cdg: "#2563eb",
        compta: "#0d9488",
      },
    },
  },
  plugins: [],
};
export default config;
