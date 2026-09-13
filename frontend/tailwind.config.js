/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ocean: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49'
        },
        marine: {
          light: '#f8fafc',
          card: '#ffffff',
          border: '#e2e8f0',
          accent: '#0284c7'
        }
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', '-apple-system', 'sans-serif'],
        tech: ['Inter', 'Plus Jakarta Sans', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(2, 132, 199, 0.08), 0 4px 6px -4px rgba(2, 132, 199, 0.04)',
        'soft-lg': '0 10px 25px -5px rgba(2, 132, 199, 0.10), 0 8px 10px -6px rgba(2, 132, 199, 0.05)',
        'glow-sm': '0 0 15px rgba(14, 165, 233, 0.25)',
      }
    },
  },
  plugins: [],
}
