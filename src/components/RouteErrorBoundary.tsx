import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Route rendering failed", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-5 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-600" aria-hidden="true" />
        <h1 className="mt-4 font-serif text-2xl font-bold">This page did not load correctly</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The site may have been updated while it was open. Refresh once to load the latest version.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => window.location.reload()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground"><RefreshCw className="h-4 w-4" /> Refresh page</button>
          <a href="/" className="inline-flex min-h-11 items-center gap-2 border border-border px-5 py-2.5 font-semibold"><Home className="h-4 w-4" /> Home</a>
        </div>
      </main>
    );
  }
}
