import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/utils/date_utils.dart';

class PerformanceScoreModel {
  final String id;
  final String userId;
  final int totalTasksCompleted;
  final int totalTasksAssigned;
  final int tasksCompletedOnTime;
  final int tasksCompletedLate;
  final int tasksOverdue;
  final int tasksRejected;
  final int tasksReopened;
  final int deadlineExtensions;
  final int consecutiveSuccesses;
  final int bestStreak;
  final Map<String, int> completedByPriority;
  final double avgCompletionHours;
  final double avgEfficiencyRatio;
  final double avgPeerReviewScore;
  final double avgManagerReviewScore;
  final int qualityScore;
  final int dailyActivityDays;
  final List<int> weeklyCompletionRates;
  final List<int> monthlyCompletionRates;
  final int tasksHelpedOnCount;
  final int collaborationScore;
  final int attendanceDays;
  final int attendanceRate;
  final int productivityScore;
  final int reliabilityScore;
  final int efficiencyScore;
  final int overallPerformanceIndex;
  final int totalPenaltyPoints;
  final Map<String, int> penaltyBreakdown;
  final List<String> badges;
  final String roleId;
  final double departmentNormalizationFactor;
  final DateTime lastRecalculatedAt;

  const PerformanceScoreModel({
    required this.id,
    required this.userId,
    required this.totalTasksCompleted,
    required this.totalTasksAssigned,
    required this.tasksCompletedOnTime,
    required this.tasksCompletedLate,
    required this.tasksOverdue,
    required this.tasksRejected,
    required this.tasksReopened,
    required this.deadlineExtensions,
    required this.consecutiveSuccesses,
    required this.bestStreak,
    required this.completedByPriority,
    required this.avgCompletionHours,
    required this.avgEfficiencyRatio,
    required this.avgPeerReviewScore,
    required this.avgManagerReviewScore,
    required this.qualityScore,
    required this.dailyActivityDays,
    required this.weeklyCompletionRates,
    required this.monthlyCompletionRates,
    required this.tasksHelpedOnCount,
    required this.collaborationScore,
    required this.attendanceDays,
    required this.attendanceRate,
    required this.productivityScore,
    required this.reliabilityScore,
    required this.efficiencyScore,
    required this.overallPerformanceIndex,
    required this.totalPenaltyPoints,
    required this.penaltyBreakdown,
    required this.badges,
    required this.roleId,
    required this.departmentNormalizationFactor,
    required this.lastRecalculatedAt,
  });

  factory PerformanceScoreModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    
    final priorityMap = Map<String, dynamic>.from(data['completedByPriority'] ?? {});
    final penaltyMap = Map<String, dynamic>.from(data['penaltyBreakdown'] ?? {});
    
