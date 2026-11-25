import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Unexpected application error',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Application ErrorBoundary caught error:', error, info);
  }

  private parseErrorDetails(raw: string): { summary: string; path?: string } {
    try {
      const parsed = JSON.parse(raw) as { error?: string; path?: string; operationType?: string };
      if (parsed && parsed.error) {
        return {
          summary: `${parsed.operationType ? `[${parsed.operationType}] ` : ''}${parsed.error}`,
          path: parsed.path ?? undefined,
        };
      }
    } catch {
      // Plain error message
    }
    return { summary: raw };
  }

  render() {
    if (this.state.hasError) {
      const details = this.parseErrorDetails(this.state.message);
      const isAr = typeof document !== 'undefined' && document.documentElement.lang === 'ar';

      return (
        <div className="min-h-dvh bg-[#F6F7F5] dark:bg-[#0A120F] flex items-center justify-center p-6 text-slate-900 dark:text-slate-100">
          <div className="max-w-md w-full bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-6 space-y-4 shadow-xl text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-extrabold">
              {isAr ? 'حدث خطأ أثناء المزامنة أو التشغيل' : 'Application or Sync Error'}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 break-words font-mono bg-slate-50 dark:bg-[#0A120F] p-3 rounded-xl border border-slate-200 dark:border-[#1F332B]">
              {details.summary}
              {details.path ? `\n(${details.path})` : ''}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, message: '' })}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-[#1F332B] text-xs font-bold cursor-pointer"
              >
                {isAr ? 'متابعة العمل' : 'Continue'}
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 py-2.5 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isAr ? 'إعادة التحميل' : 'Reload App'}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
