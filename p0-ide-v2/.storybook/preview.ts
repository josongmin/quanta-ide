import "@quanta/ui-kit/styles/tokens.css";
import "@quanta/ui-kit/styles/reset.css";
import "@quanta/shell/styles/app.css";
import type { Preview } from "@storybook/react";

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/ } },
  },
};
export default preview;
