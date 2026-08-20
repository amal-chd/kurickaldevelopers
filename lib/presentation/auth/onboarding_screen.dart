import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../data/services/fcm_service.dart';
import '../../app/theme.dart';
import '../../core/constants/app_strings.dart';
import '../../data/models/user_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/user_provider.dart';
import '../../providers/role_provider.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  int _step = 0;
  final _nameCtrl = TextEditingController();
  String? _selectedRoleId;
  bool _notificationsEnabled = true;
  bool _biometricEnabled = false;
  bool _isLoading = false;

  final _pageController = PageController();

  void _nextStep() {
    HapticFeedback.lightImpact();
    if (_step == 0 && _nameCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Please enter your name',
            style: GoogleFonts.inter(fontWeight: FontWeight.w500),
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    if (_step == 1 && _selectedRoleId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Please select a role',
            style: GoogleFonts.inter(fontWeight: FontWeight.w500),
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    if (_step < 3) {
      setState(() => _step++);
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    } else {
      _complete();
    }
  }

  Future<void> _complete() async {
    await HapticFeedback.mediumImpact();
    setState(() => _isLoading = true);
    try {
      final fbUser = ref.read(authRepositoryProvider).currentUser!;
      String? fcmToken;
      if (_notificationsEnabled) {
        fcmToken = await FcmService().getToken();
      }

      final user = UserModel(
        uid: fbUser.uid,
        name: _nameCtrl.text.trim(),
        email: fbUser.email ?? '',
        phone: fbUser.phoneNumber ?? '',
        roleId: _selectedRoleId!,
        fcmToken: fcmToken,
        createdAt: DateTime.now(),
        lastLoginAt: DateTime.now(),
        biometricEnabled: _biometricEnabled,
      );

      await ref.read(userRepositoryProvider).createUser(user);

      if (_biometricEnabled) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setBool('biometric_enabled_${fbUser.uid}', true);
      }

      if (mounted) context.go('/dashboard');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e.toString(),
              style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w500),
            ),
            backgroundColor: AppTheme.error,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: Text(
          'Step ${_step + 1} of 4',
          style: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.w700,
            fontSize: 16,
            color: AppTheme.onSurface,
          ),
        ),
        backgroundColor: Colors.transparent,
        foregroundColor: AppTheme.onSurface,
        elevation: 0,
        centerTitle: true,
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(AppTheme.radiusPill),
                child: LinearProgressIndicator(
                  value: (_step + 1) / 4,
                  backgroundColor: AppTheme.divider.withValues(alpha: 0.5),
                  color: AppTheme.accent,
                  minHeight: 6,
                ),
              ),
            ),
            Expanded(
              child: PageView(
                controller: _pageController,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  _buildStep1(),
                  _buildStep2(),
                  _buildStep3(),
                  _buildStep4(),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(24),
              child: ElevatedButton(
                onPressed: _isLoading ? null : _nextStep,
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                ),
                child: _isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : Text(
                        _step == 3 ? 'Get Started' : 'Continue',
                        style: GoogleFonts.plusJakartaSans(
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStep1() {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 16),
          Text(
            AppStrings.whatsYourName,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: AppTheme.onSurface,
            ),
          ),
          const SizedBox(height: 24),
          TextFormField(
            controller: _nameCtrl,
            decoration: const InputDecoration(
              labelText: 'Full Name',
              hintText: 'Enter your full name',
            ),
            style: GoogleFonts.inter(fontSize: 15),
            textCapitalization: TextCapitalization.words,
            autofocus: true,
          ),
        ],
      ),
    );
  }

  Widget _buildStep2() {
    final rolesAsync = ref.watch(allRolesProvider);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 16),
          Text(
            AppStrings.selectYourRole,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: AppTheme.onSurface,
            ),
          ),
          const SizedBox(height: 20),
          rolesAsync.when(
            loading: () => const Expanded(
              child: Center(
                child: CircularProgressIndicator(color: AppTheme.primary),
              ),
            ),
            error: (e, _) => Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.error_outline_rounded,
                    size: 48,
                    color: AppTheme.error,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Failed to load roles',
                    style: GoogleFonts.inter(color: AppTheme.textMuted, fontWeight: FontWeight.w500),
                  ),
                  const SizedBox(height: 16),
                  OutlinedButton.icon(
                    onPressed: () {
                      HapticFeedback.lightImpact();
                      ref.invalidate(allRolesProvider);
                    },
                    icon: const Icon(Icons.refresh_rounded),
                    label: Text(
                      'Retry',
                      style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
            data: (roles) => Expanded(
              child: ListView.builder(
                itemCount: roles.length,
                itemBuilder: (_, i) {
                  final role = roles[i];
                  final isSelected = _selectedRoleId == role.id;
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? AppTheme.primary.withValues(alpha: 0.04)
                          : Colors.white,
                      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                      border: Border.all(
                        color: isSelected
                            ? AppTheme.primary
                            : AppTheme.divider.withValues(alpha: 0.5),
                        width: isSelected ? 2 : 1.5,
                      ),
                      boxShadow: isSelected ? null : AppTheme.softShadow,
                    ),
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                      ),
                      onTap: () {
                        HapticFeedback.selectionClick();
                        setState(() => _selectedRoleId = role.id);
                      },
                      title: Text(
                        role.name,
                        style: GoogleFonts.plusJakartaSans(
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                          color: isSelected ? AppTheme.primary : AppTheme.onSurface,
                        ),
                      ),
                      subtitle: role.description.isNotEmpty
                          ? Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(
                                role.description,
                                style: GoogleFonts.inter(
                                  fontSize: 13,
                                  color: AppTheme.textMuted,
                                ),
                              ),
                            )
                          : null,
                      trailing: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: isSelected ? AppTheme.primary : Colors.transparent,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: isSelected ? AppTheme.primary : AppTheme.divider,
                            width: 2,
                          ),
                        ),
                        child: Icon(
                          Icons.check_rounded,
                          size: 14,
                          color: isSelected ? Colors.white : Colors.transparent,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStep3() {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 16),
          Text(
            AppStrings.enableNotifications,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: AppTheme.onSurface,
            ),
          ),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              boxShadow: AppTheme.softShadow,
              border: Border.all(color: AppTheme.divider.withValues(alpha: 0.3)),
            ),
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppTheme.accent.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.notifications_active_rounded,
                    color: AppTheme.accent,
                    size: 36,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'Push Notifications',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Receive instant updates about tasks, project schedules, mentions, and key site approvals.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    color: AppTheme.textMuted,
                    height: 1.45,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 24),
                SwitchListTile.adaptive(
                  value: _notificationsEnabled,
                  onChanged: (v) {
                    HapticFeedback.selectionClick();
                    setState(() => _notificationsEnabled = v);
                  },
                  activeTrackColor: AppTheme.primary,
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                    'Receive Push Alerts',
                    style: GoogleFonts.plusJakartaSans(
                      fontWeight: FontWeight.w700,
                      color: AppTheme.onSurface,
                    ),
                  ),
                  subtitle: Text(
                    'Highly recommended for team sync',
                    style: GoogleFonts.inter(color: AppTheme.textMuted, fontSize: 12),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStep4() {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 16),
          Text(
            AppStrings.enableBiometric,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: AppTheme.onSurface,
            ),
          ),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              boxShadow: AppTheme.softShadow,
              border: Border.all(color: AppTheme.divider.withValues(alpha: 0.3)),
            ),
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.fingerprint_rounded,
                    color: AppTheme.primary,
                    size: 36,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'Biometric Authentication',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Unlock your Kurickal TMS workspace securely using Face ID or fingerprint recognition.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    color: AppTheme.textMuted,
                    height: 1.45,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 24),
                SwitchListTile.adaptive(
                  value: _biometricEnabled,
                  onChanged: (v) async {
                    HapticFeedback.selectionClick();
                    if (v) {
                      final localAuth = LocalAuthentication();
                      final canAuth = await localAuth.canCheckBiometrics;
                      if (!canAuth) {
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                'Biometric not available on this device',
                                style: GoogleFonts.inter(fontWeight: FontWeight.w500),
                              ),
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        }
                        return;
                      }
                    }
                    setState(() => _biometricEnabled = v);
                  },
                  activeTrackColor: AppTheme.primary,
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                    'Biometric Login',
                    style: GoogleFonts.plusJakartaSans(
                      fontWeight: FontWeight.w700,
                      color: AppTheme.onSurface,
                    ),
                  ),
                  subtitle: Text(
                    'Secured by device keychain',
                    style: GoogleFonts.inter(color: AppTheme.textMuted, fontSize: 12),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
