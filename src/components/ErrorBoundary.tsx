import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white rounded-[40px] p-10 shadow-2xl shadow-slate-200 border border-slate-100 text-center">
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tighter italic">Something went wrong</h2>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed italic">
              We encountered an error while loading this part of the app.
              <br />
              <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400 mt-2 block break-words">
                {this.state.error?.message}
              </span>
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => this.setState({ hasError: false, error: null })}
                className="w-full flex items-center justify-center gap-3 py-3.5 bg-[#002e6e] text-white rounded-2xl font-bold hover:bg-[#002252] transition-all shadow-lg active:scale-95 cursor-pointer"
              >
                <RotateCcw size={18} />
                Try Again
              </button>
              <button 
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  if (typeof window !== 'undefined') {
                    window.location.hash = '#home';
                  }
                }}
                className="w-full py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
              >
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
