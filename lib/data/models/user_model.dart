import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/utils/date_utils.dart';

class UserModel {
  final String uid;
  final String name;
  final String email;
  final String phone;
  final String? avatarUrl;
  final String roleId;
  final List<String> projectIds;
  final String? fcmToken;
  final bool isActive;
  final DateTime createdAt;
  final DateTime lastLoginAt;
  final bool biometricEnabled;
  final Map<String, bool> preferences;

  const UserModel({
    required this.uid,
    required this.name,
    required this.email,
    required this.phone,
    this.avatarUrl,
    required this.roleId,
    this.projectIds = const [],
    this.fcmToken,
    this.isActive = true,
    required this.createdAt,
    required this.lastLoginAt,
    this.biometricEnabled = false,
    this.preferences = const {
      'announcements': true,
      'chats': true,
      'tasks': true,
    },
  });

  factory UserModel.fromMap(Map<String, dynamic> data, String id) {
    
    final rawPrefs = data['preferences'] as Map<String, dynamic>? ?? {};
    
    return UserModel(
      uid: id,
      name: data['name'] ?? '',
      email: data['email'] ?? '',
      phone: data['phone'] ?? '',
      avatarUrl: data['avatarUrl'],
      roleId: data['roleId'] ?? '',
      projectIds: List<String>.from(data['projectIds'] ?? []),
      fcmToken: data['fcmToken'],
      isActive: data['isActive'] ?? true,
      createdAt:
          AppDateUtils.fromTimestamp(data['createdAt']) ?? DateTime.now(),
      lastLoginAt:
          AppDateUtils.fromTimestamp(data['lastLoginAt']) ?? DateTime.now(),
      biometricEnabled: data['biometricEnabled'] ?? false,
      preferences: {
        'announcements': rawPrefs['announcements'] as bool? ?? true,
        'chats': rawPrefs['chats'] as bool? ?? true,
        'tasks': rawPrefs['tasks'] as bool? ?? true,
      },
    );
  }

  Map<String, dynamic> toFirestore() => {
    'name': name,
    'email': email,
    'phone': phone,
    'avatarUrl': avatarUrl,
    'roleId': roleId,
    'projectIds': projectIds,
    'fcmToken': fcmToken,
    'isActive': isActive,
    'createdAt': AppDateUtils.toTimestamp(createdAt),
    'lastLoginAt': AppDateUtils.toTimestamp(lastLoginAt),
    'biometricEnabled': biometricEnabled,
    'preferences': preferences,
  };

  UserModel copyWith({
    String? name,
    String? email,
    String? phone,
    String? avatarUrl,
    String? roleId,
    List<String>? projectIds,
    String? fcmToken,
    bool? isActive,
    bool? biometricEnabled,
    Map<String, bool>? preferences,
  }) {
    return UserModel(
      uid: uid,
      name: name ?? this.name,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      roleId: roleId ?? this.roleId,
      projectIds: projectIds ?? this.projectIds,
      fcmToken: fcmToken ?? this.fcmToken,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt,
      lastLoginAt: lastLoginAt,
      biometricEnabled: biometricEnabled ?? this.biometricEnabled,
      preferences: preferences ?? this.preferences,
    );
  }
}
