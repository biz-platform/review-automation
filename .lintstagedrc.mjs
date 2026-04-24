/** @type {import("lint-staged").Configuration} */
const lintStagedConfig = {
  "*.{js,jsx,mjs,cjs,ts,tsx}": ["eslint --fix"],
};

export default lintStagedConfig;
