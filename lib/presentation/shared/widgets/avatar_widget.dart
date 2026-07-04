import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../../core/extensions/string_ext.dart';

class AvatarWidget extends StatelessWidget {
  final String? imageUrl;
  final String name;
  final double size;
  final Color? backgroundColor;

  const AvatarWidget({
    super.key,
    this.imageUrl,
    required this.name,
    this.size = 40,
    this.backgroundColor,
  });

  @override
  Widget build(BuildContext context) {
    if (imageUrl != null && imageUrl!.isNotEmpty) {
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: imageUrl!,
          width: size,
          height: size,
          fit: BoxFit.cover,
          // Prevent loading full-res images for small avatars
          memCacheWidth: (size * 2).toInt(),
          memCacheHeight: (size * 2).toInt(),
          placeholder: (_, __) => _initials(),
          errorWidget: (_, __, ___) => _initials(),
        ),
      );
    }
    return _initials();
  }

  List<Color> _getGradientColors(String inputName) {
    final hash = inputName.hashCode.abs();
    final gradients = [
      [const Color(0xFF4F46E5), const Color(0xFF7C3AED)], // Indigo -> Violet
      [const Color(0xFF0F172A), const Color(0xFF334155)], // Slate Midnight -> Soft Charcoal
      [const Color(0xFF0D9488), const Color(0xFF10B981)], // Teal -> Emerald
      [const Color(0xFFE11D48), const Color(0xFFF43F5E)], // Rose -> Coral
      [const Color(0xFFD97706), const Color(0xFFF59E0B)], // Amber -> Gold
      [const Color(0xFF6D28D9), const Color(0xFFDB2777)], // Violet -> Fuchsia
    ];
    return gradients[hash % gradients.length];
  }

  Widget _initials() {
    final gradientColors = _getGradientColors(name);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: backgroundColor,
        gradient: backgroundColor == null
            ? LinearGradient(
                colors: gradientColors,
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              )
            : null,
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Text(
          name.initials,
          style: TextStyle(
            color: Colors.white,
            fontSize: size * 0.35,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
