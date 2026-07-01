import { Component, ErrorInfo, ReactNode } from "react";

interface FallbackArgs {
  error: Error;
  reset: () => void;
}

interface Props {
  children: ReactNode;
  /** Renders when a descendant throws during render/commit. */
  fallback: (args: FallbackArgs) => ReactNode;
  /** Optional hook for external monitoring (e.g. Sentry) — wire up later. */
  onError?: (error: Error, info: ErrorInfo) => void;
  /**
   * When any value in this array changes, the boundary clears its error and
   * re-renders children. Use it to auto-recover on navigation, e.g.
   * resetKeys={[pathname]}.
   */
  resetKeys?: unknown[];
}

interface State {
  error: Error | null;
}

/**
 * Generic React error boundary. React only supports class components as error
 * boundaries, so this stays a class; the fallback UIs are plain functions.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Single choke point for error logging — swap console for a monitoring
    // service later without touching every call site.
    console.error("[ErrorBoundary]", error, info.componentStack);
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && this.didResetKeysChange(prev.resetKeys, this.props.resetKeys)) {
      this.reset();
    }
  }

  private didResetKeysChange(a?: unknown[], b?: unknown[]) {
    if (a === b) return false;
    if (!a || !b || a.length !== b.length) return true;
    return a.some((v, i) => !Object.is(v, b[i]));
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return this.props.fallback({ error: this.state.error, reset: this.reset });
    }
    return this.props.children;
  }
}
