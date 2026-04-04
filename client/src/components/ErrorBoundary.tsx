import * as React from "react";

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Application crashed:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
          <div className="max-w-xl w-full rounded-3xl border border-border bg-card p-8 shadow-xl text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <div className="h-6 w-6 rounded-full border-2 border-destructive border-t-transparent animate-spin" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Something broke while loading the app</h1>
              <p className="text-sm text-muted-foreground">
                The interface failed to render. Refresh the page. If it keeps happening, the browser console will show the crash.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Reload app
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}