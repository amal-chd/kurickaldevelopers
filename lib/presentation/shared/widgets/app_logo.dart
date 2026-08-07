import 'package:flutter/material.dart';

/// Renders the Task Pilot app logo from assets.
class AppLogo extends StatelessWidget {
  /// Side length of the square canvas.
  final double size;

  /// Override the logo colour (not used for image logo, kept for compatibility).
  final Color? color;

  const AppLogo({super.key, this.size = 40, this.color});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Image.asset('assets/images/logo.png', fit: BoxFit.contain),
    );
  }
}

/// Full logo lockup: icon + wordmark side by side.
class AppLogoLockup extends StatelessWidget {
  final double iconSize;
  final Color iconColor;
  final Color textColor;

  const AppLogoLockup({
    super.key,
    this.iconSize = 32,
    this.iconColor = const Color(0xFF4472C4),
    this.textColor = Colors.white,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        AppLogo(size: iconSize, color: iconColor),
        SizedBox(width: iconSize * 0.3),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Task Pilot',
              style: TextStyle(
                fontFamily: 'Plus Jakarta Sans',
                fontSize: iconSize * 0.56,
                fontWeight: FontWeight.w800,
                color: textColor,
                letterSpacing: -0.3,
                height: 1,
              ),
            ),
            Text(
              'Task Management',
              style: TextStyle(
                fontFamily: 'Plus Jakarta Sans',
                fontSize: iconSize * 0.34,
                fontWeight: FontWeight.w500,
                color: textColor.withValues(alpha: 0.59),
                letterSpacing: 0.2,
                height: 1.2,
              ),
            ),
          ],
        ),
      ],
    );
  }
}
