import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Send, Plus, Search, MessageSquare, Smile, CornerUpLeft, Edit2, Trash2,
  Copy, ChevronLeft, Megaphone, Users, User, Hash, CheckCheck, X, CheckSquare, Lock, Info,
} from 'lucide-react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import EmptyState from '../../components/ui/EmptyState';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import { useChannels, useMessages, useTypingIndicators, useChatActions } from '../../hooks/useChat';
import {
  subscribeUsers, getChannel, createChannelWithId, getTasks,
  createChannel, archiveChannel,
} from '../../lib/firestore';
import { uploadToSupabase, STORAGE_BUCKETS } from '../../lib/storage';
import { Paperclip } from 'lucide-react';
import { ChatChannel, ChatMessage, AppUser, Task, ChannelType } from '../../types';
import { getDmChannelId, formatRelative } from '../../lib/utils';
import toast from 'react-hot-toast';

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '✅'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function DaySeparator({ date }: { date: Date }) {
  let label: string;
  if (isToday(date)) label = 'Today';
  else if (isYesterday(date)) label = 'Yesterday';
  else label = format(date, 'EEEE, MMMM d');

  return (
    <div className="flex items-center gap-3 my-3 px-4">
      <div className="flex-1 h-px bg-slate-300/50" />
      <span className="text-xs text-slate-500 font-medium px-2 py-0.5 bg-white rounded-full shadow-sm">
        {label}
      </span>
      <div className="flex-1 h-px bg-slate-300/50" />
    </div>
  );
}

function channelTypeOrder(type: ChannelType): number {
  const order: Record<ChannelType, number> = {
    announcement: 0,
    project: 1,
    group: 2,
    direct: 3,
  };
  return order[type] ?? 99;
}

// ─── ChannelItem ──────────────────────────────────────────────────────────────

