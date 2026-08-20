import { Timestamp } from 'firebase/firestore';
import { getUser } from "./users";

import { supabase } from '../supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { ChatMessage } from '../../types';

const logPermissionError = (actionName: string, error: any, context?: any) => {
  const isPermissionError = error?.code === 'PGRST301' || error?.message?.includes('permission') || error?.message?.includes('denied');
  if (isPermissionError) {
    const { firebaseUser, appUser, permissions } = useAuthStore.getState();
    console.error(`[AUTHORIZATION ERROR] Action: ${actionName} failed with permission-denied.`, {
      errorMessage: error.message,
      errorCode: error.code,
      currentUserUid: firebaseUser?.uid ?? 'not-authenticated',
      currentUserRole: appUser?.roleId ?? 'no-role-assigned',
      userPermissions: permissions,
      context,
    });
  } else {
    console.warn(`[API ERROR] Action: ${actionName} failed.`, error, context);
  }
};

const mapMessageFromDB = (data: any): ChatMessage => {
  return {
    id: data.id,
    senderId: data.sender_id,
    type: data.type || 'text',
    text: data.text,
    replyToId: data.reply_to_id,
    replyToText: data.reply_to_text,
    replyToSenderName: data.reply_to_sender_name,
    reactions: typeof data.reactions === 'string' ? JSON.parse(data.reactions) : (data.reactions || {}),
    mentionedUserIds: data.mentioned_user_ids || [],
    taskId: data.task_id,
    taskTitle: data.task_title,
    taskStatus: data.task_status,
    attachmentUrl: data.attachment_url || data.file_url,
    attachmentName: data.attachment_name || data.file_name,
    attachmentSize: data.attachment_size,
    attachmentBucket: data.attachment_bucket,
    attachmentPath: data.attachment_path,
    isDeleted: data.is_deleted || false,
    createdAt: data.created_at ? Timestamp.fromDate(new Date(data.created_at)) : undefined as any,
    editedAt: data.edited_at ? Timestamp.fromDate(new Date(data.edited_at)) : undefined,
  };
};

export const subscribeMessages = (
  channelId: string,
  cb: (messages: ChatMessage[]) => void,
  msgLimit = 100
) => {
  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(msgLimit);
    
    if (!error && data) {
      cb(data.map(mapMessageFromDB).reverse());
    }
  };

  fetchMessages();

  const channel = supabase.channel(`messages_${channelId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${channelId}` }, () => {
      fetchMessages();
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
};

export const sendMessage = async (channelId: string, data: Partial<ChatMessage> & { attachmentUrl?: string, attachmentName?: string }): Promise<string> => {
  const msgPayload = {
    channel_id: channelId,
    sender_id: data.senderId,
    type: data.type,
    text: data.text,
    file_url: data.attachmentUrl || data.attachmentUrl,
    file_name: data.attachmentName || data.attachmentName,
    file_size: 0 || 0,
    is_deleted: data.isDeleted || false,
    reactions: data.reactions || {},
    created_at: new Date().toISOString(),
  };

  const { data: msgRes, error: msgError } = await supabase.from('chat_messages').insert(msgPayload).select('id').single();
  if (msgError) {
    logPermissionError('sendMessage', msgError);
    throw msgError;
  }

  const msgId = msgRes.id;

  // Get channel details
  const { data: channelData } = await supabase.from('chat_channels').select('*').eq('id', channelId).single();
  
  if (channelData) {
    const channelType = channelData.type ?? '';
    const channelName = channelData.name ?? 'Group';
    const memberIds: string[] = channelData.member_ids ?? [];

    const newUnreadCounts = { ...(channelData.unread_counts || {}) };
    memberIds.forEach((uid) => {
      if (uid !== data.senderId) {
        newUnreadCounts[uid] = (newUnreadCounts[uid] || 0) + 1;
      }
    });

    await supabase.from('chat_channels').update({
      last_message_text: data.isDeleted ? '' : (data.text && data.text.length > 80 ? data.text.slice(0, 80) + '…' : data.text),
      last_message_at: new Date().toISOString(),
      last_message_by: data.senderId,
      unread_counts: newUnreadCounts,
    }).eq('id', channelId);

    // Notifications
    if (channelType === 'announcement') {
      let senderName = 'Someone';
      const senderData = await getUser(data.senderId || '');
      if (senderData) {
        senderName = senderData.name || senderData.email || 'Someone';
      }

      let bodyText = data.text || '';
      if (data.type === 'image') bodyText = '📷 Photo';
      else if (data.type === 'file') bodyText = '📎 File';
      else if (data.type === 'task_ref') bodyText = '📌 Task Reference';

      const truncatedBody = bodyText.length > 150 ? bodyText.slice(0, 150) + '…' : bodyText;

      const notifsToInsert = [];
      for (const uid of memberIds) {
        if (uid === data.senderId) continue;
        const userData = await getUser(uid);
        if (userData?.preferences?.announcements === false) continue;
        
        notifsToInsert.push({
          user_id: uid,
          type: 'announcement',
          title: `Announcement in ${channelName}`,
          body: `${senderName}: ${truncatedBody}`,
          related_id: channelId,
          related_type: 'chat',
          is_read: {},
          created_at: new Date().toISOString(),
        });
      }
      if (notifsToInsert.length > 0) {
        await supabase.from('app_notifications').insert(notifsToInsert);
      }
    }
  }

  return msgId;
};

