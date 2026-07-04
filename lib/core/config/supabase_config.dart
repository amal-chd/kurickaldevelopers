/// Supabase is used ONLY as the storage backend (chat file uploads +
/// documents). Authentication and the database stay on Firebase.
///
/// Fill in [url] and [anonKey] below (the anon key is a public client key —
/// safe to ship in the app), or pass them at build time with:
///   flutter run --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...
class SupabaseConfig {
  static const String url = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://ximaqbhnykyxxgiqbwoh.supabase.co',
  );

  static const String anonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpbWFxYmhueWt5eHhnaXFid29oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3ODAyMzgsImV4cCI6MjA5NzM1NjIzOH0.5ZfmFsCt6VTNIQfESq5EAg9R8CxUl__NnKhwh8GSYKg',
  );

  // Storage bucket names — create these in the Supabase dashboard.
  static const String documentsBucket = 'documents';
  static const String chatFilesBucket = 'chat-files';

  /// True once real credentials have been provided.
  static bool get isConfigured =>
      !url.contains('YOUR_PROJECT_REF') && !anonKey.startsWith('YOUR_');
}
