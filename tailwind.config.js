const c = (v) => `rgb(var(--${v}) / <alpha-value>)`;
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: { bg: c('bg'), fg: c('fg'), card: c('card'), neon: c('neon'), plum: c('plum'), hot: c('hot'), danger: c('danger') },
      fontFamily: { display: ['var(--font-display)', 'sans-serif'], body: ['var(--font-body)', 'sans-serif'] }
    }
  },
  plugins: []
};
