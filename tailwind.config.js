/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        border: 'var(--border)',
        text: 'var(--text)',
        muted: 'var(--text-muted)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        win: 'var(--win)',
        loss: 'var(--loss)',
        gold: 'var(--gold)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 24px var(--accent-glow)',
        panel: '0 10px 30px rgba(0,0,0,0.35)',
      },
    },
  },
  plugins: [],
};
