import { useState, useEffect, useCallback } from 'react';
import {
  subscribeChannels,
  subscribeMessages,
  subscribeTyping,
  sendMessage,
  editMessage,
  deleteMessage,
  addReaction,
  removeReaction,
  markChannelRead,
  setTyping,
  clearTyping,
} from '../lib/firestore';
import { ChatChannel, ChatMessage } from '../types';
import { useAuthStore } from '../store/authStore';

// Module-level singleton subscription so multiple components (Sidebar + TopBar +
// ChatPage) share a single Firestore listener instead of each opening their own.
let _channelsCache: ChatChannel[] = [];
let _channelsLoading = true;
let _channelsUnsub: (() => void) | null = null;
let _channelsRefCount = 0;
const _channelsListeners = new Set<() => void>();
let _channelsUid: string | null = null;

function _notifyChannelsListeners() {
  for (const l of _channelsListeners) l();
}

function _startChannelsSub(uid: string) {
  _channelsUid = uid;
  _channelsLoading = true;
  _channelsUnsub = subscribeChannels(uid, (chs) => {
    _channelsCache = chs;
    _channelsLoading = false;
    _notifyChannelsListeners();
  });
}

function _stopChannelsSub() {
  _channelsUnsub?.();
  _channelsUnsub = null;
  _channelsCache = [];
  _channelsLoading = true;
  _channelsUid = null;
}

export function useChannels() {
  const { firebaseUser } = useAuthStore();
  const [, force] = useState(0);

  useEffect(() => {
    if (!firebaseUser) return;
    // Restart if uid changed (sign-out then sign-in as another user).
    if (_channelsUid && _channelsUid !== firebaseUser.uid) _stopChannelsSub();
    if (!_channelsUnsub) _startChannelsSub(firebaseUser.uid);

    _channelsRefCount += 1;
    const listener = () => force((n) => n + 1);
    _channelsListeners.add(listener);

    return () => {
      _channelsListeners.delete(listener);
      _channelsRefCount -= 1;
      if (_channelsRefCount <= 0) _stopChannelsSub();
    };
  }, [firebaseUser]);

  return { channels: _channelsCache, loading: _channelsLoading };
}

export function useMessages(channelId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { firebaseUser } = useAuthStore();

  useEffect(() => {
    if (!channelId) return;
    setLoading(true);
    const unsub = subscribeMessages(channelId, (msgs) => {
      setMessages(msgs);
      setLoading(false);
    });
    return unsub;
  }, [channelId]);

  // Mark channel as read once on channel-switch and again when the tab regains focus.
  // Previously this re-ran on every `messages.length` change, writing to Firestore
  // for every incoming message — wasteful and noisy.
  useEffect(() => {
    if (!channelId || !firebaseUser) return;
    markChannelRead(channelId, firebaseUser.uid).catch(console.error);
    const onFocus = () => {
      markChannelRead(channelId, firebaseUser.uid).catch(console.error);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [channelId, firebaseUser]);

  return { messages, loading };
}

export function useTypingIndicators(channelId: string | null) {
  const [typing, setTyping2] = useState<Record<string, string>>({});
  const { firebaseUser } = useAuthStore();

  useEffect(() => {
    if (!channelId) return;
    const unsub = subscribeTyping(channelId, (t) => {
      const filtered = { ...t };
      if (firebaseUser) delete filtered[firebaseUser.uid];
      setTyping2(filtered);
    });
    return unsub;
  }, [channelId, firebaseUser]);

  return typing;
}

export function useChatActions(channelId: string | null) {
  const { firebaseUser, appUser } = useAuthStore();

  const send = useCallback(
    async (data: Omit<ChatMessage, 'id' | 'createdAt'>) => {
      if (!channelId) return;
      await sendMessage(channelId, data);
    },
    [channelId]
  );

  const edit = useCallback(
    async (messageId: string, text: string) => {
      if (!channelId) return;
      await editMessage(channelId, messageId, text);
    },
    [channelId]
  );

  const del = useCallback(
    async (messageId: string) => {
      if (!channelId) return;
      await deleteMessage(channelId, messageId);
    },
    [channelId]
  );

  const react = useCallback(
    async (messageId: string, emoji: string, hasReacted: boolean) => {
      if (!channelId || !firebaseUser) return;
      if (hasReacted) {
        await removeReaction(channelId, messageId, emoji, firebaseUser.uid);
      } else {
        await addReaction(channelId, messageId, emoji, firebaseUser.uid);
      }
    },
    [channelId, firebaseUser]
  );

  const startTyping = useCallback(async () => {
    if (!channelId || !firebaseUser || !appUser) return;
    await setTyping(channelId, firebaseUser.uid, appUser.name);
  }, [channelId, firebaseUser, appUser]);

  const stopTyping = useCallback(async () => {
    if (!channelId || !firebaseUser) return;
    await clearTyping(channelId, firebaseUser.uid);
  }, [channelId, firebaseUser]);

  return { send, edit, del, react, startTyping, stopTyping };
}
