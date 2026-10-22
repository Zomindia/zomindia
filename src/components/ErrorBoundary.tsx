import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw, Home, RefreshCw } from 'lucide-react';
import { Telemetry } from '../services/telemetry';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  reloading: boolean;
}

class ErrorBoundary extends React.Component<Props, State> {
  private reloadTimeout: any = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      reloading: false,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, reloading: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const msg = error?.message || '';
    if (msg.includes('INTERNAL ASSERTION FAILED') || msg.includes('ID: ca9') || msg.includes('ID: b815')) {
      console.warn('[ErrorBoundary Internal Assertion Notice]:', msg);
      return;
    }

    console.error('[Enterprise ErrorBoundary Captured]:', error, errorInfo);

    // Forward telemetry diagnostic to Firestore system_crashes & beacon
    try {
      Telemetry.addBreadcrumb('system', `ErrorBoundary caught fatal UI render error: ${error?.message || 'Unknown'}`);
      Telemetry.logCrash(
        {
          message: error?.message || 'Component render failed',
          stack: `${error?.stack || ''}\n--- Component Stack ---\n${errorInfo?.componentStack || ''}`,
        },
        'ErrorBoundary'
      );
    } catch (telemetryErr) {
      console.warn('[ErrorBoundary Telemetry Bypass]:', telemetryErr);
    }
  }

  componentWillUnmount() {
    if (this.reloadTimeout) {
      clearTimeout(this.reloadTimeout);
    }
  }

  private handleReload = () => {
    this.setState({ reloading: true });
    Telemetry.addBreadcrumb('ui', 'User triggered ErrorBoundary reload');
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }, 300);
  };

  private handleReset = () => {
    Telemetry.addBreadcrumb('ui', 'User clicked ErrorBoundary Try Again');
    this.setState({ hasError: false, error: null, reloading: false });
  };

  private handleReturnHome = () => {
    Telemetry.addBreadcrumb('ui', 'User clicked Return to Home from ErrorBoundary');
    this.setState({ hasError: false, error: null, reloading: false });
    if (typeof window !== 'undefined') {
      try {
        window.location.hash = '#home';
        window.location.href = '/';
      } catch {
        window.location.reload();
      }
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 sm:p-6 text-slate-800">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-100 text-center">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-inner">
              <AlertCircle size={32} />
            </div>

            <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">
              Something went wrong
            </h2>

            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              We encountered an unexpected issue while loading this view. The diagnostics have been automatically reported to our support team.
            </p>

            {this.state.error?.message && (
              <div className="mb-6 p-3 bg-rose-50/70 border border-rose-100 rounded-xl text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 block mb-1">
                  Diagnostics
                </span>
                <p className="text-xs font-mono text-rose-800 break-words line-clamp-3">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                onClick={this.handleReload}
                disabled={this.state.reloading}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-[#002e6e] text-white rounded-xl font-bold hover:bg-[#002252] transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-75"
              >
                {this.state.reloading ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    Reloading App...
                  </>
                ) : (
                  <>
                    <RotateCcw size={18} />
                    Reload App
                  </>
                )}
              </button>

              <button
                onClick={this.handleReset}
                className="w-full py-2.5 text-xs font-bold text-slate-700 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
              >
                Try Again
              </button>

              <button
                onClick={this.handleReturnHome}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
              >
                <Home size={14} />
                Return to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
