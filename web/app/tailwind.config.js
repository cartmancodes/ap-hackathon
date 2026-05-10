/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 900: "#0b1220", 800: "#111827", 700: "#1f2937", 500: "#6b7280", 300: "#d1d5db", 100: "#f3f4f6" },
        accent: { 600: "#2563eb", 500: "#3b82f6", 100: "#dbeafe" },
        risk: { low: "#10b981", watch: "#f59e0b", high: "#f97316", crit: "#ef4444" },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
