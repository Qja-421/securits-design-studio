/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#29ABE2",
          orange: "#F7941D",
          bordeaux: "#8B1E3F",
          black: "#1a1a1a",
          darkGray: "#2C2C2A",
          lightGray: "#F0ECE3"
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
