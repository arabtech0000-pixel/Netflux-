import React from 'react';

interface RootErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  RootErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('Netflux root render error:', error);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetAndReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // Ignore cleanup errors
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-black text-white flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-6 text-center flex flex-col items-center gap-4">
            <div className="text-2xl font-black tracking-widest text-[#E50914]">NETFLUX</div>
            <h1 className="text-lg font-bold text-white">Unable to display this screen</h1>
            <p className="text-xs text-neutral-400 leading-relaxed">
              {this.state.message}
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 w-full pt-1">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#E50914] hover:bg-[#f40612] text-white text-sm font-bold cursor-pointer"
              >
                Reload App
              </button>
              <button
                type="button"
                onClick={() => void this.handleResetAndReload()}
                className="flex-1 min-h-[44px] px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-semibold cursor-pointer"
              >
                Clear Cache &amp; Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
