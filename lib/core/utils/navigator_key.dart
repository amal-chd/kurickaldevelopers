import 'package:flutter/material.dart';

/// Shared [GlobalKey] used by the GoRouter and FcmService so that
/// notification taps can navigate without a BuildContext.
final GlobalKey<NavigatorState> appNavigatorKey = GlobalKey<NavigatorState>();
