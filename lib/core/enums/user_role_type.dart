enum UserRoleType {
  director,
  projectManager,
  siteEngineer,
  foreman,
  labour,
  admin,
}

extension UserRoleTypeX on UserRoleType {
  String get value {
    switch (this) {
      case UserRoleType.director:
        return 'director';
      case UserRoleType.projectManager:
        return 'project_manager';
      case UserRoleType.siteEngineer:
        return 'site_engineer';
      case UserRoleType.foreman:
        return 'foreman';
      case UserRoleType.labour:
        return 'labour';
      case UserRoleType.admin:
        return 'admin';
    }
  }

  static UserRoleType fromString(String value) {
    return UserRoleType.values.firstWhere(
      (e) => e.value == value,
      orElse: () => UserRoleType.labour,
    );
  }
}
