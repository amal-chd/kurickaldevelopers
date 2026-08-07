import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // Brand Palette — Task Pilot slate + amber (matched to the web dashboard's
  // tailwind.config.js for cross-platform brand consistency).
  static const Color brand = Color(0xFF0F172A); // Brand Slate
  static const Color brandDark = Color(0xFF020617);
  static const Color brandLight = Color(0xFF334155);
  static const Color primary = Color(0xFF0F172A); // Brand Slate Primary
  static const Color primaryMid = Color(0xFF1E293B);
  static const Color accent = Color(0xFFF59E0B); // Amber Accent
  static const Color accentDark = Color(0xFFD97706);
  static const Color error = Color(0xFFEF4444);
  static const Color success = Color(0xFF10B981);
  static const Color warning = Color(0xFFF59E0B);
  static const Color info = Color(0xFF3B82F6);

  // Pastel Palette (New)
  static const Color pastelPurple = Color(0xFFE9D5FF);
  static const Color pastelYellow = Color(0xFFFEF08A);
  static const Color pastelBlue = Color(0xFFBFDBFE);
  static const Color pastelGreen = Color(0xFFBBF7D0);
  static const Color pastelPink = Color(0xFFFBCFE8);

  // Surface Palette (Enhanced)
  static const Color background = Color(0xFFF9FAFB);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceAlt = Color(0xFFF3F4F6);
  static const Color onSurface = Color(0xFF0F172A);
  static const Color divider = Color(0xFFE2E8F0);
  static const Color textMuted = Color(0xFF475569);
  static const Color textLight = Color(0xFF64748B);

  // Status Colours
  static const Color statusCreated = Color(0xFF94A3B8);
  static const Color statusAssigned = Color(0xFF3B82F6);
  static const Color statusInProgress = Color(0xFFF59E0B);
  static const Color statusReview = Color(0xFF8B5CF6);
  static const Color statusApproved = Color(0xFF14B8A6);
  static const Color statusDone = Color(0xFF10B981);
  static const Color statusOverdue = Color(0xFFEF4444);

  // Health Colours
  static const Color healthGreen = Color(0xFF10B981);
  static const Color healthAmber = Color(0xFFF59E0B);
  static const Color healthRed = Color(0xFFEF4444);

  // Shadow Constants (Premium)
  static List<BoxShadow> softShadow = [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.02),
      blurRadius: 24,
      offset: const Offset(0, 8),
    ),
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.03),
      blurRadius: 40,
      offset: const Offset(0, 16),
    ),
  ];

  static List<BoxShadow> mediumShadow = [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.06),
      blurRadius: 24,
      offset: const Offset(0, 8),
    ),
  ];

  // Border Radius Constants
  static const double radiusXs = 8.0;
  static const double radiusBtn = 14.0; // Modern button radius (not full pill)
  static const double radiusSm = 16.0;
  static const double radiusMd = 24.0;
  static const double radiusLg = 32.0;
  static const double radiusXl = 40.0;
  static const double radiusPill = 100.0;

  // Light Theme (Enhanced)
  static ThemeData get lightTheme {
    const seedColor = primary;
    final baseTextTheme = ThemeData.light().textTheme;

    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: seedColor,
        primary: primary,
        secondary: accent,
        error: error,
        surface: surface,
        onSurface: onSurface,
        surfaceContainerHighest: surfaceAlt,
      ),
      scaffoldBackgroundColor: background,

      // AppBar
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: onSurface,
        elevation: 0,
        scrolledUnderElevation: 1,
        centerTitle: false,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: GoogleFonts.plusJakartaSans(
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: onSurface,
        ),
      ),

      // Cards
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusMd),
        ),
        margin: EdgeInsets.zero,
        shadowColor: Colors.transparent,
      ),

      // Elevated Button
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusBtn),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          textStyle: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.w600,
            fontSize: 15,
          ),
        ),
      ),

      // Filled Button
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: accent,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusBtn),
          ),
          textStyle: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.w600,
          ),
        ),
      ),

      // Outlined Button
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primary,
          side: const BorderSide(color: divider, width: 1.5),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusBtn),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          textStyle: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.w600,
          ),
        ),
      ),

      // Text Button
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: primary,
          textStyle: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.w600,
            fontSize: 14,
          ),
        ),
      ),

      // Input
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceAlt,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSm),
          borderSide: const BorderSide(color: divider, width: 1.5),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSm),
          borderSide: const BorderSide(color: divider, width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSm),
          borderSide: const BorderSide(color: primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSm),
          borderSide: const BorderSide(color: error, width: 2),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSm),
          borderSide: const BorderSide(color: error, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 18,
          vertical: 16,
        ),
        labelStyle: GoogleFonts.inter(
          color: textMuted,
          fontSize: 14,
        ),
        hintStyle: GoogleFonts.inter(
          color: textLight,
          fontSize: 14,
        ),
        floatingLabelStyle: GoogleFonts.plusJakartaSans(
          color: primary,
          fontWeight: FontWeight.w600,
        ),
      ),

      // Chips
      chipTheme: ChipThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100)),
        labelStyle: GoogleFonts.inter(
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      ),

      // FAB
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(radiusLg)),
        ),
      ),

      // Navigation Bar
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surface,
        elevation: 4,
        surfaceTintColor: Colors.transparent,
        shadowColor: Colors.black.withValues(alpha: 0.05),
        indicatorColor: primary.withValues(alpha: 0.08),
        height: 72,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return GoogleFonts.plusJakartaSans(
              color: primary,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            );
          }
          return GoogleFonts.inter(color: textMuted, fontSize: 12);
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: primary, size: 26);
          }
          return IconThemeData(color: textLight, size: 26);
        }),
      ),

      // Navigation Rail
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: surface,
        selectedIconTheme: const IconThemeData(color: primary),
        unselectedIconTheme: IconThemeData(color: textLight),
        indicatorColor: primary.withValues(alpha: 0.08),
        selectedLabelTextStyle: GoogleFonts.plusJakartaSans(
          color: primary,
          fontWeight: FontWeight.w700,
          fontSize: 13,
        ),
        unselectedLabelTextStyle: GoogleFonts.inter(
          color: textMuted,
          fontSize: 13,
        ),
      ),

      // Divider
      dividerTheme: const DividerThemeData(
        color: divider,
        thickness: 1,
        space: 1,
      ),

      // List Tile
      listTileTheme: const ListTileThemeData(
        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      ),

      // Bottom Sheet
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(radiusXl)),
        ),
        elevation: 8,
      ),

      // Snack Bar
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusMd),
        ),
        contentTextStyle: GoogleFonts.inter(
          fontWeight: FontWeight.w500,
        ),
        elevation: 4,
      ),

      // Text Theme (Enhanced)
      textTheme: GoogleFonts.interTextTheme(baseTextTheme).copyWith(
        displayLarge: GoogleFonts.plusJakartaSans(
          textStyle: baseTextTheme.displayLarge?.copyWith(
            fontWeight: FontWeight.w800,
            color: onSurface,
            fontSize: 32,
          ),
        ),
        displayMedium: GoogleFonts.plusJakartaSans(
          textStyle: baseTextTheme.displayMedium?.copyWith(
            fontWeight: FontWeight.w800,
            color: onSurface,
            fontSize: 28,
          ),
        ),
        displaySmall: GoogleFonts.plusJakartaSans(
          textStyle: baseTextTheme.displaySmall?.copyWith(
            fontWeight: FontWeight.w800,
            color: onSurface,
            fontSize: 24,
          ),
        ),
        headlineLarge: GoogleFonts.plusJakartaSans(
          textStyle: baseTextTheme.headlineLarge?.copyWith(
            fontWeight: FontWeight.w700,
            color: onSurface,
            fontSize: 22,
          ),
        ),
        headlineMedium: GoogleFonts.plusJakartaSans(
          textStyle: baseTextTheme.headlineMedium?.copyWith(
            fontWeight: FontWeight.w700,
            color: onSurface,
            fontSize: 20,
          ),
        ),
        headlineSmall: GoogleFonts.plusJakartaSans(
          textStyle: baseTextTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w700,
            color: onSurface,
            fontSize: 18,
          ),
        ),
        titleLarge: GoogleFonts.plusJakartaSans(
          textStyle: baseTextTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w700,
            color: onSurface,
            fontSize: 16,
          ),
        ),
        titleMedium: GoogleFonts.inter(
          textStyle: baseTextTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w600,
            color: onSurface,
            fontSize: 15,
          ),
        ),
        titleSmall: GoogleFonts.inter(
          textStyle: baseTextTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w600,
            color: textMuted,
            fontSize: 14,
          ),
        ),
        bodyLarge: GoogleFonts.inter(
          textStyle: baseTextTheme.bodyLarge?.copyWith(
            fontWeight: FontWeight.normal,
            color: onSurface,
            fontSize: 16,
            height: 1.5,
          ),
        ),
        bodyMedium: GoogleFonts.inter(
          textStyle: baseTextTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.normal,
            color: onSurface,
            fontSize: 14,
            height: 1.5,
          ),
        ),
        bodySmall: GoogleFonts.inter(
          textStyle: baseTextTheme.bodySmall?.copyWith(
            fontWeight: FontWeight.normal,
            color: textMuted,
            fontSize: 13,
            height: 1.4,
          ),
        ),
        labelLarge: GoogleFonts.inter(
          textStyle: baseTextTheme.labelLarge?.copyWith(
            fontWeight: FontWeight.w700,
            fontSize: 14,
          ),
        ),
        labelMedium: GoogleFonts.inter(
          textStyle: baseTextTheme.labelMedium?.copyWith(
            fontWeight: FontWeight.w600,
            fontSize: 13,
          ),
        ),
        labelSmall: GoogleFonts.inter(
          textStyle: baseTextTheme.labelSmall?.copyWith(
            fontWeight: FontWeight.w600,
            fontSize: 11,
          ),
        ),
      ),
    );
  }
}
