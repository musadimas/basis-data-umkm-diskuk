import withNuxt from "./.nuxt/eslint.config.mjs"

export default withNuxt(
  {
    // Generated Playwright artifacts are gitignored; keep them out of lint so
    // running e2e tests does not break `pnpm run lint`.
    ignores: [
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    rules: {
      // Vue 3 supports fragments, and several pages intentionally render multiple roots.
      "vue/no-multiple-template-root": "off",
      // Optional Vue props intentionally remain undefined when callers omit them.
      "vue/require-default-prop": "off",
      "vue/no-required-prop-with-default": "off",
      // This rule misidentifies dynamic tooltip component mounting in chart helpers.
      "vue/one-component-per-file": "off",
    },
  },
)
