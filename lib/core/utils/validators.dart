class Validators {
  static String? required(String? value, {String field = 'This field'}) {
    if (value == null || value.trim().isEmpty) return '$field is required';
    return null;
  }

  static String? email(String? value) {
    if (value == null || value.isEmpty) return 'Email is required';
    final regex = RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$');
    if (!regex.hasMatch(value)) return 'Enter a valid email address';
    return null;
  }

  static String? password(String? value) {
    if (value == null || value.isEmpty) return 'Password is required';
    if (value.length < 6) return 'Password must be at least 6 characters';
    return null;
  }

  static String? phone(String? value) {
    if (value == null || value.isEmpty) return 'Phone number is required';
    final regex = RegExp(r'^\+?[0-9]{10,15}$');
    if (!regex.hasMatch(value)) {
      return 'Enter a valid phone number (e.g. +1234567890)';
    }
    return null;
  }

  static String? alphanumeric(String? value, {required String field}) {
    if (value == null || value.isEmpty) return '$field is required';
    final regex = RegExp(r'^[a-zA-Z0-9\s]+$');
    if (!regex.hasMatch(value)) {
      return '$field can only contain letters and numbers';
    }
    return null;
  }

  static String? minLength(
    String? value, {
    required String field,
    int min = 3,
  }) {
    if (value == null || value.isEmpty) return '$field is required';
    if (value.length < min) return '$field must be at least $min characters';
    return null;
  }

  static String? nonNegative(String? value, {required String field}) {
    if (value == null || value.isEmpty) return '$field is required';
    final n = num.tryParse(value);
    if (n == null) return '$field must be a number';
    if (n < 0) return '$field cannot be negative';
    return null;
  }
}
