/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        navy: {
          50: "#eef2f7",
          100: "#d7e0ec",
          200: "#b0c1d9",
          300: "#89a2c6",
          400: "#5c7fab",
          500: "#3d6191",
          600: "#2a4a75",
          700: "#1e3a5f",
          800: "#152a45",
          900: "#0d1b2e",
          950: "#081222",
        },
        risk: {
          low: "#16a34a",
          lowBg: "#f0fdf4",
          medium: "#d97706",
          mediumBg: "#fffbeb",
          high: "#ea580c",
          highBg: "#fff7ed",
          critical: "#dc2626",
          criticalBg: "#fef2f2",
        },
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(13,27,46,0.06), 0 1px 3px 0 rgba(13,27,46,0.08)",
      },
    },
  },
  plugins: [],
};