    return PerformanceScoreModel(
      id: doc.id,
      userId: data['userId'] ?? '',
      totalTasksCompleted: data['totalTasksCompleted'] ?? 0,
      totalTasksAssigned: data['totalTasksAssigned'] ?? 0,
      tasksCompletedOnTime: data['tasksCompletedOnTime'] ?? 0,
      tasksCompletedLate: data['tasksCompletedLate'] ?? 0,
      tasksOverdue: data['tasksOverdue'] ?? 0,
      tasksRejected: data['tasksRejected'] ?? 0,
      tasksReopened: data['tasksReopened'] ?? 0,
      deadlineExtensions: data['deadlineExtensions'] ?? 0,
      consecutiveSuccesses: data['consecutiveSuccesses'] ?? 0,
      bestStreak: data['bestStreak'] ?? 0,
      completedByPriority: {
        'critical': priorityMap['critical'] ?? 0,
        'high': priorityMap['high'] ?? 0,
        'medium': priorityMap['medium'] ?? 0,
        'low': priorityMap['low'] ?? 0,
      },
      avgCompletionHours: (data['avgCompletionHours'] ?? 0.0).toDouble(),
      avgEfficiencyRatio: (data['avgEfficiencyRatio'] ?? 1.0).toDouble(),
      avgPeerReviewScore: (data['avgPeerReviewScore'] ?? 4.0).toDouble(),
      avgManagerReviewScore: (data['avgManagerReviewScore'] ?? 4.0).toDouble(),
      qualityScore: data['qualityScore'] ?? 0,
      dailyActivityDays: data['dailyActivityDays'] ?? 0,
      weeklyCompletionRates: List<int>.from(data['weeklyCompletionRates'] ?? []),
      monthlyCompletionRates: List<int>.from(data['monthlyCompletionRates'] ?? []),
      tasksHelpedOnCount: data['tasksHelpedOnCount'] ?? 0,
      collaborationScore: data['collaborationScore'] ?? 0,
      attendanceDays: data['attendanceDays'] ?? 0,
      attendanceRate: data['attendanceRate'] ?? 0,
      productivityScore: data['productivityScore'] ?? 0,
      reliabilityScore: data['reliabilityScore'] ?? 0,
      efficiencyScore: data['efficiencyScore'] ?? 0,
      overallPerformanceIndex: data['overallPerformanceIndex'] ?? 0,
      totalPenaltyPoints: data['totalPenaltyPoints'] ?? 0,
      penaltyBreakdown: {
        'lateCompletions': penaltyMap['lateCompletions'] ?? 0,
        'deadlineExtensions': penaltyMap['deadlineExtensions'] ?? 0,
        'rejections': penaltyMap['rejections'] ?? 0,
        'reopenings': penaltyMap['reopenings'] ?? 0,
        'missedDeadlines': penaltyMap['missedDeadlines'] ?? 0,
        'inactivity': penaltyMap['inactivity'] ?? 0,
      },
      badges: List<String>.from(data['badges'] ?? []),
      roleId: data['roleId'] ?? '',
      departmentNormalizationFactor: (data['departmentNormalizationFactor'] ?? 1.0).toDouble(),
      lastRecalculatedAt: AppDateUtils.fromTimestamp(data['lastRecalculatedAt']) ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toFirestore() => {
    'userId': userId,
    'totalTasksCompleted': totalTasksCompleted,
    'totalTasksAssigned': totalTasksAssigned,
    'tasksCompletedOnTime': tasksCompletedOnTime,
    'tasksCompletedLate': tasksCompletedLate,
    'tasksOverdue': tasksOverdue,
    'tasksRejected': tasksRejected,
    'tasksReopened': tasksReopened,
    'deadlineExtensions': deadlineExtensions,
    'consecutiveSuccesses': consecutiveSuccesses,
    'bestStreak': bestStreak,
    'completedByPriority': completedByPriority,
    'avgCompletionHours': avgCompletionHours,
    'avgEfficiencyRatio': avgEfficiencyRatio,
    'avgPeerReviewScore': avgPeerReviewScore,
    'avgManagerReviewScore': avgManagerReviewScore,
    'qualityScore': qualityScore,
    'dailyActivityDays': dailyActivityDays,
    'weeklyCompletionRates': weeklyCompletionRates,
    'monthlyCompletionRates': monthlyCompletionRates,
    'tasksHelpedOnCount': tasksHelpedOnCount,
    'collaborationScore': collaborationScore,
    'attendanceDays': attendanceDays,
    'attendanceRate': attendanceRate,
    'productivityScore': productivityScore,
    'reliabilityScore': reliabilityScore,
    'efficiencyScore': efficiencyScore,
    'overallPerformanceIndex': overallPerformanceIndex,
    'totalPenaltyPoints': totalPenaltyPoints,
    'penaltyBreakdown': penaltyBreakdown,
    'badges': badges,
    'roleId': roleId,
    'departmentNormalizationFactor': departmentNormalizationFactor,
    'lastRecalculatedAt': lastRecalculatedAt,
  };
}
