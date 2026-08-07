import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:rxdart/rxdart.dart';
import '../models/notification_model.dart';
import '../../core/utils/error_translator.dart';

class NotificationRepository {
  final _db = FirebaseFirestore.instance;

  CollectionReference get _notifs => _db.collection('notifications');

  Stream<List<NotificationModel>> watchUserNotifications(String userId, [int attempt = 0]) async* {
    try {
      final targeted = _notifs
          .where('userId', isEqualTo: userId)
          .limit(50)
          .snapshots();

      final broadcast = _notifs
          .where('userId', isEqualTo: '')
          .limit(20)
          .snapshots();

      final combinedStream = Rx.combineLatest2<QuerySnapshot, QuerySnapshot,
          List<NotificationModel>>(
        targeted,
        broadcast,
        (t, b) {
          final list = [
            ...t.docs.map((d) => NotificationModel.fromFirestore(d, userId)),
            ...b.docs.map((d) => NotificationModel.fromFirestore(d, userId)),
          ];
          list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
          return list.take(50).toList();
        },
      );

      await for (final list in combinedStream) {
        yield list;
      }
    } on FirebaseException catch (e) {
      if ((e.code == 'permission-denied' || e.code == 'unavailable') && attempt < 5) {
        await Future.delayed(Duration(milliseconds: 500 * (attempt + 1)));
        yield* watchUserNotifications(userId, attempt + 1);
      } else {
        throw ErrorTranslator.translate(e);
      }
    } catch (e) {
      if (e is FirebaseException) {
        if ((e.code == 'permission-denied' || e.code == 'unavailable') && attempt < 5) {
          await Future.delayed(Duration(milliseconds: 500 * (attempt + 1)));
          yield* watchUserNotifications(userId, attempt + 1);
          return;
        }
      }
      throw ErrorTranslator.translate(e);
    }
  }

  /// Fetch older notifications for infinite scroll.
  Future<List<NotificationModel>> fetchMoreNotifications(
    String userId, {
    int pageSize = 30,
    DocumentSnapshot? lastDocument,
  }) async {
    try {
      Query query = _notifs
          .where('userId', isEqualTo: userId)
          .limit(pageSize);
      if (lastDocument != null) {
        query = query.startAfterDocument(lastDocument);
      }
      final snap = await query.get();
      final list = snap.docs
          .map((d) => NotificationModel.fromFirestore(d, userId))
          .toList();
      list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      return list;
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  /// Mark a single notification read for [uid] (per-user read map).
  Future<void> markAsRead(String notifId, String uid) async {
    try {
      await _notifs.doc(notifId).update({'isRead.$uid': true});
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> markAllAsRead(String userId) async {
    try {
      final batch = _db.batch();
      // 1. Mark all targeted notifications as read
      final targetedSnap = await _notifs
          .where('userId', isEqualTo: userId)
          .get();
      for (final doc in targetedSnap.docs) {
        batch.update(doc.reference, {'isRead.$userId': true});
      }

      // 2. Mark all broadcast notifications as read for this user
      final broadcastSnap = await _notifs
          .where('userId', isEqualTo: '')
          .get();
      for (final doc in broadcastSnap.docs) {
        batch.update(doc.reference, {'isRead.$userId': true});
      }

      await batch.commit();
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  /// Create a targeted in-app notification. [userId] '' makes it a broadcast.
  Future<void> createNotification({
    required String userId,
    required NotificationType type,
    required String title,
    required String body,
    String relatedId = '',
    String relatedType = '',
  }) async {
    try {
      await _notifs.add({
        'userId': userId,
        'type': type.value,
        'title': title,
        'body': body,
        'relatedId': relatedId,
        'relatedType': relatedType,
        'isRead': <String, bool>{},
        'createdAt': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> deleteNotification(String notifId) async {
    try {
      await _notifs.doc(notifId).delete();
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }
}
