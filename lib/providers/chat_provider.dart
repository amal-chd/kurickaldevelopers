import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/chat_channel_model.dart';
import '../data/models/chat_message_model.dart';
import '../data/repositories/chat_repository.dart';
import 'user_provider.dart';

final chatRepositoryProvider = Provider<ChatRepository>(
  (ref) => ChatRepository(),
);

/// All channels the current user is a member of
final userChannelsProvider = StreamProvider<List<ChatChannelModel>>((ref) {
  final user = ref.watch(currentUserProvider).value;
  if (user == null) return Stream.value([]);
  return ref.watch(chatRepositoryProvider).watchUserChannels(user.uid);
});

/// Watch a specific channel
final channelProvider = StreamProvider.family<ChatChannelModel?, String>((
  ref,
  channelId,
) {
  return ref.watch(chatRepositoryProvider).watchChannel(channelId);
});

/// Messages in a channel (real-time, latest 50)
final channelMessagesProvider =
    StreamProvider.family<List<ChatMessageModel>, String>((ref, channelId) {
      return ref.watch(chatRepositoryProvider).watchMessages(channelId);
    });

/// Total unread message count across all channels for the current user
final totalUnreadChatProvider = StreamProvider<int>((ref) {
  final user = ref.watch(currentUserProvider).value;
  if (user == null) return Stream.value(0);
  return ref.watch(chatRepositoryProvider).watchTotalUnread(user.uid);
});

/// Channels grouped by type for the list screen
final groupedChannelsProvider =
    Provider<Map<ChannelType, List<ChatChannelModel>>>((ref) {
      final channels = ref.watch(userChannelsProvider).value ?? [];
      final map = <ChannelType, List<ChatChannelModel>>{};
      for (final ch in channels) {
        map.putIfAbsent(ch.type, () => []).add(ch);
      }
      return map;
    });

/// Names of users currently typing in a channel (excluding self)
final typingNamesProvider =
    StreamProvider.family<List<String>, ({String channelId, String myUid})>(
      (ref, args) => ref
          .watch(chatRepositoryProvider)
          .watchTypingNames(args.channelId, args.myUid),
    );
