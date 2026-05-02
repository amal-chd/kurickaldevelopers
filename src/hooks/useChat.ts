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

export function useChannels() {
  const { firebaseUser } = useAuthStore();
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = subscribeChannels(firebaseUser.uid, (chs) => {
      setChannels(chs);
      setLoading(false);
    });
    return unsub;
  }, [firebaseUser]);

  return { channels, loading };
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

  useEffect(() => {
    if (!channelId || !firebaseUser) return;
    markChannelRead(channelId, firebaseUser.uid).catch(console.error);
  }, [channelId, firebaseUser, messages.length]);

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
