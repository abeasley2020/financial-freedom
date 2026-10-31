/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // The studio: deep indigo stage, raised glass surfaces, a gold spotlight.
        stage: '#0b0d26',
        surface: '#161a3d',
        raised: '#1f2452',
        gold: '#ffd166',
        // Money direction on the dark stage. Both pass 4.5:1 on stage and surface; words carry the meaning too.
        gain: '#5ee39a',
        loss: '#ff8f86',
        ink: '#1a1033',
      },
      boxShadow: {
        glow: '0 0 0 2px rgba(255,209,102,0.9), 0 0 32px rgba(255,209,102,0.45)',
        lift: '0 18px 40px -12px rgba(0,0,0,0.65), 0 2px 0 rgba(255,255,255,0.06) inset',
      },
    },
  },
  plugins: [],
};
