import { ErrorBoundary } from "@/shared/ui/error-boundary";
import { IdePage } from "./ide";

export function App() {
  return (
    <ErrorBoundary>
      <IdePage />
    </ErrorBoundary>
  );
}
