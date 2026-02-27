export default {
  darkMode: ["class"],
  content: [
    './Pages/**/*.{js,jsx}',
    './Components/**/*.{js,jsx}',
    './index.html',
    './*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // NEXUS Cyberpunk palette
        primary: {
          DEFAULT: '#a855f7',
          50: '#faf5ff',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
        },
        secondary: {
          DEFAULT: '#ec4899',
          500: '#ec4899',
        },
        accent: {
          DEFAULT: '#6c2bd9',
          500: '#6c2bd9',
        },
        shadow: {
          bg: '#0a0a1a',
          surface: '#111127',
          card: '#161636',
          primary: '#a855f7',
          secondary: '#ec4899',
          accent: '#6c2bd9',
          text: '#e0e0f0',
          muted: '#6b7280',
          border: '#2a2a4a',
          hover: '#1e1e3e',
        },
        glow: {
          green: 'rgba(0, 255, 136, 0.18)',
          pink: 'rgba(236, 72, 153, 0.18)',
          blue: 'rgba(0, 212, 255, 0.14)',
          purple: 'rgba(168, 85, 247, 0.18)',
        },
        nexus: {
          purple: '#a855f7',
          pink: '#ec4899',
          cyan: '#06b6d4',
          green: '#10b981',
          gold: '#f59e0b',
        },
      },
      fontFamily: {
        sans: ['Noto Naskh Arabic', 'Cairo', 'system-ui', 'sans-serif'],
        arabic: ['Noto Naskh Arabic', 'Cairo', 'serif'],
        cyber: ['Orbitron', 'Rajdhani', 'monospace'],
        heading: ['Rajdhani', 'Orbitron', 'sans-serif'],
      },
      boxShadow: {
        'neon': '0 0 20px rgba(168, 85, 247, 0.5)',
        'neon-pink': '0 0 20px rgba(236, 72, 153, 0.5)',
        'neon-blue': '0 0 20px rgba(0, 212, 255, 0.5)',
        'neon-purple': '0 0 20px rgba(138, 43, 226, 0.5)',
        'cyber': '0 4px 20px rgba(168, 85, 247, 0.2)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.4), 0 0 1px rgba(168, 85, 247, 0.3)',
        'glow': '0 0 24px rgba(168, 85, 247, 0.4)',
      },
      backgroundImage: {
        'nexus-gradient': 'linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 50%, #0a0a1a 100%)',
        'card-gradient': 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(236, 72, 153, 0.04) 100%)',
        'sidebar-gradient': 'linear-gradient(180deg, #0d0d24 0%, #1a0a2e 100%)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "glow": {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.8', filter: 'brightness(1.2)' },
        },
        "scan": {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        "pulse-neon": {
          '0%, 100%': { boxShadow: '0 0 5px rgba(168, 85, 247, 0.5)' },
          '50%': { boxShadow: '0 0 20px rgba(168, 85, 247, 0.8)' },
        },
        "slide-in": {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        "float": {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "glow": "glow 2s ease-in-out infinite",
        "scan": "scan 8s linear infinite",
        "pulse-neon": "pulse-neon 2s ease-in-out infinite",
        "slide-in": "slide-in 0.3s ease-out",
        "float": "float 3s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
