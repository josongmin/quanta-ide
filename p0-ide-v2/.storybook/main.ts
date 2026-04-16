import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../packages/ui-kit/src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-essentials"],
  framework: "@storybook/react-vite",
  viteFinal: async (config) => {
    const path = await import("path");
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@quanta/shell-contract": path.resolve(__dirname, "../packages/shell-contract/src"),
      "@quanta/ui-kit": path.resolve(__dirname, "../packages/ui-kit/src"),
      "@quanta/shell": path.resolve(__dirname, "../packages/shell/src"),
    };
    return config;
  },
};
export default config;
