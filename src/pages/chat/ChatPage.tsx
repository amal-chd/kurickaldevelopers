import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Send, Plus, Search, MessageSquare, Smile, CornerUpLeft, Edit2, Trash2,
  Copy, MoreVertical, ChevronLeft, Megaphone, Users, User, Hash, CheckCheck,
  AtSign, X, CheckSquare,
} from 'lucide-react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
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
  getAllUsers, getChannel, createChannelWithId, getTasks,
  createChannel,
} from '../../lib/firestore';
import { ChatChannel, ChatMessage, AppUser, Task } from '../../types';
import { getDmChannelId, formatRelative } from '../../lib/utils';
import toast from 'react-hot-toast';

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '✅'];

function DaySeparator({ date }: { date: Date }) {
  let label: string;
  if (isToday(date)) label = 'Today';
  else if (isYesterday(date)) label = 'Yesterday';
  else label = format(date, 'EEEE, MMMM d');

  return (
    <div className="flex items-center gap-3 my-3 px-4">
      <div className="flex-1 h-px bg-gray-300/50" />
      <span className="text-xs text-gray-500 font-medium px-2 py-0.5 bg-white rounded-full shadow-sm">
        {label}
      </span>
      <div className="flex-1 h-px bg-gray-300/50" />
    </div>
  );
}

