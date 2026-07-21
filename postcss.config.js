/** Tailwind v4 PostCSS setup. `@tailwindcss/postcss` bundles import-inlining and
 *  autoprefixer, so the separate `tailwindcss` and `autoprefixer` plugins are gone. */
module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
