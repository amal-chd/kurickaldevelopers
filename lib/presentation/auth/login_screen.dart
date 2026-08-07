import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../app/theme.dart';
import '../../core/constants/app_strings.dart';
import '../../core/utils/validators.dart';
import '../../providers/auth_provider.dart';
import '../shared/widgets/app_logo.dart';

/// URLs for legal pages — point to the deployed web landing.
const _kPrivacyPolicyUrl = 'https://kurickaldevelopers.com/privacy-policy';
const _kTermsOfUseUrl = 'https://kurickaldevelopers.com/terms';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  // Helper: dismiss keyboard
  void _dismissKeyboard() => FocusScope.of(context).unfocus();

  // Helper: show error snackbar
  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(
            message,
            style: GoogleFonts.inter(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500),
          ),
          backgroundColor: AppTheme.error,
          duration: const Duration(seconds: 4),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTheme.radiusSm)),
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          action: SnackBarAction(
            label: 'OK',
            textColor: Colors.white70,
            onPressed: () {
              HapticFeedback.lightImpact();
              ScaffoldMessenger.of(context).hideCurrentSnackBar();
            },
          ),
        ),
      );
  }

  // Helper: post sign-in routing.
  // Sign-in only — no onboarding. Accounts and roles are provisioned by an
  // admin in User Management, so every authenticated user goes to the dashboard.
  Future<void> _routeAfterAuth(String uid) async {
    if (!mounted) return;
    context.go('/dashboard');
  }

  // Email + Password
  Future<void> _signInWithEmail() async {
    _dismissKeyboard();
    final formState = _formKey.currentState;
    if (formState == null || !formState.validate()) return;

    await HapticFeedback.mediumImpact();
    setState(() => _isLoading = true);
    try {
      final credential = await ref
          .read(authRepositoryProvider)
          .signInWithEmail(_emailCtrl.text.trim(), _passwordCtrl.text);
      await _routeAfterAuth(credential.user!.uid);
    } catch (e) {
      _showError(e.toString());
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // Forgot Password
  Future<void> _forgotPassword() async {
    await HapticFeedback.lightImpact();
    if (_emailCtrl.text.trim().isEmpty) {
      _showError('Enter your email first');
      return;
    }
    try {
      await ref
          .read(authRepositoryProvider)
          .sendPasswordResetEmail(_emailCtrl.text.trim());
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Password reset email sent',
              style: GoogleFonts.inter(fontWeight: FontWeight.w500),
            ),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      _showError(e.toString());
    }
  }

  // Open URL
  Future<void> _openUrl(String url) async {
    await HapticFeedback.lightImpact();
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0xFFF1F5F9), // Soft slate 100
              Color(0xFFF8FAFC), // Soft slate 50
            ],
          ),
        ),
        child: GestureDetector(
          onTap: _dismissKeyboard,
          child: SafeArea(
            child: SingleChildScrollView(
              physics: const ClampingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
              child: Form(
                key: _formKey,
                autovalidateMode: AutovalidateMode.disabled,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 16),

                    // Logo
                    Center(
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withValues(alpha: 0.6),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.9),
                            width: 1.5,
                          ),
                          boxShadow: AppTheme.softShadow,
                        ),
                        child: Container(
                          width: 90,
                          height: 90,
                          decoration: const BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                          ),
                          child: const Center(
                            child: AppLogo(size: 54, color: AppTheme.primary),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // App Name
                    Center(
                      child: Text(
                        AppStrings.appName,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          color: AppTheme.onSurface,
                          letterSpacing: -0.5,
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Center(
                      child: Text(
                        'Construction Task Management',
                        style: GoogleFonts.inter(
                          color: AppTheme.textMuted,
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Center(
                      child: Text(
                        'Sign in to your account',
                        style: GoogleFonts.inter(
                          color: AppTheme.onSurface,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(height: 40),

                    // Email Field
                    TextFormField(
                      controller: _emailCtrl,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      decoration: InputDecoration(
                        labelText: AppStrings.email,
                        prefixIcon: const Icon(Icons.email_outlined),
                      ),
                      style: GoogleFonts.inter(fontSize: 15),
                      validator: Validators.email,
                    ),
                    const SizedBox(height: 18),

                    // Password Field
                    TextFormField(
                      controller: _passwordCtrl,
                      obscureText: _obscurePassword,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _signInWithEmail(),
                      decoration: InputDecoration(
                        labelText: AppStrings.password,
                        prefixIcon: const Icon(Icons.lock_outlined),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscurePassword
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                          onPressed: () {
                            HapticFeedback.selectionClick();
                            setState(() => _obscurePassword = !_obscurePassword);
                          },
                        ),
                      ),
                      style: GoogleFonts.inter(fontSize: 15),
                      validator: Validators.password,
                    ),

                    // Forgot Password
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: _forgotPassword,
                        child: Text(
                          AppStrings.forgotPassword,
                          style: GoogleFonts.plusJakartaSans(
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                            color: AppTheme.primary,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Sign In Button
                    ElevatedButton(
                      onPressed: _isLoading ? null : _signInWithEmail,
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      child: _isLoading
                          ? const SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2.5,
                              ),
                            )
                          : Text(
                              AppStrings.signIn,
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                    ),

                    // Legal Links
                    const SizedBox(height: 32),
                    Center(
                      child: Wrap(
                        alignment: WrapAlignment.center,
                        spacing: 4,
                        runSpacing: 4,
                        children: [
                          Text(
                            'By signing in you agree to our',
                            style: GoogleFonts.inter(
                              color: AppTheme.textMuted,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          GestureDetector(
                            onTap: () => _openUrl(_kTermsOfUseUrl),
                            child: Text(
                              'Terms of Use',
                              style: GoogleFonts.inter(
                                color: AppTheme.brand,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                decoration: TextDecoration.underline,
                              ),
                            ),
                          ),
                          Text(
                            '&',
                            style: GoogleFonts.inter(
                              color: AppTheme.textMuted,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          GestureDetector(
                            onTap: () => _openUrl(_kPrivacyPolicyUrl),
                            child: Text(
                              'Privacy Policy',
                              style: GoogleFonts.inter(
                                color: AppTheme.brand,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                decoration: TextDecoration.underline,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Dev-mode credentials panel
                    if (kDebugMode) ...[
                      const SizedBox(height: 40),
                      _DevCredentialsPanel(
                        onSelect: (email, password) {
                          HapticFeedback.lightImpact();
                          _emailCtrl.text = email;
                          _passwordCtrl.text = password;
                        },
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DevCredentialsPanel extends StatefulWidget {
  final void Function(String email, String password) onSelect;
  const _DevCredentialsPanel({required this.onSelect});

  @override
  State<_DevCredentialsPanel> createState() => _DevCredentialsPanelState();
}

class _DevCredentialsPanelState extends State<_DevCredentialsPanel> {
  bool _expanded = false;

  static const _credentials = [
    _Credential(
      'Director / Owner',
      'thomas@kurickaldevelopers.com',
      'Kurickal@2024',
      Color(0xFF1E293B),
    ),
    _Credential(
      'Project Manager',
      'ravi@kurickaldevelopers.com',
      'Kurickal@2024',
      Color(0xFF3B82F6),
    ),
    _Credential(
      'Site Engineer',
      'arjun@kurickaldevelopers.com',
      'Kurickal@2024',
      Color(0xFF10B981),
    ),
    _Credential(
      'Site Engineer 2',
      'priya@kurickaldevelopers.com',
      'Kurickal@2024',
      Color(0xFF10B981),
    ),
    _Credential(
      'Foreman',
      'suresh@kurickaldevelopers.com',
      'Kurickal@2024',
      Color(0xFFF59E0B),
    ),
    _Credential(
      'Labour',
      'biju@kurickaldevelopers.com',
      'Kurickal@2024',
      Color(0xFF64748B),
    ),
    _Credential(
      'Admin',
      'meena@kurickaldevelopers.com',
      'Kurickal@2024',
      Color(0xFF8B5CF6),
    ),
    _Credential(
      'Accounts',
      'anitha@kurickaldevelopers.com',
      'Kurickal@2024',
      Color(0xFF14B8A6),
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.primary.withValues(alpha: 0.04),
        border: Border.all(color: AppTheme.primary.withValues(alpha: 0.08), width: 1.5),
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () {
              HapticFeedback.selectionClick();
              setState(() => _expanded = !_expanded);
            },
            borderRadius: BorderRadius.circular(AppTheme.radiusMd),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Row(
                children: [
                  const Icon(
                    Icons.admin_panel_settings_rounded,
                    size: 20,
                    color: AppTheme.primary,
                  ),
                  const SizedBox(width: 10),
                  Text(
                    'DEV — Test Accounts',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.primary,
                    ),
                  ),
                  const Spacer(),
                  AnimatedRotation(
                    turns: _expanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: const Icon(
                      Icons.keyboard_arrow_down_rounded,
                      color: AppTheme.primary,
                      size: 20,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (_expanded) ...[
            const Divider(height: 1, color: Color(0x1F1A3A5C)),
            const SizedBox(height: 8),
            ...(_credentials.map(
              (c) => _CredentialRow(
                credential: c,
                onTap: () => widget.onSelect(c.email, c.password),
              ),
            )),
            const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }
}

class _CredentialRow extends StatelessWidget {
  final _Credential credential;
  final VoidCallback onTap;
  const _CredentialRow({required this.credential, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: credential.color.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: credential.color,
                  shape: BoxShape.circle,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    credential.role,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    credential.email,
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: AppTheme.textMuted,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.05),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.login_rounded,
                size: 14,
                color: AppTheme.primary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Credential {
  final String role;
  final String email;
  final String password;
  final Color color;
  const _Credential(this.role, this.email, this.password, this.color);
}
