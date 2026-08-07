import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'theme.dart';
import 'routes.dart';
import '../presentation/shared/widgets/error_widget.dart';

class KurickalApp extends ConsumerWidget {
  const KurickalApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'Task Pilot',
      theme: AppTheme.lightTheme,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
      builder: (context, child) {
        ErrorWidget.builder = (errorDetails) {
          return Scaffold(
            body: AppErrorWidget(message: errorDetails.exception.toString()),
          );
        };
        if (child == null) return const SizedBox.shrink();

        // Lock text scaling to 1.0 so the UI looks identical on every device,
        // regardless of the user's system font-size accessibility setting.
        // This guarantees the same UI/UX across all screen sizes — text never
        // shrinks or grows based on device or OS preferences.
        return MediaQuery.withNoTextScaling(child: child);
      },
    );
  }
}