const ChannelItem: React.FC<{
  channel: ChatChannel;
  selected: boolean;
  onClick: () => void;
  currentUserId: string;
  users: AppUser[];
}> = ({ channel, selected, onClick, currentUserId, users }) => {
  const unread = channel.unreadCounts?.[currentUserId] ?? 0;
  const otherUserId = channel.type === 'direct'
    ? channel.memberIds.find((id) => id !== currentUserId)
    : null;
  const otherUser = otherUserId ? users.find((u) => u.id === otherUserId) : null;
  const displayName = channel.type === 'direct' && otherUser ? otherUser.name : channel.name;

  const iconMap: Record<string, React.ReactNode> = {
    announcement: <Megaphone className="w-4 h-4" />,
    project: <Hash className="w-4 h-4" />,
    group: <Users className="w-4 h-4" />,
    direct: otherUser ? <Avatar name={otherUser.name} src={otherUser.avatarUrl} size="sm" /> : <User className="w-4 h-4" />,
  };

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${
        selected ? 'bg-primary/10' : 'hover:bg-gray-100'
      }`}
    >
      <div className={`flex-shrink-0 ${channel.type !== 'direct' ? 'w-8 h-8 rounded-xl flex items-center justify-center bg-gray-100 text-gray-600' : ''}`}>
        {iconMap[channel.type]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className={`text-sm font-medium truncate ${selected ? 'text-primary' : 'text-gray-900'}`}>
            {displayName}
          </p>
          {channel.lastMessageAt && (
            <p className="text-xs text-gray-400 flex-shrink-0 ml-1">
              {formatRelative(channel.lastMessageAt)}
            </p>
          )}
        </div>
        {channel.lastMessageText && (
          <p className="text-xs text-gray-500 truncate mt-0.5">{channel.lastMessageText}</p>
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

const MessageBubble: React.FC<{
  message: ChatMessage;
  isOwn: boolean;
  senderName: string;
  senderAvatar?: string;
  showAvatar: boolean;
  onReply: (msg: ChatMessage) => void;
  onReact: (msgId: string, emoji: string) => void;
  onEdit: (msg: ChatMessage) => void;
  onDelete: (msgId: string) => void;
  onCopy: (text: string) => void;
  currentUserId: string;
  users: AppUser[];
  onTaskClick?: (taskId: string) => void;
}> = ({
  message, isOwn, senderName, senderAvatar, showAvatar,
  onReply, onReact, onEdit, onDelete, onCopy, currentUserId, users, onTaskClick,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);

  if (message.isDeleted) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} px-4 mb-1`}>
        <p className="text-xs text-gray-400 italic px-3 py-1.5 bg-gray-100 rounded-xl">
          This message was deleted
        </p>
      </div>
    );
  }

  if (message.type === 'system') {
    return (
      <div className="flex justify-center px-4 my-1">
        <p className="text-xs text-gray-500 bg-white/60 rounded-full px-3 py-1">
          {message.text}
        </p>
      </div>
    );
  }

  const reactions = message.reactions ?? {};
  const hasReactions = Object.keys(reactions).some((e) => reactions[e].length > 0);

  return (
    <div
      className={`flex gap-2 px-4 mb-0.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmoji(false); }}
    >
      {!isOwn && (
        <div className="w-8 flex-shrink-0 self-end">
          {showAvatar && (
            <Avatar name={senderName} src={senderAvatar} size="sm" />
          )}
        </div>
      )}

      <div className={`flex flex-col max-w-xs sm:max-w-md lg:max-w-lg ${isOwn ? 'items-end' : 'items-start'}`}>
        {!isOwn && showAvatar && (
          <p className="text-xs font-semibold text-gray-600 mb-1 ml-1">{senderName}</p>
        )}

        {/* Reply preview */}
        {message.replyToId && (
          <div className={`text-xs rounded-lg px-2 py-1 mb-1 border-l-2 ${isOwn ? 'border-white/50 bg-white/30 text-white/80' : 'border-primary/50 bg-gray-100 text-gray-500'}`}>
            <p className="font-medium">{message.replyToSenderName}</p>
            <p className="truncate max-w-40">{message.replyToText}</p>
          </div>
        )}

        {/* Task ref */}
        {message.type === 'task_ref' && message.taskId && (
          <div
            className="bg-white border border-gray-200 rounded-xl p-3 mb-1 cursor-pointer hover:shadow-md transition-shadow w-64"
            onClick={() => onTaskClick?.(message.taskId!)}
          >
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-gray-900 truncate">{message.taskTitle}</p>
            </div>
            {message.taskStatus && (
              <span className="text-xs text-gray-500 mt-1">Status: {message.taskStatus}</span>
            )}
          </div>
        )}

        {/* Bubble */}
        <div
          className={`relative group px-3 py-2 rounded-2xl text-sm shadow-sm ${
            isOwn
              ? 'bg-primary text-white rounded-br-sm'
              : 'bg-white text-gray-900 rounded-bl-sm'
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
          <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <p className={`text-xs ${isOwn ? 'text-white/60' : 'text-gray-400'}`}>
              {message.createdAt ? format(message.createdAt.toDate(), 'h:mm a') : ''}
            </p>
            {message.editedAt && (
              <p className={`text-xs ${isOwn ? 'text-white/50' : 'text-gray-400'}`}>(edited)</p>
            )}
            {isOwn && <CheckCheck className="w-3 h-3 text-white/60" />}
          </div>
        </div>

        {/* Reactions */}
        {hasReactions && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(reactions).filter(([, uids]) => uids.length > 0).map(([emoji, uids]) => (
              <button
                key={emoji}
                onClick={() => onReact(message.id, emoji)}
                className={`text-xs rounded-full px-2 py-0.5 border flex items-center gap-0.5 transition-colors ${
                  uids.includes(currentUserId)
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {emoji} {uids.length}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {showActions && (
        <div className={`self-center flex items-center gap-0.5 ${isOwn ? 'mr-1' : 'ml-1'}`}>
          <div className="relative">
            <button
              className="p-1 rounded-lg bg-white shadow-sm text-gray-500 hover:text-gray-700 border border-gray-100"
              onClick={() => setShowEmoji(!showEmoji)}
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
            {showEmoji && (
              <div className={`absolute ${isOwn ? 'right-0' : 'left-0'} bottom-full mb-1 bg-white rounded-xl shadow-lg border border-gray-100 p-2 flex gap-1 z-20`}>
                {EMOJI_LIST.map((e) => (
                  <button
                    key={e}
                    className="text-lg hover:scale-125 transition-transform"
                    onClick={() => { onReact(message.id, e); setShowEmoji(false); }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            className="p-1 rounded-lg bg-white shadow-sm text-gray-500 hover:text-gray-700 border border-gray-100"
            onClick={() => onReply(message)}
          >
            <CornerUpLeft className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1 rounded-lg bg-white shadow-sm text-gray-500 hover:text-gray-700 border border-gray-100"
            onClick={() => onCopy(message.text)}
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          {isOwn && (
            <>
              <button
                className="p-1 rounded-lg bg-white shadow-sm text-gray-500 hover:text-gray-700 border border-gray-100"
                onClick={() => onEdit(message)}
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                className="p-1 rounded-lg bg-white shadow-sm text-red-400 hover:text-red-600 border border-gray-100"
                onClick={() => onDelete(message.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const ChatPage: React.FC = () => {
  const { channelId } = useParams<{ channelId?: string }>();
  const navigate = useNavigate();
  const { appUser } = useAuthStore();
  const { can } = usePermissions();
  const { channels } = useChannels();
  const { messages, loading: msgLoading } = useMessages(channelId ?? null);
  const typing = useTypingIndicators(channelId ?? null);
  const { send, edit, del, react, startTyping, stopTyping } = useChatActions(channelId ?? null);

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
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeout = useRef<number | null>(null);

  const currentChannel = channels.find((c) => c.id === channelId);

  useEffect(() => {
    const load = async () => {
      const [u, t] = await Promise.all([getAllUsers(), getTasks()]);
      setUsers(u);
      setTasks(t);
    };
    load();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const getUser = (uid: string) => users.find((u) => u.id === uid);

  const filteredChannels = channels.filter((ch) => {
    if (!search) return true;
    const name = ch.type === 'direct'
      ? getUser(ch.memberIds.find((id) => id !== appUser?.id) ?? '')?.name ?? ''
      : ch.name;
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    // Detect @ mention
    const lastAt = val.lastIndexOf('@');
    if (lastAt !== -1 && lastAt === val.length - 1) {
      setShowMention(true);
      setMentionQuery('');
    } else if (lastAt !== -1 && val.slice(lastAt).match(/^@\w*$/)) {
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
    setText(text.slice(0, lastAt) + `@${user.name} `);
    setShowMention(false);
    textareaRef.current?.focus();
  };

  const handleSend = async () => {
    if (!text.trim() || !appUser || !channelId) return;
    const msgText = text.trim();
    setText('');
    setReplyTo(null);
    stopTyping();

    const mentionedUserIds = users
      .filter((u) => msgText.includes(`@${u.name}`))
      .map((u) => u.id);

    if (editMsg) {
      await edit(editMsg.id, msgText);
      setEditMsg(null);
      return;
    }

    await send({
      senderId: appUser.id,
      text: msgText,
      type: 'text',
      replyToId: replyTo?.id,
      replyToText: replyTo?.text,
      replyToSenderName: replyTo ? (getUser(replyTo.senderId)?.name ?? 'Unknown') : undefined,
      reactions: {},
      mentionedUserIds,
      isDeleted: false,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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

  if (!can('chat_view')) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState icon={<MessageSquare className="w-8 h-8" />} title="Access Denied" />
      </div>
    );
  }

  // Group messages by day
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

  const mentionUsers = users.filter((u) =>
    u.name.toLowerCase().includes(mentionQuery.toLowerCase())
  ).slice(0, 6);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Channel list */}
      <div className={`flex-shrink-0 flex flex-col border-r border-gray-100 bg-white transition-all duration-300 ${
        sidebarOpen ? 'w-72' : 'w-0 overflow-hidden'
      } ${channelId ? 'hidden md:flex' : 'flex w-full md:w-72'}`}>
        <div className="p-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 text-sm">Messages</h2>
            {can('chat_create_group') && (
              <button
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                onClick={() => setNewGroupModal(true)}
                title="New group"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
          <Input
            placeholder="Search channels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {/* New DM */}
          {!search && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase px-2 mb-1">Direct Messages</p>
              {users.filter((u) => u.id !== appUser?.id).slice(0, 5).map((u) => (
                <button
                  key={u.id}
                  onClick={() => startDm(u.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 text-left"
                >
                  <Avatar name={u.name} src={u.avatarUrl} size="xs" />
                  <span className="text-sm text-gray-700 truncate">{u.name}</span>
                </button>
              ))}
            </div>
          )}

          <p className="text-xs font-semibold text-gray-400 uppercase px-2 mb-1">Channels</p>
          <div className="space-y-0.5">
            {filteredChannels.map((channel) => (
              <ChannelItem
                key={channel.id}
                channel={channel}
                selected={channel.id === channelId}
                onClick={() => navigate(`/app/chat/${channel.id}`)}
                currentUserId={appUser?.id ?? ''}
                users={users}
              />
            ))}
            {filteredChannels.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No channels yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Message thread */}
      {channelId ? (
        <div className="flex-1 flex flex-col min-w-0 bg-[#EAE6DF]">
          {/* Chat header */}
          <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 flex-shrink-0 shadow-sm">
            <button
              className="md:hidden p-1 rounded-lg hover:bg-gray-100 text-gray-500"
              onClick={() => navigate('/app/chat')}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              className="hidden md:block p-1 rounded-lg hover:bg-gray-100 text-gray-500"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            {currentChannel && (
              <>
                {currentChannel.type === 'direct' ? (
                  (() => {
                    const otherUid = currentChannel.memberIds.find((id) => id !== appUser?.id);
                    const other = getUser(otherUid ?? '');
                    return other ? (
                      <Avatar name={other.name} src={other.avatarUrl} size="sm" />
                    ) : null;
                  })()
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Hash className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">
                    {currentChannel.type === 'direct'
                      ? getUser(currentChannel.memberIds.find((id) => id !== appUser?.id) ?? '')?.name
                      : currentChannel.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {currentChannel.memberIds.length} members
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Messages */}
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
                    return <DaySeparator key={`sep-${idx}`} date={item.date} />;
                  }
                  const msg = item as ChatMessage;
                  const isOwn = msg.senderId === appUser?.id;
                  const sender = getUser(msg.senderId);
                  const prevMsg = idx > 0 ? groupedMessages[idx - 1] : null;
                  const prevIsSameSender = prevMsg && !('type' in prevMsg) && (prevMsg as ChatMessage).senderId === msg.senderId;
                  const showAvatar = !isOwn && !prevIsSameSender;

                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isOwn={isOwn}
                      senderName={sender?.name ?? 'Unknown'}
                      senderAvatar={sender?.avatarUrl}
                      showAvatar={!!showAvatar}
                      onReply={setReplyTo}
                      onReact={handleReact}
                      onEdit={setEditMsg}
                      onDelete={(msgId) => del(msgId)}
                      onCopy={handleCopy}
                      currentUserId={appUser?.id ?? ''}
                      users={users}
                      onTaskClick={(taskId) => navigate(`/app/tasks/${taskId}`)}
                    />
                  );
                })}

                {/* Typing indicators */}
                {Object.keys(typing).length > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">
                      {Object.values(typing).join(', ')} {Object.keys(typing).length === 1 ? 'is' : 'are'} typing...
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Compose area */}
          {can('chat_send') && (
            <div className="bg-white border-t border-gray-100 flex-shrink-0">
              {/* Reply/Edit preview */}
              {(replyTo || editMsg) && (
                <div className="flex items-center gap-3 px-4 pt-3 pb-0">
                  <div className="flex-1 border-l-2 border-primary pl-3 text-sm">
                    <p className="font-medium text-primary text-xs">
                      {editMsg ? 'Editing message' : `Replying to ${getUser(replyTo!.senderId)?.name}`}
                    </p>
                    <p className="text-gray-500 text-xs truncate">
                      {editMsg?.text ?? replyTo?.text}
                    </p>
                  </div>
                  <button
                    className="p-1 text-gray-400 hover:text-gray-600"
                    onClick={() => { setReplyTo(null); setEditMsg(null); setText(''); }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Mention picker */}
              {showMention && mentionUsers.length > 0 && (
                <div className="mx-4 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  {mentionUsers.map((u) => (
                    <button
                      key={u.id}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"
                      onClick={() => insertMention(u)}
                    >
                      <Avatar name={u.name} src={u.avatarUrl} size="xs" />
                      <span className="text-sm font-medium text-gray-700">{u.name}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2 p-3">
                <button
                  className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 flex-shrink-0"
                  onClick={() => setShowShareTask(true)}
                  title="Share task"
                >
                  <CheckSquare className="w-5 h-5" />
                </button>

                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    placeholder="Type a message..."
                    value={editMsg ? (text || editMsg.text) : text}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    className="w-full resize-none rounded-2xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary max-h-32"
                    style={{ minHeight: '42px' }}
                  />
                </div>

                <button
                  onClick={handleSend}
                  disabled={!text.trim() && !editMsg}
                  className="p-2.5 rounded-xl bg-primary text-white disabled:opacity-50 hover:bg-primary-600 transition-colors flex-shrink-0"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-[#EAE6DF]">
          <EmptyState
            icon={<MessageSquare className="w-10 h-10" />}
            title="Select a conversation"
            description="Choose a channel or direct message to start chatting"
          />
        </div>
      )}

      {/* New Group Modal */}
      <Modal
        open={newGroupModal}
        onClose={() => setNewGroupModal(false)}
        title="Create Group"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setNewGroupModal(false)}>Cancel</Button>
            <Button onClick={handleCreateGroup} disabled={!groupName.trim()}>Create</Button>
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
            <p className="text-sm font-medium text-gray-700 mb-2">Add Members</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {users.filter((u) => u.id !== appUser?.id).map((u) => (
                <label key={u.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupMembers.includes(u.id)}
                    onChange={() => setGroupMembers((prev) =>
                      prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                    )}
                    className="rounded border-gray-300 text-primary focus:ring-primary/40"
                  />
                  <Avatar name={u.name} src={u.avatarUrl} size="xs" />
                  <span className="text-sm text-gray-700">{u.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Share Task Modal */}
      <Modal
        open={showShareTask}
        onClose={() => setShowShareTask(false)}
        title="Share Task"
        size="lg"
      >
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl cursor-pointer border border-gray-100"
              onClick={() => handleShareTask(task)}
            >
              <CheckSquare className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{task.title}</p>
                <p className="text-xs text-gray-500">{task.status}</p>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default ChatPage;
