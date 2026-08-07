import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

/// Centralized cached image widget with consistent placeholder, error
/// handling, and memory-optimized caching across the app.
class CachedImageWidget extends StatelessWidget {
  final String? imageUrl;
  final double? width;
  final double? height;
  final BoxFit fit;
  final BorderRadius? borderRadius;
  final Widget? placeholder;
  final Widget? errorWidget;

  /// Memory cache dimensions — prevents loading full-resolution images
  /// for small display sizes (e.g. 40px avatars loading 1080p images).
  final int? memCacheWidth;
  final int? memCacheHeight;

  const CachedImageWidget({
    super.key,
    required this.imageUrl,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius,
    this.placeholder,
    this.errorWidget,
    this.memCacheWidth,
    this.memCacheHeight,
  });

  @override
  Widget build(BuildContext context) {
    if (imageUrl == null || imageUrl!.isEmpty) {
      return _buildFallback();
    }

    final image = CachedNetworkImage(
      imageUrl: imageUrl!,
      width: width,
      height: height,
      fit: fit,
      memCacheWidth: memCacheWidth ?? _autoMemCacheWidth,
      memCacheHeight: memCacheHeight ?? _autoMemCacheHeight,
      placeholder: (context, url) =>
          placeholder ??
          Container(
            width: width,
            height: height,
            color: Colors.grey.shade200,
            child: const Center(
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          ),
      errorWidget: (context, url, error) =>
          errorWidget ?? _buildFallback(),
    );

    if (borderRadius != null) {
      return ClipRRect(borderRadius: borderRadius!, child: image);
    }
    return image;
  }

  Widget _buildFallback() {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: Colors.grey.shade300,
        borderRadius: borderRadius,
      ),
      child: Icon(
        Icons.image_outlined,
        color: Colors.grey.shade500,
        size: (width ?? 40) * 0.5,
      ),
    );
  }

  /// Auto-calculate memory cache width based on display size.
  /// Uses 2x for retina, capped at reasonable max.
  int? get _autoMemCacheWidth {
    if (width == null) return null;
    return (width! * 2).toInt().clamp(0, 600);
  }

  int? get _autoMemCacheHeight {
    if (height == null) return null;
    return (height! * 2).toInt().clamp(0, 600);
  }
}
