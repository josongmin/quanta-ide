import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Future: send to error tracking service
    void error;
    void info;
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: "12px",
          fontFamily: "system-ui, sans-serif",
          color: "var(--ink-3, #666)",
        }}>
          <span style={{ fontSize: "14px", fontWeight: 500 }}>Something went wrong</span>
          <span style={{ fontSize: "12px", opacity: 0.6 }}>{this.state.error?.message}</span>
          <button
            type="button"
            onClick={() => { this.setState({ hasError: false, error: null }); }}
            style={{
              padding: "6px 16px",
              borderRadius: "6px",
              border: "1px solid var(--line-2, #ddd)",
              background: "var(--paper-2, #f5f5f5)",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
