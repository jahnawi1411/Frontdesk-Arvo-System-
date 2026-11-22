/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          800: '#1e293b',
          900: '#0f172a',
          950: '#090d16'
        },
        arvo: {
          blue: '#2563eb',
          urgent: '#ea580c',
          overdue: '#dc2626',
          resolved: '#16a34a'
        }
      }
    },
  },
  plugins: [],
}