const ChannelItem: React.FC<{
  channel: ChatChannel;
  selected: boolean;
  onClick: () => void;
  currentUserId: string;
  users: AppUser[];
}> = ({ channel, selected, onClick, currentUserId, users }) => {
  const unread = channel.unreadCounts?.[currentUserId] ?? 0;
  const otherUserId =
    channel.type === 'direct'
      ? channel.memberIds.find((id) => id !== currentUserId)
      : null;
  const otherUser = otherUserId ? users.find((u) => u.id === otherUserId) : null;
  const displayName =
    channel.type === 'direct' && otherUser ? (otherUser.name || otherUser.email || 'Direct Message') : channel.name;

  const iconByType: Record<ChannelType, React.ReactNode> = {
    announcement: <Megaphone className="w-4 h-4 text-amber-500" />,
    project: <Hash className="w-4 h-4 text-blue-500" />,
    group: <Users className="w-4 h-4 text-violet-500" />,
    direct: otherUser ? (
      <Avatar name={otherUser.name || otherUser.email || '?'} src={otherUser.avatarUrl} size="sm" />
    ) : (
      <User className="w-4 h-4 text-slate-400" />
    ),
  };

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${
        selected ? 'bg-primary/10' : 'hover:bg-slate-100'
      }`}
    >
      <div
        className={`flex-shrink-0 ${
          channel.type !== 'direct'
            ? 'w-8 h-8 rounded-xl flex items-center justify-center bg-slate-50 border border-slate-100'
            : ''
        }`}
      >
        {iconByType[channel.type]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p
            className={`text-sm font-medium truncate ${
              selected ? 'text-primary' : 'text-slate-900'
            }`}
          >
            {displayName}
          </p>
          {channel.lastMessageAt && (
            <p className="text-xs text-slate-400 flex-shrink-0">
              {formatRelative(channel.lastMessageAt)}
            </p>
          )}
        </div>
        {channel.lastMessageText && (
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {channel.lastMessageText}
          </p>
        )}
      </div>
      {unread > 0 && (
        <span className="flex-shrink-0 bg-primary text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
};

// ─── MessageBubble ────────────────────────────────────────────────────────────

const MessageBubble: React.FC<{
  message: ChatMessage;
  isOwn: boolean;
  senderName: string;
  senderAvatar?: string;
  showAvatar: boolean;
  canModerate: boolean;
  onReply: (msg: ChatMessage) => void;
  onReact: (msgId: string, emoji: string) => void;
  onEdit: (msg: ChatMessage) => void;
  onDelete: (msgId: string) => void;
  onCopy: (text: string) => void;
  currentUserId: string;
  onTaskClick?: (taskId: string) => void;
}> = ({
  message,
  isOwn,
  senderName,
  senderAvatar,
  showAvatar,
  canModerate,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onCopy,
  currentUserId,
  onTaskClick,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);

  if (message.isDeleted) {
    return (
      <div
        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} px-4 mb-1`}
      >
        <p className="text-xs text-slate-400 italic px-3 py-1.5 bg-slate-100 rounded-xl">
          This message was deleted
        </p>
      </div>
    );
  }

  if (message.type === 'system') {
    return (
      <div className="flex justify-center px-4 my-1">
        <p className="text-xs text-slate-500 bg-white/60 rounded-full px-3 py-1">
          {message.text}
        </p>
      </div>
    );
  }

  const reactions = message.reactions ?? {};
  const hasReactions = Object.keys(reactions).some(
    (e) => reactions[e].length > 0
  );

  const canDelete = isOwn || canModerate;
  const canEdit = isOwn;

  return (
    <div
      className={`flex gap-2 px-4 mb-0.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowEmoji(false);
      }}
    >
      {/* Avatar column for others */}
      {!isOwn && (
        <div className="w-8 flex-shrink-0 self-end">
          {showAvatar && (
            <Avatar name={senderName} src={senderAvatar} size="sm" />
          )}
        </div>
      )}

      <div
        className={`flex flex-col max-w-xs sm:max-w-md lg:max-w-lg ${
          isOwn ? 'items-end' : 'items-start'
        }`}
      >
        {/* Sender name */}
        {!isOwn && showAvatar && (
          <p className="text-xs font-semibold text-slate-600 mb-1 ml-1">
            {senderName}
          </p>
        )}

        {/* Reply preview */}
        {message.replyToId && (
          <div
            className={`text-xs rounded-lg px-2 py-1 mb-1 border-l-2 ${
              isOwn
                ? 'border-white/50 bg-white/30 text-white/80'
                : 'border-primary/50 bg-slate-100 text-slate-500'
            }`}
          >
            <p className="font-medium">{message.replyToSenderName}</p>
            <p className="truncate max-w-[160px]">{message.replyToText}</p>
          </div>
        )}

        {/* Task ref card */}
        {message.type === 'task_ref' && message.taskId && (
          <div
            className="bg-white border border-slate-200 rounded-xl p-3 mb-1 cursor-pointer hover:shadow-md transition-shadow w-64"
            onClick={() => onTaskClick?.(message.taskId!)}
          >
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-primary flex-shrink-0" />
              <p className="text-sm font-semibold text-slate-900 truncate">
                {message.taskTitle}
              </p>
            </div>
            {message.taskStatus && (
              <span className="text-xs text-slate-500 mt-1 block capitalize">
                Status: {message.taskStatus}
              </span>
            )}
          </div>
        )}

        {/* Bubble */}
        <div
          className={`relative px-3 py-2 rounded-2xl text-sm shadow-sm ${
            isOwn
              ? 'bg-primary text-white rounded-br-sm'
              : 'bg-white text-slate-900 rounded-bl-sm'
          }`}
        >
          {/* Image attachment */}
          {message.attachmentUrl && message.type === 'image' && (
            <a href={message.attachmentUrl} target="_blank" rel="noopener noreferrer" className="block mb-1">
              <img
                src={message.attachmentUrl}
                alt={message.attachmentName ?? 'image'}
                className="rounded-xl max-h-64 max-w-full object-cover"
                loading="lazy"
              />
            </a>
          )}
          {/* File attachment */}
          {message.attachmentUrl && message.type === 'file' && (
            <a
              href={message.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 mb-1 rounded-xl px-2.5 py-2 transition-colors ${
                isOwn ? 'bg-white/15 hover:bg-white/25' : 'bg-slate-50 border border-slate-100 hover:bg-slate-100'
              }`}
            >
              <Paperclip className="w-4 h-4 flex-shrink-0" />
              <span className="truncate text-xs font-medium max-w-[180px]">
                {message.attachmentName ?? 'Download file'}
              </span>
            </a>
          )}
          {!message.attachmentUrl && (
            <p className="whitespace-pre-wrap break-words">{message.text}</p>
          )}
          <div
            className={`flex items-center gap-1 mt-0.5 ${
              isOwn ? 'justify-end' : 'justify-start'
            }`}
          >
            <p
              className={`text-xs ${
                isOwn ? 'text-white/60' : 'text-slate-400'
              }`}
            >
              {message.createdAt
                ? format(message.createdAt.toDate(), 'h:mm a')
                : ''}
            </p>
            {message.editedAt && (
              <p
                className={`text-xs ${
                  isOwn ? 'text-white/50' : 'text-slate-400'
                }`}
              >
                (edited)
              </p>
            )}
            {isOwn && <CheckCheck className="w-3 h-3 text-white/60" />}
          </div>
        </div>

        {/* Reactions */}
        {hasReactions && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(reactions)
              .filter(([, uids]) => uids.length > 0)
              .map(([emoji, uids]) => (
                <button
                  key={emoji}
                  onClick={() => onReact(message.id, emoji)}
                  className={`text-xs rounded-full px-2 py-0.5 border flex items-center gap-0.5 transition-colors ${
                    uids.includes(currentUserId)
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {emoji} {uids.length}
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Hover action toolbar */}
      {showActions && (
        <div
          className={`self-center flex items-center gap-0.5 ${
            isOwn ? 'mr-1' : 'ml-1'
          }`}
        >
          {/* Emoji picker trigger */}
          <div className="relative">
            <button
              className="p-1 rounded-lg bg-white shadow-sm text-slate-500 hover:text-slate-700 border border-slate-100"
              onClick={() => setShowEmoji(!showEmoji)}
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
            {showEmoji && (
              <div
                className={`absolute ${
                  isOwn ? 'right-0' : 'left-0'
                } bottom-full mb-1 bg-white rounded-xl shadow-lg border border-slate-100 p-2 flex gap-1 z-20`}
              >
                {EMOJI_LIST.map((e) => (
                  <button
                    key={e}
                    className="text-lg hover:scale-125 transition-transform"
                    onClick={() => {
                      onReact(message.id, e);
                      setShowEmoji(false);
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className="p-1 rounded-lg bg-white shadow-sm text-slate-500 hover:text-slate-700 border border-slate-100"
            onClick={() => onReply(message)}
          >
            <CornerUpLeft className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1 rounded-lg bg-white shadow-sm text-slate-500 hover:text-slate-700 border border-slate-100"
            onClick={() => onCopy(message.text)}
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          {canEdit && (
            <button
              className="p-1 rounded-lg bg-white shadow-sm text-slate-500 hover:text-slate-700 border border-slate-100"
              onClick={() => onEdit(message)}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          {canDelete && (
            <button
              className="p-1 rounded-lg bg-white shadow-sm text-red-400 hover:text-red-600 border border-slate-100"
              onClick={() => onDelete(message.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ─── ChatPage ─────────────────────────────────────────────────────────────────

const ChatPage: React.FC = () => {
  const { channelId } = useParams<{ channelId?: string }>();
  const navigate = useNavigate();
  const { appUser } = useAuthStore();
  const { can } = usePermissions();
  const { channels } = useChannels();
  const { messages, loading: msgLoading } = useMessages(channelId ?? null);
  const typing = useTypingIndicators(channelId ?? null);
  const { send, edit, del, react, startTyping, stopTyping } = useChatActions(
    channelId ?? null
  );

  // Users: realtime subscription
  const [users, setUsers] = useState<AppUser[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editMsg, setEditMsg] = useState<ChatMessage | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMention, setShowMention] = useState(false);
  const [showShareTask, setShowShareTask] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [newGroupModal, setNewGroupModal] = useState(false);
  const [newDmModal, setNewDmModal] = useState(false);
  const [dmSearch, setDmSearch] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [groupSearch, setGroupSearch] = useState('');
  const [channelInfoModal, setChannelInfoModal] = useState(false);
  const [search, setSearch] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attaching, setAttaching] = useState(false);
  const typingTimeout = useRef<number | null>(null);

  const currentChannel = channels.find((c) => c.id === channelId);

  // Permissions
  const chatView = can('chat_view');
  const chatSend = can('chat_send');
  const chatAnnounce = can('chat_announce');
  const chatCreateGroup = can('chat_create_group');
  const chatModerate = can('chat_moderate');
  const tasksView = can('tasks_view');

  const isAnnouncement = currentChannel?.type === 'announcement';
  const isMember = currentChannel?.memberIds?.includes(appUser?.id ?? '') ?? false;
  // Project and direct channels are open to their members regardless of the
  // global chat_send permission — mirrors the Firestore rules. Announcements
  // still require chat_announce.
  const memberCanPost =
    isMember &&
    (currentChannel?.type === 'project' || currentChannel?.type === 'direct');
  const canSend = isAnnouncement
    ? chatSend && chatAnnounce
    : chatSend || memberCanPost;

  // ─── Data loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    const unsub = subscribeUsers((u) => setUsers(u));
    return unsub;
  }, []);

  useEffect(() => {
    if (!tasksView) return;
    getTasks().then(setTasks).catch(console.error);
  }, [tasksView]);

  // ─── Auto-scroll on new messages ──────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ─── Populate text when editing ──────────────────────────────────────────

  useEffect(() => {
    if (editMsg) {
      setText(editMsg.text);
      textareaRef.current?.focus();
    } else {
      setText('');
    }
  }, [editMsg]);

  // ─── Cleanup typing on unmount ────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      stopTyping();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const getUserById = useCallback(
    (uid: string) => users.find((u) => u.id === uid),
    [users]
  );

  const activeOtherUsers = users.filter(
    (u) => u.isActive && u.id !== appUser?.id
  );

  // Channels filtered by search, then sorted by type order then lastMessageAt
  const filteredChannels = channels
    // Hide archived (deleted) conversations entirely.
    .filter((ch) => !ch.isArchived)
    // Hide conversations with no real content — last message deleted or never
    // sent. Keeps "Message deleted" / empty rows out of the chat list.
    // Direct message channels are always shown if started (document exists).
    .filter((ch) => {
      if (ch.type === 'direct') return true;
      const t = (ch.lastMessageText ?? '').trim()?.toLowerCase();
      return t !== '' && t !== 'message deleted' && t !== 'this message was deleted';
    })
    .filter((ch) => {
      if (!search) return true;
      const otherUser = ch.type === 'direct' ? getUserById(ch.memberIds.find((id) => id !== appUser?.id) ?? '') : null;
      const name = ch.type === 'direct' ? (otherUser?.name || otherUser?.email || '') : ch.name;
      return name?.toLowerCase().includes(search?.toLowerCase());
    })
    .sort((a, b) => {
      const typeOrder = channelTypeOrder(a.type) - channelTypeOrder(b.type);
      if (typeOrder !== 0) return typeOrder;
      const at = (a.lastMessageAt as any)?.toMillis?.() ?? 0;
      const bt = (b.lastMessageAt as any)?.toMillis?.() ?? 0;
      return bt - at;
    });

  // Group by type for section headers
  const channelSections: { label: string; type: ChannelType }[] = [
    { label: 'Announcements', type: 'announcement' },
    { label: 'Project Channels', type: 'project' },
    { label: 'Groups', type: 'group' },
    { label: 'Direct Messages', type: 'direct' },
  ];

  // ─── Event handlers ───────────────────────────────────────────────────────

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    // Mention detection
    const lastAt = val.lastIndexOf('@');
    if (lastAt !== -1 && val.slice(lastAt).match(/^@\w*$/)) {
      setShowMention(true);
      setMentionQuery(val.slice(lastAt + 1));
    } else {
      setShowMention(false);
    }

    // Typing indicator
    startTyping();
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = window.setTimeout(() => stopTyping(), 3000);
  };

  const insertMention = (user: AppUser) => {
    const lastAt = text.lastIndexOf('@');
    setText(text.slice(0, lastAt) + `@${user.name || user.email || 'User'} `);
    setShowMention(false);
    textareaRef.current?.focus();
  };

  const cancelEditReply = () => {
    setReplyTo(null);
    setEditMsg(null);
    setText('');
  };

  const handleSend = async () => {
    if (!text.trim() || !appUser || !channelId) return;
    const msgText = text.trim();
    setText('');
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    stopTyping();

    if (editMsg) {
      await edit(editMsg.id, msgText);
      setEditMsg(null);
      return;
    }

    const mentionedUserIds = users
      .filter((u) => msgText.includes(`@${u.name || u.email || 'User'}`))
      .map((u) => u.id);

    setReplyTo(null);
    await send({
      senderId: appUser.id,
      text: msgText,
      type: 'text',
      replyToId: replyTo?.id,
      replyToText: replyTo?.text,
      replyToSenderName: replyTo
        ? (getUserById(replyTo.senderId)?.name || getUserById(replyTo.senderId)?.email || 'Unknown')
        : undefined,
      reactions: {},
      mentionedUserIds,
      isDeleted: false,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      cancelEditReply();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Upload a file to Supabase Storage (chat-files bucket) and send it as a
  // message. Images render inline; everything else shows a download chip.
  const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file || !appUser || !channelId) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error('File too large (max 25 MB).');
      return;
    }
    setAttaching(true);
    try {
      const { url, path, bucket } = await uploadToSupabase(
        file,
        STORAGE_BUCKETS.chatFiles,
        channelId,
      );
      const isImage = (file.type || '').startsWith('image/');
      await send({
        senderId: appUser.id,
        // Used as the channel-list preview; the bubble renders the image/chip.
        text: isImage ? '📷 Photo' : `📎 ${file.name}`,
        type: isImage ? 'image' : 'file',
        reactions: {},
        mentionedUserIds: [],
        isDeleted: false,
        attachmentUrl: url,
        attachmentName: file.name,
        attachmentSize: file.size,
        attachmentBucket: bucket,
        attachmentPath: path,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setAttaching(false);
    }
  };

  const handleReact = async (msgId: string, emoji: string) => {
    if (!appUser) return;
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;
    const hasReacted = msg.reactions?.[emoji]?.includes(appUser.id);
    await react(msgId, emoji, !!hasReacted);
  };

  const handleCopy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success('Copied');
  };

  // Who may delete a conversation: either party in a DM, the channel creator
  // or an admin, or anyone with the chat_moderate permission.
  const canDeleteChannel =
    !!currentChannel &&
    (currentChannel.type === 'direct' ||
      currentChannel.createdBy === appUser?.id ||
      currentChannel.adminIds?.includes(appUser?.id ?? '') ||
      chatModerate);

  const handleDeleteChannel = async () => {
    if (!currentChannel) return;
    const isDm = currentChannel.type === 'direct';
    const ok = window.confirm(
      isDm
        ? 'Delete this conversation? It will be removed from your chat list.'
        : 'Delete this channel? It will be removed from everyone\'s chat list.',
    );
    if (!ok) return;
    try {
      await archiveChannel(currentChannel.id);
      toast.success('Conversation deleted');
      navigate('/app/chat');
    } catch {
      toast.error('Failed to delete conversation');
    }
  };

  const handleShareTask = async (task: Task) => {
    if (!appUser || !channelId) return;
    await send({
      senderId: appUser.id,
      text: `Task: ${task.title}`,
      type: 'task_ref',
      taskId: task.id,
      taskTitle: task.title,
      taskStatus: task.status,
      reactions: {},
      mentionedUserIds: [],
      isDeleted: false,
    });
    setShowShareTask(false);
  };

  const handleCreateGroup = async () => {
    if (!appUser || !groupName.trim()) return;
    const members = [...new Set([appUser.id, ...groupMembers])];
    const id = await createChannel({
      type: 'group',
      name: groupName.trim(),
      memberIds: members,
      adminIds: [appUser.id],
      lastMessageText: '',
      lastMessageBy: '',
      unreadCounts: {},
      lastReadAt: {},
    });
    setNewGroupModal(false);
    setGroupName('');
    setGroupMembers([]);
    navigate(`/app/chat/${id}`);
  };

  const startDm = async (userId: string) => {
    if (!appUser) return;
    setNewDmModal(false);
    const dmId = getDmChannelId(appUser.id, userId);
    const existing = await getChannel(dmId);
    if (!existing) {
      await createChannelWithId(dmId, {
        type: 'direct',
        name: '',
        memberIds: [appUser.id, userId],
        adminIds: [],
        lastMessageText: '',
        lastMessageBy: '',
        unreadCounts: {},
        lastReadAt: {},
      });
    }
    navigate(`/app/chat/${dmId}`);
  };

  // ─── Guard: chat_view ─────────────────────────────────────────────────────

  if (!chatView) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState
          icon={<Lock className="w-8 h-8" />}
          title="Access Restricted"
          description="You don't have permission to access the chat."
        />
      </div>
    );
  }

  // ─── Group messages by day ────────────────────────────────────────────────

  const groupedMessages: (ChatMessage | { type: 'day-sep'; date: Date })[] = [];
  let lastDate: Date | null = null;
  messages.forEach((msg) => {
    const d = msg.createdAt?.toDate() ?? new Date();
    if (!lastDate || !isSameDay(lastDate, d)) {
      groupedMessages.push({ type: 'day-sep', date: d });
      lastDate = d;
    }
    groupedMessages.push(msg);
  });

  const mentionUsers = users
    .filter((u) => (u.name || u.email || '')?.toLowerCase().includes(mentionQuery?.toLowerCase()))
    .slice(0, 6);

  // Header info for current channel
  const otherUid =
    currentChannel?.type === 'direct'
      ? currentChannel.memberIds.find((id) => id !== appUser?.id)
      : null;
  const otherUser = otherUid ? getUserById(otherUid) : null;
  const channelDisplayName =
    currentChannel?.type === 'direct'
      ? otherUser?.name || otherUser?.email || 'Direct Message'
      : currentChannel?.name ?? '';

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <div
        className={`flex-shrink-0 flex flex-col border-r border-slate-100 bg-white transition-all duration-300 ${
          sidebarOpen ? 'w-72' : 'w-0 overflow-hidden'
        } ${channelId ? 'hidden md:flex' : 'flex w-full md:w-72'}`}
      >
        {/* Sidebar header */}
        <div className="p-3 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-900 text-sm">Messages</h2>
            <div className="flex items-center gap-1">
              {can('chat_send') && (
                <button
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                  onClick={() => setNewDmModal(true)}
                  title="New direct message"
                >
                  <User className="w-4 h-4" />
                </button>
              )}
              {chatCreateGroup && (
                <button
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                  onClick={() => setNewGroupModal(true)}
                  title="New group"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <Input
            placeholder="Search channels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {channelSections.map(({ label, type }) => {
            const sectionChannels = filteredChannels.filter(
              (ch) => ch.type === type
            );
            if (sectionChannels.length === 0) return null;

            const sectionIconMap: Record<ChannelType, React.ReactNode> = {
              announcement: <Megaphone className="w-3 h-3 text-amber-500" />,
              project: <Hash className="w-3 h-3 text-blue-500" />,
              group: <Users className="w-3 h-3 text-violet-500" />,
              direct: <User className="w-3 h-3 text-slate-400" />,
            };

            return (
              <div key={type} className="mb-2">
                <div className="flex items-center gap-1.5 px-2 mb-1">
                  {sectionIconMap[type]}
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    {label}
                  </p>
                </div>
                <div className="space-y-0.5">
                  {sectionChannels.map((channel) => (
                    <ChannelItem
                      key={channel.id}
                      channel={channel}
                      selected={channel.id === channelId}
                      onClick={() => navigate(`/app/chat/${channel.id}`)}
                      currentUserId={appUser?.id ?? ''}
                      users={users}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {filteredChannels.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-6">
              No channels yet
            </p>
          )}
        </div>
      </div>

      {/* ── Message thread ───────────────────────────────────────────────────── */}
      {channelId ? (
        <div className="flex-1 flex flex-col min-w-0 bg-[#F0EBE3]">
          {/* Chat header */}
          <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 flex-shrink-0 shadow-sm">
            {/* Back arrow — mobile only */}
            <button
              className="md:hidden p-1 rounded-lg hover:bg-slate-100 text-slate-500"
              onClick={() => navigate('/app/chat')}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Toggle sidebar — desktop */}
            <button
              className="hidden md:block p-1 rounded-lg hover:bg-slate-100 text-slate-500"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <MessageSquare className="w-5 h-5" />
            </button>

            {/* Channel icon */}
            {currentChannel && (
              <>
                {currentChannel.type === 'direct' ? (
                  otherUser ? (
                    <Avatar
                      name={otherUser.name || otherUser.email || '?'}
                      src={otherUser.avatarUrl}
                      size="sm"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                      <User className="w-4 h-4 text-slate-400" />
                    </div>
                  )
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {currentChannel.type === 'announcement' ? (
                      <Megaphone className="w-4 h-4 text-amber-500" />
                    ) : currentChannel.type === 'project' ? (
                      <Hash className="w-4 h-4 text-blue-500" />
                    ) : (
                      <Users className="w-4 h-4 text-violet-500" />
                    )}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900 text-sm truncate">
                      {channelDisplayName}
                    </p>
                    {currentChannel.type === 'announcement' && (
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">
                        Announcement
                      </span>
                    )}
                  </div>
                  {currentChannel.type !== 'direct' && (
                    <p className="text-xs text-slate-500">
                      {currentChannel.memberIds.length} members
                    </p>
                  )}
                </div>

                {/* Info button — non-DM channels only */}
                {currentChannel.type !== 'direct' && (
                  <button
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 flex-shrink-0"
                    onClick={() => setChannelInfoModal(true)}
                    title="Channel info"
                  >
                    <Info className="w-5 h-5" />
                  </button>
                )}

                {/* Delete conversation */}
                {canDeleteChannel && (
                  <button
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 flex-shrink-0"
                    onClick={handleDeleteChannel}
                    title="Delete conversation"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto py-2">
            {msgLoading ? (
              <div className="flex items-center justify-center h-full">
                <Spinner />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <EmptyState
                  icon={<MessageSquare className="w-8 h-8" />}
                  title="No messages yet"
                  description="Be the first to say something!"
                />
              </div>
            ) : (
              <>
                {groupedMessages.map((item, idx) => {
                  if ('type' in item && item.type === 'day-sep') {
                    return (
                      <DaySeparator key={`sep-${idx}`} date={item.date} />
                    );
                  }
                  const msg = item as ChatMessage;
                  const isOwn = msg.senderId === appUser?.id;
                  const sender = getUserById(msg.senderId);
                  const prevItem =
                    idx > 0 ? groupedMessages[idx - 1] : null;
                  const prevIsSameSender =
                    prevItem &&
                    !('type' in prevItem) &&
                    (prevItem as ChatMessage).senderId === msg.senderId;
                  const showAvatar = !isOwn && !prevIsSameSender;

                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isOwn={isOwn}
                      senderName={sender?.name || sender?.email || 'Unknown'}
                      senderAvatar={sender?.avatarUrl}
                      showAvatar={!!showAvatar}
                      canModerate={chatModerate}
                      onReply={setReplyTo}
                      onReact={handleReact}
                      onEdit={setEditMsg}
                      onDelete={(msgId) => del(msgId)}
                      onCopy={handleCopy}
                      currentUserId={appUser?.id ?? ''}
                      onTaskClick={(taskId) =>
                        navigate(`/app/tasks/${taskId}`)
                      }
                    />
                  );
                })}

                {/* Typing indicator */}
                {Object.keys(typing).length > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-slate-500">
                      {Object.values(typing).join(', ')}{' '}
                      {Object.keys(typing).length === 1 ? 'is' : 'are'} typing…
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* ── Compose area ──────────────────────────────────────────────── */}
          {canSend ? (
            <div className="bg-white border-t border-slate-100 flex-shrink-0">
              {/* Reply / Edit strip */}
              {(replyTo || editMsg) && (
                <div className="flex items-center gap-3 px-4 pt-3 pb-0">
                  <div className="flex-1 border-l-2 border-primary pl-3 text-sm">
                    <p className="font-medium text-primary text-xs">
                      {editMsg
                        ? 'Editing message'
                        : `Replying to ${
                            getUserById(replyTo!.senderId)?.name ?? 'Unknown'
                          }`}
                    </p>
                    <p className="text-slate-500 text-xs truncate">
                      {editMsg?.text ?? replyTo?.text}
                    </p>
                  </div>
                  <button
                    className="p-1 text-slate-400 hover:text-slate-600"
                    onClick={cancelEditReply}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* @ Mention picker */}
              {showMention && mentionUsers.length > 0 && (
                <div className="mx-4 mb-2 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                  {mentionUsers.map((u) => (
                    <button
                      key={u.id}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-left"
                      onClick={() => insertMention(u)}
                    >
                      <Avatar name={u.name || u.email || '?'} src={u.avatarUrl} size="xs" />
                      <span className="text-sm font-medium text-slate-700">
                        {u.name || u.email || 'Unknown'}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2 p-3">
                {/* Attach file */}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleAttach}
                />
                <button
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 flex-shrink-0 disabled:opacity-50"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={attaching}
                  title="Attach file"
                >
                  {attaching
                    ? <Spinner size="sm" />
                    : <Paperclip className="w-5 h-5" />}
                </button>

                {/* Share task button */}
                {tasksView && (
                  <button
                    className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 flex-shrink-0"
                    onClick={() => setShowShareTask(true)}
                    title="Share task"
                  >
                    <CheckSquare className="w-5 h-5" />
                  </button>
                )}

                {/* Textarea */}
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    placeholder="Type a message…"
                    value={text}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    className="w-full resize-none rounded-2xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:border-primary max-h-32"
                    style={{ minHeight: '42px' }}
                  />
                </div>

                {/* Send button */}
                <button
                  onClick={handleSend}
                  disabled={!text.trim()}
                  className="p-2.5 rounded-xl bg-primary text-white disabled:opacity-50 hover:opacity-90 transition-opacity flex-shrink-0"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            /* Read-only bar */
            <div className="bg-white border-t border-slate-100 px-4 py-3 flex items-center justify-center flex-shrink-0">
              <p className="text-sm text-slate-400 italic">
                {isAnnouncement
                  ? 'Only admins can post in announcement channels'
                  : "You don't have permission to send messages"}
              </p>
            </div>
          )}
        </div>
      ) : (
        /* No channel selected */
        <div className="hidden md:flex flex-1 items-center justify-center bg-[#F0EBE3]">
          <EmptyState
            icon={<MessageSquare className="w-10 h-10" />}
            title="Select a conversation"
            description="Choose a channel or direct message to start chatting"
          />
        </div>
      )}

      {/* ── New Group Modal ────────────────────────────────────────────────── */}
      <Modal
        open={newGroupModal}
        onClose={() => {
          setNewGroupModal(false);
          setGroupName('');
          setGroupMembers([]);
          setGroupSearch('');
        }}
        title="Create Group"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setNewGroupModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || groupMembers.length === 0}
            >
              Create
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Group Name"
            placeholder="e.g. Site Team Alpha"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">
              Add Members
            </p>
            <Input
              placeholder="Search members…"
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              className="mb-2"
            />
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {activeOtherUsers
                .filter((u) =>
                  (u.name || u.email || '')?.toLowerCase().includes(groupSearch?.toLowerCase())
                )
                .map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={groupMembers.includes(u.id)}
                      onChange={() =>
                        setGroupMembers((prev) =>
                          prev.includes(u.id)
                            ? prev.filter((id) => id !== u.id)
                            : [...prev, u.id]
                        )
                      }
                      className="rounded border-slate-300 text-primary focus:ring-primary/40"
                    />
                    <Avatar name={u.name || u.email || '?'} src={u.avatarUrl} size="xs" />
                    <span className="text-sm text-slate-700">{u.name || u.email || 'Unknown'}</span>
                  </label>
                ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* ── New DM Modal ──────────────────────────────────────────────────── */}
      <Modal
        open={newDmModal}
        onClose={() => {
          setNewDmModal(false);
          setDmSearch('');
        }}
        title="New Direct Message"
      >
        <div className="space-y-3">
          <Input
            placeholder="Search people…"
            value={dmSearch}
            onChange={(e) => setDmSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {activeOtherUsers
              .filter((u) =>
                (u.name || u.email || '')?.toLowerCase().includes(dmSearch?.toLowerCase())
              )
              .map((u) => (
                <button
                  key={u.id}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-left transition-colors"
                  onClick={() => startDm(u.id)}
                >
                  <Avatar name={u.name || u.email || '?'} src={u.avatarUrl} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {u.name || u.email || 'Unknown'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{u.email}</p>
                  </div>
                </button>
              ))}
            {activeOtherUsers.filter((u) =>
              (u.name || u.email || '')?.toLowerCase().includes(dmSearch?.toLowerCase())
            ).length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">
                No users found
              </p>
            )}
          </div>
        </div>
      </Modal>

      {/* ── Channel Info Modal ────────────────────────────────────────────── */}
      {currentChannel && currentChannel.type !== 'direct' && (
        <Modal
          open={channelInfoModal}
          onClose={() => setChannelInfoModal(false)}
          title={`#${currentChannel.name}`}
          size="sm"
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">
                {currentChannel.memberIds.length} members
              </span>
              {currentChannel.type === 'announcement' && (
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  Announcement
                </span>
              )}
            </div>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {currentChannel.memberIds.map((uid) => {
                const u = getUserById(uid);
                const isAdmin = currentChannel.adminIds?.includes(uid);
                return (
                  <div
                    key={uid}
                    className="flex items-center gap-3 px-2 py-2 rounded-lg"
                  >
                    {u ? (
                      <>
                        <Avatar name={u.name || u.email || '?'} src={u.avatarUrl} size="sm" />
                        <span className="flex-1 text-sm text-slate-800">
                          {u.name || u.email || 'Unknown'}
                        </span>
                        {isAdmin && (
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                            Admin
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-sm text-slate-400 italic">
                        Unknown user
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
      )}

      {/* ── Share Task Modal ──────────────────────────────────────────────── */}
      <Modal
        open={showShareTask}
        onClose={() => setShowShareTask(false)}
        title="Share Task"
        size="lg"
      >
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {tasks.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">
              No tasks available
            </p>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl cursor-pointer border border-slate-100 transition-colors"
                onClick={() => handleShareTask(task)}
              >
                <CheckSquare className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {task.title}
                  </p>
                  <p className="text-xs text-slate-500 capitalize">
                    {task.status}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ChatPage;
