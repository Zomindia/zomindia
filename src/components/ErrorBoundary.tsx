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
            <button 
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-3 py-4 bg-blue-700 text-white rounded-2xl font-bold hover:bg-blue-800 transition-all shadow-xl shadow-blue-700/10 active:scale-95"
            >
              <RotateCcw size={18} />
              Re-sync Dashboard
            </button>
            <button 
                onClick={() => {
                   // Clear cache logic
                   localStorage.clear();
                   sessionStorage.clear();
                   window.location.hash = '#home';
                   window.location.reload();
                }}
                className="w-full mt-4 py-2 text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-all"
            >
                Clear Local Cache & Reset
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
