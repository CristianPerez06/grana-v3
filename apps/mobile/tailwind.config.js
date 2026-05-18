/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.tsx', './components/**/*.tsx'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: require('@grana/ui-tokens/tokens').colors,
    },
  },
  plugins: [],
}
