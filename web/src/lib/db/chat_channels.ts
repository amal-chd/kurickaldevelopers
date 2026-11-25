import { Timestamp } from 'firebase/firestore';
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { ChatChannel } from '../../types';

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

const mapChannelFromDB = (data: any): ChatChannel => {
  return {
    id: data.id,
    type: data.type,
    name: data.name,
    createdBy: data.created_by,
    memberIds: data.member_ids || [],
    adminIds: data.admin_ids || [],
    lastMessageText: data.last_message_text,
    lastMessageAt: data.last_message_at ? Timestamp.fromDate(new Date(data.last_message_at)) : undefined as any,
    lastMessageBy: data.last_message_by,
    unreadCounts: data.unread_counts || {},
    lastReadAt: typeof data.last_read_at === 'string' ? JSON.parse(data.last_read_at) : (data.last_read_at || {}),
    isArchived: data.is_archived || false,
  };
};

export const subscribeChannels = (userId: string, cb: (channels: ChatChannel[]) => void) => {
  const buckets: Record<'mine' | 'announce', ChatChannel[]> = { mine: [], announce: [] };
  
  const emit = () => {
    const byId = new Map<string, ChatChannel>();
    [...buckets.mine, ...buckets.announce].forEach((c) => byId.set(c.id, c));
    const channels = Array.from(byId.values()).sort((a, b) => {
      const at = (a.lastMessageAt as any)?.toMillis?.() ?? 0;
      const bt = (b.lastMessageAt as any)?.toMillis?.() ?? 0;
      return bt - at;
    });
    cb(channels);
  };

  const fetchMine = async () => {
    const { data, error } = await supabase
      .from('chat_channels')
      .select('*')
      .contains('member_ids', [userId]);
    if (error) {
      console.warn('subscribeChannels(mine) error:', error.message);
      buckets.mine = [];
    } else {
      buckets.mine = data.map(mapChannelFromDB);
    }
    emit();
  };

  const fetchAnnounce = async () => {
    const { data, error } = await supabase
      .from('chat_channels')
      .select('*')
      .eq('type', 'announcement');
    if (error) {
      console.warn('subscribeChannels(announce) error:', error.message);
      buckets.announce = [];
    } else {
      buckets.announce = data.map(mapChannelFromDB);
    }
    emit();
  };

  fetchMine();
  fetchAnnounce();

  const channel = supabase.channel(`chats_changes_${Date.now()}_${Math.floor(Math.random() * 1e6)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_channels' }, () => {
      fetchMine();
      fetchAnnounce();
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
};

export const getChannel = async (channelId: string): Promise<ChatChannel | null> => {
  try {
    // maybeSingle: a missing channel is a normal "not found", not a 406 error.
    const { data, error } = await supabase.from('chat_channels').select('*').eq('id', channelId).maybeSingle();
    if (error || !data) return null;
    return mapChannelFromDB(data);
  } catch (err: any) {
    console.warn('Gracefully handled getChannel error:', err);
    return null;
  }
};

export const createChannel = async (data: Omit<ChatChannel, 'id'>): Promise<string> => {
  const channelId = crypto.randomUUID();
  const payload = {
    id: channelId,
    type: data.type,
    name: data.name,
    created_by: data.createdBy,
    member_ids: data.memberIds || [],
    admin_ids: data.adminIds || [],
    last_message_text: data.lastMessageText || '',
    last_message_at: data.lastMessageAt ? (data.lastMessageAt as any).toDate().toISOString() : undefined as any,
    last_message_by: data.lastMessageBy || '',
    unread_counts: data.unreadCounts || {},
    last_read_at: data.lastReadAt || {},
    is_archived: data.isArchived || false,
  };
  const { error } = await supabase.from('chat_channels').insert(payload);
  if (error) throw error;
  return channelId;
};

export const createChannelWithId = async (id: string, data: Omit<ChatChannel, 'id'>): Promise<void> => {
  const payload = {
    id,
    type: data.type,
    name: data.name,
    created_by: data.createdBy,
    member_ids: data.memberIds || [],
    admin_ids: data.adminIds || [],
    last_message_text: data.lastMessageText || '',
    last_message_at: data.lastMessageAt ? (data.lastMessageAt as any).toDate().toISOString() : undefined as any,
    last_message_by: data.lastMessageBy || '',
    unread_counts: data.unreadCounts || {},
    last_read_at: data.lastReadAt || {},
    is_archived: data.isArchived || false,
  };
  const { error } = await supabase.from('chat_channels').upsert(payload);
  if (error) throw error;
};

export const updateChannel = async (id: string, data: Partial<ChatChannel>): Promise<void> => {
  const payload: any = {};
  if (data.type !== undefined) payload.type = data.type;
  if (data.name !== undefined) payload.name = data.name;
  if (data.createdBy !== undefined) payload.created_by = data.createdBy;
  if (data.memberIds !== undefined) payload.member_ids = data.memberIds;
  if (data.adminIds !== undefined) payload.admin_ids = data.adminIds;
  if (data.lastMessageText !== undefined) payload.last_message_text = data.lastMessageText;
  if (data.lastMessageAt !== undefined) payload.last_message_at = data.lastMessageAt ? (data.lastMessageAt as any).toDate().toISOString() : undefined as any;
  if (data.lastMessageBy !== undefined) payload.last_message_by = data.lastMessageBy;
  if (data.unreadCounts !== undefined) payload.unread_counts = data.unreadCounts;
  if (data.lastReadAt !== undefined) payload.last_read_at = data.lastReadAt;
  if (data.isArchived !== undefined) payload.is_archived = data.isArchived;

  const { error } = await supabase.from('chat_channels').update(payload).eq('id', id);
  if (error) throw error;
};

export const projectChannelId = (projectId: string) => `project_${projectId}`;

export const syncProjectChannel = async (
  projectId: string,
  projectName: string,
  memberIds: string[],
  projectManagerId: string,
): Promise<void> => {
  const id = projectChannelId(projectId);
  const members = Array.from(new Set([...memberIds, projectManagerId].filter(Boolean)));
  const existing = await getChannel(id);
  if (existing) {
    await updateChannel(id, { name: projectName, memberIds: members });
  } else {
    await createChannelWithId(id, {
      type: 'project',
      name: projectName,
      createdBy: projectManagerId,
      memberIds: members,
      adminIds: projectManagerId ? [projectManagerId] : [],
      lastMessageText: 'Project channel created',
      lastMessageBy: '',
      unreadCounts: {},
      lastReadAt: {},
      isArchived: false,
    });
  }
};

export const archiveChannel = async (id: string): Promise<void> => {
  await updateChannel(id, { isArchived: true });
};
