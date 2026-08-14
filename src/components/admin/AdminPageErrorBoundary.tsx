'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Client error boundary for admin pages. Any unexpected render/hydration error
 * inside the page converts to a visible error card instead of a blank page —
 * an admin surface must never fail silently.
 */
export default class AdminPageErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    // Keep the server-side error visible to the operator (no user data here).
    console.error('[admin] page render error', error);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-10">
          <div className="rounded-2xl border border-red-400/30 bg-red-400/5 p-5">
            <h1 className="font-display text-lg font-bold text-red-300">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-400">
              This page hit an unexpected error and couldn&apos;t render. Reload the page to try again — no data was
              changed.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-neon-cyan/90 px-4 py-2 text-sm font-semibold text-night-950 transition hover:bg-neon-cyan"
            >
              Reload
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
