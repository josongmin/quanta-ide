import { IdePage } from "./ide";

function exitToParentSite(): void {
  try {
    const href = window.location.href.endsWith("/") ? window.location.href : `${window.location.href}/`;
    window.location.assign(new URL("..", href).href);
  } catch {
    window.location.assign("/");
  }
}

export function App() {
  return (
    <IdePage onExit={exitToParentSite} />
  );
}
