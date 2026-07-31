/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
      colors: {
        green: { DEFAULT: "#00A870", l: "#2BC48A", soft: "#e8f7f1", ink: "#046a48" },
        navy: { DEFAULT: "#1B3139", 2: "#2E5A6B", 3: "#5A8A9A" },
        oat: { DEFAULT: "#F5F3EF", 2: "#EEEDE9" },
        line: { DEFAULT: "#e6e3dd", 2: "#d8d3ca" },
        lava: "#FF3621",
        amber: "#F59E0B",
      },
    },
  },
  plugins: [],
};
