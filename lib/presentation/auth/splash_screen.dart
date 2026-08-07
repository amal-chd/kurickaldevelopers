import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../app/theme.dart';
import '../../providers/auth_provider.dart';
import '../shared/widgets/app_logo.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _fade;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );
    _fade = CurvedAnimation(parent: _ctrl, curve: Curves.easeInOutCubic);
    _scale = Tween<double>(
      begin: 0.88,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutBack));
    _ctrl.forward();
    _navigate();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _navigate() async {
    // 1. Wait for minimum splash display time to show logo/animation
    final minDelay = Future.delayed(const Duration(milliseconds: 1500));

    // 2. Wait for authStateProvider to resolve
    User? resolvedUser;
    bool resolved = false;

    final currentState = ref.read(authStateProvider);
    if (!currentState.isLoading) {
      resolvedUser = currentState.value;
      resolved = true;
    } else {
      try {
        resolvedUser = await ref.read(authStateProvider.future);
        resolved = true;
      } catch (_) {
        resolvedUser = FirebaseAuth.instance.currentUser;
        resolved = true;
      }
    }

    await minDelay;
    if (!resolved || !mounted) return;

    if (resolvedUser == null) {
      context.go('/login');
      return;
    }

    final prefs = await SharedPreferences.getInstance();
    final biometricEnabled =
        prefs.getBool('biometric_enabled_${resolvedUser.uid}') ?? false;

    if (biometricEnabled) {
      final localAuth = LocalAuthentication();
      try {
        final authenticated = await localAuth.authenticate(
          localizedReason: 'Authenticate to access Task Pilot',
        );
        if (!mounted) return;
        if (authenticated) {
          context.go('/dashboard');
        } else {
          _showBiometricFailedDialog(resolvedUser);
        }
      } catch (_) {
        if (!mounted) return;
        context.go('/login');
      }
    } else {
      if (!mounted) return;
      context.go('/dashboard');
    }
  }

  void _showBiometricFailedDialog(User user) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        ),
        title: const Text(
          'Authentication Failed',
          style: TextStyle(
            color: AppTheme.onSurface,
            fontWeight: FontWeight.w800,
            fontFamily: 'Plus Jakarta Sans',
          ),
        ),
        content: const Text(
          'Biometric authentication failed or was cancelled.',
          style: TextStyle(
            color: AppTheme.textMuted,
            fontSize: 14,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.go('/login');
            },
            child: const Text(
              'Use Password',
              style: TextStyle(
                color: AppTheme.textMuted,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              _navigate();
            },
            child: const Text(
              'Try Again',
              style: TextStyle(
                color: AppTheme.primary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.primary,
      body: Stack(
        children: [
          // Background decoration (Premium radial gradients for ambient glow)
          Positioned(
            top: -80,
            right: -80,
            child: Container(
              width: 280,
              height: 280,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppTheme.accent.withValues(alpha: 0.15),
                    AppTheme.accent.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            bottom: -120,
            left: -60,
            child: Container(
              width: 320,
              height: 320,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppTheme.accent.withValues(alpha: 0.10),
                    AppTheme.accent.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),

          // Logo + wordmark
          Center(
            child: FadeTransition(
              opacity: _fade,
              child: ScaleTransition(
                scale: _scale,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Logo badge
                    Container(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(28),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.3),
                            blurRadius: 40,
                            spreadRadius: 4,
                          ),
                        ],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(28),
                        child: AppLogo(size: 108),
                      ),
                    ),
                    const SizedBox(height: 28),
                    const Text(
                      'Task Pilot',
                      style: TextStyle(
                        fontFamily: 'Plus Jakarta Sans',
                        color: Colors.white,
                        fontSize: 30,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Construction Task Management',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.63),
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        letterSpacing: 0.4,
                      ),
                    ),
                    const SizedBox(height: 60),
                    SizedBox(
                      width: 28,
                      height: 28,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          Colors.white.withValues(alpha: 0.39),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Bottom tag
          Positioned(
            bottom: 40,
            left: 0,
            right: 0,
            child: FadeTransition(
              opacity: _fade,
              child: Text(
                'Kurickal Developers LLP',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.31),
                  fontSize: 12,
                  letterSpacing: 0.5,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
