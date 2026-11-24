import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';
import 'l10n/app_strings.dart';
import 'screens/ai_analytics_screen.dart';
import 'screens/banks_screen.dart';
import 'screens/customers_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/employees_screen.dart';
import 'screens/expenses_screen.dart';
import 'screens/inventory_screen.dart';
import 'screens/invoices_screen.dart';
import 'screens/journals_screen.dart';
import 'screens/purchase_orders_screen.dart';
import 'screens/reports_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/splash_onboarding_auth_screen.dart';
import 'screens/subscription_screen.dart';
import 'screens/suppliers_screen.dart';
import 'screens/vouchers_screen.dart';
import 'services/app_provider.dart';
import 'services/db_service.dart';
import 'theme/app_theme.dart';
import 'widgets/app_drawer.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await DbService.init();
  final provider = AppProvider();
  await provider.initialize();

  runApp(
    ChangeNotifierProvider.value(
      value: provider,
      child: const OstoraAccountingApp(),
    ),
  );
}

class OstoraAccountingApp extends StatelessWidget {
  const OstoraAccountingApp({super.key});

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<AppProvider>();
    final locale = prov.isAr ? const Locale('ar', 'SA') : const Locale('en', 'US');

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'أسطورة المحاسبة - Legend of Accounting',
      locale: locale,
      supportedLocales: const [
        Locale('ar', 'SA'),
        Locale('en', 'US'),
      ],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: AppTheme.lightTheme(prov.isAr),
      darkTheme: AppTheme.darkTheme(prov.isAr),
      themeMode: prov.settings.isDarkMode ? ThemeMode.dark : ThemeMode.light,
      home: const RootShell(),
    );
  }
}

class RootShell extends StatefulWidget {
  const RootShell({super.key});

  @override
  State<RootShell> createState() => _RootShellState();
}

class _RootShellState extends State<RootShell> {
  String _currentRoute = 'dashboard';
  bool _splashFinished = false;

  void _navigate(String route) {
    setState(() => _currentRoute = route);
  }

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<AppProvider>();
    final ar = prov.isAr;

    if (!_splashFinished) {
      return SplashScreen(
        onFinished: () => setState(() => _splashFinished = true),
      );
    }

    if (!prov.onboardingSeen) {
      return const OnboardingScreen();
    }

    if (!prov.isLoggedIn) {
      return const AuthScreen();
    }

    final bottomRoutes = ['dashboard', 'invoices', 'customers', 'inventory', 'reports'];
    final bottomIndex = bottomRoutes.indexOf(_currentRoute);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          AppStrings.t(_currentRoute, ar),
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
        ),
        actions: [
          TextButton.icon(
            onPressed: prov.toggleLanguage,
            icon: const Icon(Icons.translate_rounded, color: AppTheme.accentGold, size: 18),
            label: Text(
              ar ? 'عربي | EN' : 'EN | عربي',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
            ),
          ),
          IconButton(
            tooltip: AppStrings.t('dark_mode', ar),
            onPressed: () {
              prov.updateSettings(
                prov.settings.copyWith(isDarkMode: !prov.settings.isDarkMode),
              );
            },
            icon: Icon(
              prov.settings.isDarkMode ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
              color: Colors.white,
            ),
          ),
        ],
      ),
      drawer: AppDrawer(
        currentRoute: _currentRoute,
        onNavigate: _navigate,
      ),
      body: _buildBody(),
      bottomNavigationBar: NavigationBar(
        selectedIndex: bottomIndex == -1 ? 0 : bottomIndex,
        onDestinationSelected: (idx) => _navigate(bottomRoutes[idx]),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.dashboard_outlined),
            selectedIcon: const Icon(Icons.dashboard_rounded),
            label: AppStrings.t('dashboard', ar),
          ),
          NavigationDestination(
            icon: const Icon(Icons.receipt_long_outlined),
            selectedIcon: const Icon(Icons.receipt_long_rounded),
            label: AppStrings.t('invoices', ar),
          ),
          NavigationDestination(
            icon: const Icon(Icons.people_outline_rounded),
            selectedIcon: const Icon(Icons.people_rounded),
            label: AppStrings.t('customers', ar),
          ),
          NavigationDestination(
            icon: const Icon(Icons.inventory_2_outlined),
            selectedIcon: const Icon(Icons.inventory_2_rounded),
            label: AppStrings.t('inventory', ar),
          ),
          NavigationDestination(
            icon: const Icon(Icons.assessment_outlined),
            selectedIcon: const Icon(Icons.assessment_rounded),
            label: AppStrings.t('reports', ar),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    switch (_currentRoute) {
      case 'dashboard':
        return DashboardScreen(onNavigate: _navigate);
      case 'invoices':
        return const InvoicesScreen();
      case 'customers':
        return CustomersScreen(onNavigate: _navigate);
      case 'suppliers':
        return SuppliersScreen(onNavigate: _navigate);
      case 'purchase_orders':
        return const PurchaseOrdersScreen();
      case 'vouchers':
        return const VouchersScreen();
      case 'journals':
        return const JournalsScreen();
      case 'inventory':
        return const InventoryScreen();
      case 'employees':
        return const EmployeesScreen();
      case 'expenses':
        return const ExpensesScreen();
      case 'banks':
        return const BanksScreen();
      case 'reports':
        return const ReportsScreen();
      case 'ai_analytics':
        return AiAnalyticsScreen(onNavigate: _navigate);
      case 'settings':
        return const SettingsScreen();
      case 'subscription':
        return const SubscriptionScreen();
      default:
        return DashboardScreen(onNavigate: _navigate);
    }
  }
}
