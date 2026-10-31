/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Money direction colors. Both pass 4.5:1 on white and on paper; text labels always carry the meaning too.
        gain: '#15703a',
        loss: '#b42318',
        paper: '#fbf8f2',
        ink: '#1f2328',
        accent: '#0b5c8a',
      },
    },
  },
  plugins: [],
};
