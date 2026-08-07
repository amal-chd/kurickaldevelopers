enum ApprovalStatus { notRequired, pending, approved, rejected }

extension ApprovalStatusX on ApprovalStatus {
  String get value {
    switch (this) {
      case ApprovalStatus.notRequired:
        return 'not_required';
      case ApprovalStatus.pending:
        return 'pending';
      case ApprovalStatus.approved:
        return 'approved';
      case ApprovalStatus.rejected:
        return 'rejected';
    }
  }

  static ApprovalStatus fromString(String value) {
    return ApprovalStatus.values.firstWhere(
      (e) => e.value == value,
      orElse: () => ApprovalStatus.notRequired,
    );
  }
}
