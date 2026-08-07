import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/utils/date_utils.dart';

enum WeatherCondition { sunny, partlyCloudy, cloudy, rainy, stormy }

extension WeatherConditionX on WeatherCondition {
  String get value => name;

  String get label {
    switch (this) {
      case WeatherCondition.sunny:
        return 'Sunny';
      case WeatherCondition.partlyCloudy:
        return 'Partly Cloudy';
      case WeatherCondition.cloudy:
        return 'Cloudy';
      case WeatherCondition.rainy:
        return 'Rainy';
      case WeatherCondition.stormy:
        return 'Stormy';
    }
  }

  String get emoji {
    switch (this) {
      case WeatherCondition.sunny:
        return '☀️';
      case WeatherCondition.partlyCloudy:
        return '⛅';
      case WeatherCondition.cloudy:
        return '☁️';
      case WeatherCondition.rainy:
        return '🌧️';
      case WeatherCondition.stormy:
        return '⛈️';
    }
  }

  static WeatherCondition fromString(String v) => WeatherCondition.values
      .firstWhere((e) => e.value == v, orElse: () => WeatherCondition.sunny);
}

class SiteDiaryModel {
  final String id;
  final String projectId;
  final String authorId;
  final String date; // 'YYYY-MM-DD'
  final WeatherCondition weather;
  final int workerCount;
  final String progressNotes;
  final String issuesNotes;
  final String safetyNotes;
  final List<String> photoUrls;
  final double? temperature; // Celsius
  final DateTime createdAt;
  final DateTime updatedAt;

  const SiteDiaryModel({
    required this.id,
    required this.projectId,
    required this.authorId,
    required this.date,
    required this.weather,
    required this.workerCount,
    required this.progressNotes,
    this.issuesNotes = '',
    this.safetyNotes = '',
    this.photoUrls = const [],
    this.temperature,
    required this.createdAt,
    required this.updatedAt,
  });

  factory SiteDiaryModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return SiteDiaryModel(
      id: doc.id,
      projectId: data['projectId'] ?? '',
      authorId: data['authorId'] ?? '',
      date: data['date'] ?? '',
      weather: WeatherConditionX.fromString(data['weather'] ?? 'sunny'),
      workerCount: data['workerCount'] ?? 0,
      progressNotes: data['progressNotes'] ?? '',
      issuesNotes: data['issuesNotes'] ?? '',
      safetyNotes: data['safetyNotes'] ?? '',
      photoUrls: List<String>.from(data['photoUrls'] ?? []),
      temperature: (data['temperature'] as num?)?.toDouble(),
      createdAt:
          AppDateUtils.fromTimestamp(data['createdAt']) ?? DateTime.now(),
      updatedAt:
          AppDateUtils.fromTimestamp(data['updatedAt']) ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toFirestore() => {
    'projectId': projectId,
    'authorId': authorId,
    'date': date,
    'weather': weather.value,
    'workerCount': workerCount,
    'progressNotes': progressNotes,
    'issuesNotes': issuesNotes,
    'safetyNotes': safetyNotes,
    'photoUrls': photoUrls,
    'temperature': temperature,
    'createdAt': AppDateUtils.toTimestamp(createdAt),
    'updatedAt': AppDateUtils.toTimestamp(updatedAt),
  };

  SiteDiaryModel copyWith({
    WeatherCondition? weather,
    int? workerCount,
    String? progressNotes,
    String? issuesNotes,
    String? safetyNotes,
    List<String>? photoUrls,
    double? temperature,
  }) {
    return SiteDiaryModel(
      id: id,
      projectId: projectId,
      authorId: authorId,
      date: date,
      weather: weather ?? this.weather,
      workerCount: workerCount ?? this.workerCount,
      progressNotes: progressNotes ?? this.progressNotes,
      issuesNotes: issuesNotes ?? this.issuesNotes,
      safetyNotes: safetyNotes ?? this.safetyNotes,
      photoUrls: photoUrls ?? this.photoUrls,
      temperature: temperature ?? this.temperature,
      createdAt: createdAt,
      updatedAt: DateTime.now(),
    );
  }
}
