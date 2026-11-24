import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n/app_strings.dart';
import '../services/app_provider.dart';
import '../theme/app_theme.dart';

class SplashScreen extends StatefulWidget {
  final VoidCallback onFinished;
  const SplashScreen({super.key, required this.onFinished});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(const Duration(milliseconds: 1600), () {
      if (mounted) widget.onFinished();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ar = context.watch<AppProvider>().isAr;
    return Scaffold(
      backgroundColor: AppTheme.primaryEmerald,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 108,
              height: 108,
              decoration: BoxDecoration(
                color: AppTheme.accentGold.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(28),
                border: Border.all(color: AppTheme.accentGold, width: 2),
              ),
              child: const Center(child: Text('🛡️', style: TextStyle(fontSize: 54))),
            ),
            const SizedBox(height: 24),
            Text(
              AppStrings.t('app_name', ar),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 28,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Legend of Accounting · Ostora Systems',
              style: TextStyle(
                color: AppTheme.accentGold.withValues(alpha: 0.95),
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _controller = PageController();
  int _page = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<AppProvider>();
    final ar = prov.isAr;

    final pages = [
      (Icons.receipt_long_rounded, AppStrings.t('onboard_1_title', ar), AppStrings.t('onboard_1_desc', ar)),
      (Icons.inventory_2_rounded, AppStrings.t('onboard_2_title', ar), AppStrings.t('onboard_2_desc', ar)),
      (Icons.auto_graph_rounded, AppStrings.t('onboard_3_title', ar), AppStrings.t('onboard_3_desc', ar)),
    ];

    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: AppTheme.primaryEmerald,
        actions: [
          TextButton(
            onPressed: prov.toggleLanguage,
            child: Text(ar ? 'عربي | EN' : 'EN | عربي'),
          ),
          TextButton(
            onPressed: prov.completeOnboarding,
            child: Text(AppStrings.t('skip', ar)),
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              Expanded(
                child: PageView.builder(
                  controller: _controller,
                  onPageChanged: (i) => setState(() => _page = i),
                  itemCount: pages.length,
                  itemBuilder: (_, idx) {
                    final (icon, title, desc) = pages[idx];
                    return Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 120,
                          height: 120,
                          decoration: BoxDecoration(
                            color: AppTheme.primaryEmerald.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(32),
                          ),
                          child: Icon(icon, size: 60, color: AppTheme.primaryEmerald),
                        ),
                        const SizedBox(height: 32),
                        Text(
                          title,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 14),
                        Text(
                          desc,
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 15, color: Theme.of(context).hintColor, height: 1.5),
                        ),
                      ],
                    );
                  },
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  pages.length,
                  (i) => Container(
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: _page == i ? 24 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: _page == i ? AppTheme.primaryEmerald : Colors.grey.shade400,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: AppTheme.primaryEmerald,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  onPressed: () {
                    if (_page < 2) {
                      _controller.nextPage(
                        duration: const Duration(milliseconds: 280),
                        curve: Curves.easeOut,
                      );
                    } else {
                      prov.completeOnboarding();
                    }
                  },
                  child: Text(
                    _page < 2 ? AppStrings.t('next', ar) : AppStrings.t('start_now', ar),
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  bool _isRegister = false;
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<AppProvider>();
    final ar = prov.isAr;

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Align(
                  alignment: AlignmentDirectional.topEnd,
                  child: TextButton.icon(
                    onPressed: prov.toggleLanguage,
                    icon: const Icon(Icons.translate_rounded),
                    label: Text(ar ? 'عربي | EN' : 'EN | عربي'),
                  ),
                ),
                const SizedBox(height: 12),
                Center(
                  child: Container(
                    width: 78,
                    height: 78,
                    decoration: BoxDecoration(
                      color: AppTheme.primaryEmerald,
                      borderRadius: BorderRadius.circular(22),
                    ),
                    child: const Center(child: Text('🛡️', style: TextStyle(fontSize: 38))),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  AppStrings.t('app_name', ar),
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 6),
                Text(
                  AppStrings.t(_isRegister ? 'register' : 'login', ar),
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Theme.of(context).hintColor),
                ),
                const SizedBox(height: 28),
                if (_isRegister) ...[
                  TextFormField(
                    controller: _nameCtrl,
                    decoration: InputDecoration(labelText: AppStrings.t('full_name', ar)),
                    validator: (v) => (v == null || v.trim().isEmpty) ? '*' : null,
                  ),
                  const SizedBox(height: 14),
                ],
                TextFormField(
                  controller: _emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  decoration: InputDecoration(labelText: AppStrings.t('email', ar)),
                  validator: (v) => (v == null || !v.contains('@')) ? '*' : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _passCtrl,
                  obscureText: true,
                  decoration: InputDecoration(labelText: AppStrings.t('password', ar)),
                  validator: (v) => (v == null || v.length < 4) ? '*' : null,
                ),
                const SizedBox(height: 22),
                SizedBox(
                  height: 52,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: AppTheme.primaryEmerald,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    onPressed: () {
                      if (_formKey.currentState!.validate()) {
                        prov.loginDemo();
                      }
                    },
                    child: Text(
                      AppStrings.t(_isRegister ? 'register' : 'login', ar),
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: 50,
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: AppTheme.accentGold, width: 1.5),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    onPressed: prov.loginDemo,
                    icon: const Icon(Icons.flash_on_rounded, color: AppTheme.accentGold),
                    label: Text(
                      AppStrings.t('demo_login', ar),
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                TextButton(
                  onPressed: () => setState(() => _isRegister = !_isRegister),
                  child: Text(
                    AppStrings.t(_isRegister ? 'login' : 'register', ar),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
