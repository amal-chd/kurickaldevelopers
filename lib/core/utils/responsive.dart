import 'package:flutter/material.dart';

class Responsive {
  static const double _mobileBreakpoint = 600;
  static const double _tabletBreakpoint = 1024;

  static bool isMobile(BuildContext context) =>
      MediaQuery.sizeOf(context).width < _mobileBreakpoint;

  static bool isTablet(BuildContext context) {
    final w = MediaQuery.sizeOf(context).width;
    return w >= _mobileBreakpoint && w < _tabletBreakpoint;
  }

  static bool isDesktop(BuildContext context) =>
      MediaQuery.sizeOf(context).width >= _tabletBreakpoint;

  static bool isWide(BuildContext context) =>
      MediaQuery.sizeOf(context).width >= _mobileBreakpoint;

  /// Returns different values based on screen width.
  static T value<T>(
    BuildContext context, {
    required T mobile,
    T? tablet,
    T? desktop,
  }) {
    if (isDesktop(context)) return desktop ?? tablet ?? mobile;
    if (isTablet(context)) return tablet ?? mobile;
    return mobile;
  }

  /// Horizontal content padding that scales with screen size.
  static EdgeInsets get horizontalPadding =>
      const EdgeInsets.symmetric(horizontal: 16);

  static EdgeInsets screenPadding(BuildContext context) {
    final w = MediaQuery.sizeOf(context).width;
    if (w >= _tabletBreakpoint) {
      return const EdgeInsets.symmetric(horizontal: 48);
    }
    if (w >= _mobileBreakpoint) {
      return const EdgeInsets.symmetric(horizontal: 32);
    }
    return const EdgeInsets.symmetric(horizontal: 16);
  }

  /// Column count for grid layouts.
  static int gridColumns(BuildContext context) =>
      value(context, mobile: 2, tablet: 3, desktop: 4);

  /// Max content width for centering on large screens.
  static double maxContentWidth(BuildContext context) =>
      value(context, mobile: double.infinity, tablet: 720, desktop: 1100);
}
