/// Endpoint of the serverless push sender (the `api/send-push` function
/// deployed alongside the web app on Vercel). Push is sent from there because
/// FCM's HTTP v1 API needs a service-account credential that must never ship
/// inside the app.
///
/// Override at build time with:
///   flutter run --dart-define=PUSH_ENDPOINT=https://your-app.vercel.app/api/send-push
class PushConfig {
  static const String endpoint = String.fromEnvironment(
    'PUSH_ENDPOINT',
    defaultValue: 'https://ximaqbhnykyxxgiqbwoh.supabase.co/functions/v1/send-push',
  );

  /// Whether a real endpoint has been configured (guards against firing
  /// requests at the placeholder during local development).
  static bool get isConfigured => !endpoint.contains('YOUR_');
}
