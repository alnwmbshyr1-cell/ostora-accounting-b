import React, { Suspense, useState } from 'react';
import {
  Badge,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Code2,
  CreditCard,
  Crown,
  HelpCircle,
  Landmark,
  Languages,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Moon,
  Package,
  Receipt,
  RotateCcw,
  Settings,
  ShoppingBag,
  Sparkles,
  Sun,
  Truck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { strings } from './data/translations';
import { Invoice, Quotation, ReturnRecord, RoleId, RouteId, Voucher } from './types/erp';
import { useErpStore } from './store/useErpStore';
import { AuthOnboardingFlow } from './components/AuthOnboardingFlow';
import { ROLE_LABELS } from './constants/permissions';
import { ErpScreenRouter } from './screens';
import { PrintPreviewModal } from './components/PrintPreviewModal';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import appIconImg from './assets/images/ostora_app_icon_1794578215972.jpg';

const FlutterStudioView = React.lazy(() =>
  import('./components/FlutterStudioView').then((m) => ({ default: m.FlutterStudioView })),
);

export default function App() {
  const store = useErpStore();
  const { state, actions, allowedRoutes, hasPermission, toastMsg } = store;
  const isAr = state.settings.isArabic;
  const t = strings[isAr ? 'ar' : 'en'];

  const [workspaceMode, setWorkspaceMode] = useState<'erp' | 'flutter'>('erp');
  const [route, setRoute] = useState<RouteId>('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [printVoucher, setPrintVoucher] = useState<Voucher | null>(null);
  const [printReturn, setPrintReturn] = useState<ReturnRecord | null>(null);
  const [printQuotation, setPrintQuotation] = useState<Quotation | null>(null);

  if (!state.onboardingSeen || !state.isLoggedIn) {
    return (
      <AuthOnboardingFlow
        isAr={isAr}
        onboardingSeen={state.onboardingSeen}
        currentRole={state.currentRole}
        onToggleLanguage={actions.toggleLanguage}
        onFinishOnboarding={() => actions.setOnboardingSeen(true)}
        onSelectRole={actions.setCurrentRole}
        onLoginSuccess={() => {
          actions.setLoggedIn(true);
          const nextAllowed = state.permissionsMatrix[state.currentRole] ?? ['dashboard'];
          if (!nextAllowed.includes(route)) {
            setRoute(nextAllowed[0] ?? 'dashboard');
          }
        }}
        onRestoreBackupJson={actions.importBackupJson}
        onRestoreAutosave={actions.restoreFromAutosave}
      />
    );
  }

  const allNavItems: { id: RouteId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
    { id: 'invoices', label: t.invoices, icon: Receipt },
    { id: 'returns', label: t.returns, icon: RotateCcw },
    { id: 'quotations', label: t.quotations, icon: ClipboardList },
    { id: 'customers', label: t.customers, icon: Users },
    { id: 'suppliers', label: t.suppliers, icon: Truck },
    { id: 'purchase_orders', label: t.purchase_orders, icon: ShoppingBag },
    { id: 'vouchers', label: t.vouchers, icon: CreditCard },
    { id: 'journals', label: t.journals, icon: BookOpen },
    { id: 'inventory', label: t.inventory, icon: Package },
    { id: 'employees', label: t.employees, icon: Badge },
    { id: 'expenses', label: t.expenses, icon: Wallet },
    { id: 'banks', label: t.banks, icon: Landmark },
    { id: 'reports', label: t.reports, icon: BarChart3 },
    { id: 'ai_analytics', label: t.ai_analytics, icon: Sparkles },
    { id: 'subscription', label: t.subscription, icon: Crown },
    { id: 'settings', label: t.settings, icon: Settings },
    { id: 'help', label: t.help, icon: HelpCircle },
  ];

  const navItems = allNavItems.filter((item) => hasPermission(item.id));

  const candidateBottomTabs: { id: RouteId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
    { id: 'invoices', label: t.invoices, icon: Receipt },
    { id: 'quotations', label: t.quotations, icon: ClipboardList },
    { id: 'inventory', label: t.inventory, icon: Package },
    { id: 'reports', label: t.reports, icon: BarChart3 },
  ];
  const visibleBottomTabs = candidateBottomTabs.filter((tab) => hasPermission(tab.id));
  const bottomTabs =
    visibleBottomTabs.length > 0
      ? visibleBottomTabs
      : navItems.slice(0, 5);

  const navigateTo = (r: RouteId) => {
    setWorkspaceMode('erp');
    setRoute(r);
    setDrawerOpen(false);
  };

  const roleText = isAr ? ROLE_LABELS[state.currentRole].ar : ROLE_LABELS[state.currentRole].en;
  const routeAllowed = hasPermission(route);

  return (
    <div className="min-h-dvh flex flex-col bg-[#F6F7F5] dark:bg-[#0A120F] text-slate-900 dark:text-slate-100">
      {/* Top App Bar (compact + iOS safe-area top) */}
      <header className="no-print sticky top-0 z-30 pt-safe bg-[#0A3D2C] text-white border-b border-white/10">
        <div className="h-14 px-4 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {workspaceMode === 'erp' && (
              <button
                onClick={() => setDrawerOpen(true)}
                className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
                aria-label="Open Navigation Drawer"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <span className="font-extrabold text-sm sm:text-lg whitespace-nowrap shrink-0 truncate">
              {t.appName}
            </span>
          </div>

          {/* Workspace Mode Switch */}
          <nav className="flex items-center gap-1 bg-black/20 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setWorkspaceMode('erp')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                workspaceMode === 'erp' ? 'bg-[#C9A227] text-slate-950' : 'text-white/80 hover:text-white'
              }`}
            >
              {t.erpWorkspace}
            </button>
            <button
              onClick={() => setWorkspaceMode('flutter')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                workspaceMode === 'flutter' ? 'bg-[#C9A227] text-slate-950' : 'text-white/80 hover:text-white'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.flutterStudio}</span>
              <span className="sm:hidden">Flutter</span>
            </button>
          </nav>

          {/* PWA Install, Language عربي | EN & Theme Toggle */}
          <div className="flex items-center gap-1.5 shrink-0">
            <PWAInstallButton isAr={isAr} />
            <button
              onClick={actions.toggleLanguage}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5 text-[#C9A227]" />
              <span>{isAr ? 'عربي | EN' : 'EN | عربي'}</span>
            </button>
            <button
              onClick={actions.toggleDarkMode}
              className="p-2 rounded-lg hover:bg-white/10 cursor-pointer"
              aria-label={t.darkMode}
            >
              {state.settings.isDarkMode ? (
                <Sun className="w-4 h-4 text-[#C9A227]" />
              ) : (
                <Moon className="w-4 h-4 text-white" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      {workspaceMode === 'flutter' ? (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
          <Suspense
            fallback={
              <div className="bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] rounded-[20px] p-10 text-center text-sm text-slate-500">
                {isAr ? 'جاري تحميل استوديو Flutter...' : 'Loading Flutter Studio...'}
              </div>
            }
          >
            <FlutterStudioView isAr={isAr} />
          </Suspense>
        </main>
      ) : (
        <div className="flex-1 flex max-w-7xl w-full mx-auto">
          {/* Persistent Desktop Drawer */}
          <aside className="no-print hidden lg:flex lg:w-64 shrink-0 flex-col border-e border-slate-200 dark:border-[#1F332B] bg-white dark:bg-[#121E19] p-3">
            <div className="p-3 mb-2 rounded-2xl bg-[#0A3D2C] text-white flex items-center gap-3">
              <img
                src={appIconImg}
                alt="Ostora Logo"
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-xl border border-[#C9A227] object-cover shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-extrabold truncate">{state.settings.companyName}</p>
                <p className="text-[11px] text-[#C9A227] font-mono truncate">
                  {roleText} · {state.settings.currency}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = route === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigateTo(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#0A3D2C] text-white'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A2C24]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#C9A227]' : ''}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 mt-2 border-t border-slate-200 dark:border-[#1F332B] space-y-2">
              <div className="px-1">
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  {t.loginAs}
                </label>
                <select
                  value={state.currentRole}
                  onChange={(e) => {
                    const nextRole = e.target.value as RoleId;
                    actions.setCurrentRole(nextRole);
                    const nextAllowed = state.permissionsMatrix[nextRole] ?? ['dashboard'];
                    if (!nextAllowed.includes(route)) {
                      setRoute(nextAllowed[0] ?? 'dashboard');
                    }
                    actions.notify(
                      `${t.loginAs}: ${isAr ? ROLE_LABELS[nextRole].ar : ROLE_LABELS[nextRole].en}`,
                    );
                  }}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0A120F] border border-slate-200 dark:border-[#1F332B] text-xs font-bold"
                >
                  {(['owner', 'accountant', 'salesman', 'warehouse'] as RoleId[]).map((r) => (
                    <option key={r} value={r}>
                      {isAr ? ROLE_LABELS[r].ar : ROLE_LABELS[r].en}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => actions.logoutPreserveData()}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{t.logout}</span>
              </button>
            </div>
          </aside>

          {/* Main Content Viewport */}
          <main className="flex-1 min-w-0 p-4 sm:p-6 pb-24 lg:pb-8">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h1 className="text-xl font-extrabold truncate">{t[route]}</h1>
              <span className="text-xs text-slate-500 font-mono shrink-0">
                {roleText} · {state.settings.currency} · {isAr ? 'أوفلاين' : 'Offline'}
              </span>
            </div>

            {!routeAllowed ? (
              <div className="rounded-[20px] bg-white dark:bg-[#121E19] border border-slate-200 dark:border-[#1F332B] p-10 text-center max-w-lg mx-auto mt-8 space-y-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center">
                  <Lock className="w-7 h-7" />
                </div>
                <h2 className="text-lg font-extrabold">{t.noPermission}</h2>
                <p className="text-xs text-slate-500">
                  {isAr
                    ? `دورك الحالي (${roleText}) لا يملك صلاحية عرض شاشة "${t[route]}".`
                    : `Your active role (${roleText}) does not have access to "${t[route]}".`}
                </p>
                <button
                  onClick={() => navigateTo(allowedRoutes[0] ?? 'dashboard')}
                  className="px-5 py-2.5 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold cursor-pointer"
                >
                  {isAr ? 'العودة للصفحة المتاحة' : 'Go to Allowed Page'}
                </button>
              </div>
            ) : (
              <ErpScreenRouter
                route={route}
                store={store}
                onNavigate={navigateTo}
                onPrintInvoice={setPrintInvoice}
                onPrintVoucher={setPrintVoucher}
                onPrintReturn={setPrintReturn}
                onPrintQuotation={setPrintQuotation}
              />
            )}
          </main>
        </div>
      )}

      {/* Mobile Slide-out Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-72 max-w-[82vw] bg-white dark:bg-[#121E19] h-full flex flex-col p-4 pt-safe pb-safe z-10 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-[#1F332B]">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={appIconImg}
                  alt="Ostora"
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-xl border border-[#C9A227] object-cover shrink-0"
                />
                <div className="min-w-0">
                  <span className="block font-extrabold text-sm truncate">{t.appName}</span>
                  <span className="block text-[11px] text-[#C9A227] font-mono">{roleText}</span>
                </div>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = route === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigateTo(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold cursor-pointer ${
                      active ? 'bg-[#0A3D2C] text-white' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => {
                setDrawerOpen(false);
                actions.logoutPreserveData();
              }}
              className="mt-2 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{t.logout}</span>
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation (iOS safe-area bottom + dynamic permitted tabs) */}
      {workspaceMode === 'erp' && (
        <nav
          className={`no-print lg:hidden fixed bottom-0 inset-x-0 z-30 pb-safe bg-white/95 dark:bg-[#121E19]/95 backdrop-blur-md border-t border-slate-200 dark:border-[#1F332B] grid ${
            bottomTabs.length === 1
              ? 'grid-cols-1'
              : bottomTabs.length === 2
              ? 'grid-cols-2'
              : bottomTabs.length === 3
              ? 'grid-cols-3'
              : bottomTabs.length === 4
              ? 'grid-cols-4'
              : 'grid-cols-5'
          }`}
        >
          {bottomTabs.map((tab) => {
            const Icon = tab.icon;
            const active = route === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => navigateTo(tab.id)}
                className={`h-14 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold cursor-pointer ${
                  active ? 'text-[#0A3D2C] dark:text-[#C9A227]' : 'text-slate-500'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="truncate max-w-[68px]">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Global Toast Banner */}
      {toastMsg && (
        <div className="no-print fixed bottom-20 lg:bottom-6 end-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0A3D2C] text-white text-xs font-bold shadow-xl border border-[#C9A227]/60">
          <CheckCircle2 className="w-4 h-4 text-[#C9A227] shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Offline Status Banner */}
      <OfflineIndicator isAr={isAr} />

      {/* Printable A4 ZATCA Invoice, Credit Note, Quotation & Voucher Modal */}
      <PrintPreviewModal
        invoice={printInvoice}
        voucher={printVoucher}
        returnRecord={printReturn}
        quotation={printQuotation}
        company={state.settings}
        onClose={() => {
          setPrintInvoice(null);
          setPrintVoucher(null);
          setPrintReturn(null);
          setPrintQuotation(null);
        }}
      />
    </div>
  );
}