export const editMessage = async (messageId: string, text: string): Promise<void> => {
  await supabase.from('chat_messages').update({
    text,
    edited_at: new Date().toISOString(),
  }).eq('id', messageId);
};

export const deleteMessage = async (channelId: string, messageId: string): Promise<void> => {
  await supabase.from('chat_messages').update({
    is_deleted: true,
    text: 'This message was deleted',
  }).eq('id', messageId);
  await syncChannelPreview(channelId);
};

export const syncChannelPreview = async (channelId: string): Promise<void> => {
  const { data } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })
    .limit(20);
    
  const lastVisible = data?.find((m) => !m.is_deleted);

  if (!lastVisible) {
    await supabase.from('chat_channels').update({
      last_message_text: '',
      last_message_by: '',
    }).eq('id', channelId);
    return;
  }

  const text = lastVisible.text.length > 80
    ? lastVisible.text.slice(0, 80) + '…'
    : lastVisible.text;
    
  await supabase.from('chat_channels').update({
    last_message_text: text,
    last_message_by: lastVisible.sender_id,
  }).eq('id', channelId);
};

export const addReaction = async (
  messageId: string,
  emoji: string,
  userId: string
): Promise<void> => {
  const { data: msg } = await supabase.from('chat_messages').select('reactions').eq('id', messageId).single();
  if (!msg) return;
  const reactions = msg.reactions || {};
  if (!reactions[emoji]) reactions[emoji] = [];
  if (!reactions[emoji].includes(userId)) {
    reactions[emoji].push(userId);
    await supabase.from('chat_messages').update({ reactions }).eq('id', messageId);
  }
};

export const removeReaction = async (
  messageId: string,
  emoji: string,
  userId: string
): Promise<void> => {
  const { data: msg } = await supabase.from('chat_messages').select('reactions').eq('id', messageId).single();
  if (!msg) return;
  const reactions = msg.reactions || {};
  if (reactions[emoji]) {
    reactions[emoji] = reactions[emoji].filter((id: string) => id !== userId);
    if (reactions[emoji].length === 0) delete reactions[emoji];
    await supabase.from('chat_messages').update({ reactions }).eq('id', messageId);
  }
};

export const markChannelAsRead = async (channelId: string, userId: string): Promise<void> => {
  const { data: channelData } = await supabase.from('chat_channels').select('unread_counts, last_read_at').eq('id', channelId).single();
  if (channelData) {
    const unread_counts = { ...(channelData.unread_counts || {}) };
    const last_read_at = { ...(channelData.last_read_at || {}) };
    unread_counts[userId] = 0;
    last_read_at[userId] = new Date().toISOString();
    
    await supabase.from('chat_channels').update({
      unread_counts,
      last_read_at,
    }).eq('id', channelId);
  }
};

export const setTypingStatus = async (channelId: string, userId: string, name: string): Promise<void> => {
  await supabase.from('chat_typing').upsert({
    channel_id: channelId,
    user_id: userId,
    name,
    at: new Date().toISOString(),
  });
};

export const clearTypingStatus = async (channelId: string, userId: string): Promise<void> => {
  await supabase.from('chat_typing').delete().eq('channel_id', channelId).eq('user_id', userId);
};

export const subscribeTyping = (channelId: string, cb: (typing: Record<string, string>) => void) => {
  const fetchTyping = async () => {
    const { data } = await supabase.from('chat_typing').select('*').eq('channel_id', channelId);
    const now = Date.now();
    const result: Record<string, string> = {};
    if (data) {
      data.forEach((d: any) => {
        const at = new Date(d.at).getTime();
        if (now - at < 10000) {
          result[d.user_id] = d.name;
        }
      });
    }
    cb(result);
  };

  fetchTyping();
  const interval = setInterval(fetchTyping, 5000); // Check expiration periodically

  const channel = supabase.channel(`typing_${channelId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_typing', filter: `channel_id=eq.${channelId}` }, () => {
      fetchTyping();
    })
    .subscribe();

  return () => { 
    clearInterval(interval);
    supabase.removeChannel(channel); 
  };
};
