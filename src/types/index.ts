import { Timestamp } from 'firebase/firestore';

// ─── Permissions ─────────────────────────────────────────────────────────────
export interface Permissions {
  tasks_view?: boolean;
  tasks_create?: boolean;
  tasks_edit?: boolean;
  tasks_delete?: boolean;
  tasks_approve?: boolean;
  projects_view?: boolean;
  projects_create?: boolean;
  projects_edit?: boolean;
  projects_delete?: boolean;
  docs_view?: boolean;
  docs_upload?: boolean;
  docs_approve?: boolean;
  team_view?: boolean;
  team_manage?: boolean;
  team_delete?: boolean;
  reports_view?: boolean;
  reports_export?: boolean;
  time_log?: boolean;
  time_view_all?: boolean;
  roles_manage?: boolean;
  settings_manage?: boolean;
  notifications_manage?: boolean;
  chat_view?: boolean;
  chat_send?: boolean;
  chat_create_group?: boolean;
  chat_announce?: boolean;
  chat_moderate?: boolean;
  attendance_view_all?: boolean;
  contact_view?: boolean;
  contact_manage?: boolean;
  performance_view?: boolean;
  performance_manage?: boolean;
}

// ─── Role ─────────────────────────────────────────────────────────────────────
export interface Role {
  id: string;
  name: string;
  description: string;
  color: string;
  level: number;
  permissions: Permissions;
  createdBy: string;
  createdAt?: Timestamp;
}

// ─── User ─────────────────────────────────────────────────────────────────────
export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string;
  roleId: string;
  isActive: boolean;
  orgId: string;
  createdAt?: any;
  lastLoginAt?: any;
  projectIds?: string[];
  notificationsEnabled?: boolean;
  biometricEnabled?: boolean;
  preferences?: {
    announcements: boolean;
    chats: boolean;
    tasks: boolean;
  };
}

// ─── Project ──────────────────────────────────────────────────────────────────
export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  // Optional: a project without a defined start/end date is valid (open-ended).
  startDate?: Timestamp;
  endDate?: Timestamp;
  memberIds: string[];
  managerId: string;
  budget: number;
  createdAt?: Timestamp;
}

// ─── Task ─────────────────────────────────────────────────────────────────────
export type TaskStatus = 'in_progress' | 'approved' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'none';

export interface Subtask {
  id: string;
  title: string;
  isDone: boolean;
  completedBy?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string;
  assigneeIds: string[];
  assignedRoleId?: string;
  assignedRoleIds?: string[];
  createdBy: string;
  status: TaskStatus;
  priority: TaskPriority;
  // Optional: tasks created without a due date are valid (e.g. ongoing work).
  dueDate?: Timestamp;
  estimatedHours: number;
  tags: string[];
  approvalStatus: ApprovalStatus;
  memberProgress?: Record<string, {
    status: TaskStatus;
    updatedAt?: Timestamp;
    actualHours?: number;
    completedBy?: string;
    completedAt?: Timestamp;
    completionStatus?: 'completed' | 'completed_on_time' | 'completed_late';
    delaySeconds?: number;
  }>;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  completedAt?: Timestamp;
  completionStatus?: 'completed' | 'completed_on_time' | 'completed_late';
  delaySeconds?: number;
}

// ─── Document ─────────────────────────────────────────────────────────────────
export interface Document {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  projectId: string;
  uploadedBy: string;
  approvalStatus: ApprovalStatus;
  // Supabase Storage location (used to delete the underlying file).
  storageBucket?: string;
  storagePath?: string;
  createdAt?: Timestamp;
}

// ─── Attendance ───────────────────────────────────────────────────────────────
export interface Attendance {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  checkInTime?: Timestamp;
  checkOutTime?: Timestamp;
  checkInLocation?: { latitude: number; longitude: number };
  checkOutLocation?: { latitude: number; longitude: number };
  checkInAddress?: string;
  checkOutAddress?: string;
  isWithinGeofence?: boolean;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
export type ChannelType = 'announcement' | 'project' | 'group' | 'direct';

export interface ChatChannel {
  id: string;
  type: ChannelType;
  name: string;
  createdBy?: string;
  memberIds: string[];
  adminIds: string[];
  lastMessageText: string;
  lastMessageAt?: Timestamp;
  lastMessageBy: string;
  unreadCounts: Record<string, number>;
  lastReadAt: Record<string, Timestamp>;
  isArchived?: boolean;
}

export type MessageType = 'text' | 'image' | 'file' | 'task_ref' | 'system';

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  type: MessageType;
  replyToId?: string;
  replyToText?: string;
  replyToSenderName?: string;
  reactions: Record<string, string[]>; // emoji -> [uids]
  mentionedUserIds: string[];
  taskId?: string;
  taskTitle?: string;
  taskStatus?: TaskStatus;
  // File / image attachment (stored in Supabase Storage)
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentBucket?: string;
  attachmentPath?: string;
  editedAt?: Timestamp;
  isDeleted: boolean;
  createdAt: Timestamp;
}

export interface TypingIndicator {
  name: string;
  at: Timestamp;
}

// ─── Site Diary ───────────────────────────────────────────────────────────────
export interface SiteDiaryEntry {
  id: string;
  projectId: string;
  date: string; // YYYY-MM-DD
  weather: string;
  workDone: string;
  manpower: number;
  equipment: string;
  remarks: string;
  photoUrls: string[];
  // Firestore rule for site_diaries checks resource.data.authorId.
  authorId: string;
  createdAt?: Timestamp;
}

// ─── Org Settings ─────────────────────────────────────────────────────────────
export interface OrgSettings {
  companyName: string;
  companyLogo: string;
  timezone: string;
  workStartTime: string;
  workEndTime: string;
  geofenceRadius: number;
  geofenceLat: number;
  geofenceLng: number;
}

// ─── Audit Log ────────────────────────────────────────────────────────────────
export interface AuditLog {
  id: string;
  action: string;
  userId: string;
  userName: string;
  targetId: string;
  targetType: string;
  details: string;
  createdAt: Timestamp;
}

// ─── Contact Inquiry ──────────────────────────────────────────────────────────
export type InquiryStatus = 'new' | 'contacted' | 'closed';
export type InquirySource = 'website' | 'mobile_app';

export interface ContactInquiry {
  id: string;
  name: string;
  phone: string;
  email?: string;
  projectType: string;
  message: string;
  status: InquiryStatus;
  source: InquirySource;
  assignedTo?: string;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ─── Notification ─────────────────────────────────────────────────────────────
export interface AppNotification {
  id: string;
  title: string;
  body: string;
  userId: string; // '' = broadcast
  isRead: Record<string, boolean>;
  type: string;
  createdAt: Timestamp;
  relatedId?: string;
  relatedType?: string;
}

// ─── Task Assignment Rules ────────────────────────────────────────────────────
// Configured by the Director: controls which roles a given role is allowed to
// assign tasks to. When `enabled` is false (or the doc is missing) anyone with
// the tasks_create permission may assign to anyone — the historical behaviour.
//
// `matrix[roleId]` = array of roleIds that members of `roleId` may assign to.
export interface TaskAssignmentConfig {
  enabled: boolean;
  matrix: Record<string, string[]>;
  updatedBy?: string;
  updatedAt?: Timestamp;
}

// ─── Performance Score ────────────────────────────────────────────────────────
export interface PerformanceScore {
  id: string; // matches userId
  userId: string;
  totalTasksCompleted: number;
  totalTasksAssigned: number;
  tasksCompletedOnTime: number;
  tasksCompletedLate: number;
  tasksOverdue: number;
  tasksRejected: number;
  tasksReopened: number;
  deadlineExtensions: number;
  consecutiveSuccesses: number;
  bestStreak: number;
  completedByPriority: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  avgCompletionHours: number;
  avgEfficiencyRatio: number;
  avgPeerReviewScore: number;
  avgManagerReviewScore: number;
  qualityScore: number;
  dailyActivityDays: number;
  weeklyCompletionRates: number[];
  monthlyCompletionRates: number[];
  tasksHelpedOnCount: number;
  collaborationScore: number;
  attendanceDays: number;
  attendanceRate: number;
  productivityScore: number;
  reliabilityScore: number;
  efficiencyScore: number;
  overallPerformanceIndex: number;
  totalPenaltyPoints: number;
  penaltyBreakdown: {
    lateCompletions: number;
    deadlineExtensions: number;
    rejections: number;
    reopenings: number;
    missedDeadlines: number;
    inactivity: number;
  };
  badges: string[];
  roleId: string;
  departmentNormalizationFactor: number;
  lastRecalculatedAt: Timestamp;
}

// ─── Performance Review ────────────────────────────────────────────────────────
export interface PerformanceReview {
  id: string;
  taskId: string;
  reviewerId: string;
  revieweeId: string;
  type: 'peer' | 'manager';
  score: number;
  comment?: string;
  createdAt: Timestamp;
}

// ─── Performance Config ────────────────────────────────────────────────────────
export interface PerformanceConfig {
  priorityWeights: { critical: number; high: number; medium: number; low: number };
  penalties: {
    latePerDay: number;
    deadlineExtension: number;
    rejection: number;
    reopening: number;
    missedDeadline: number;
    inactivityPerDay: number;
  };
  bonuses: {
    streakBonus5: number;
    streakBonus10: number;
    streakBonus25: number;
    onTimeBonus: number;
    collaborationBonus: number;
  };
  scoreWeights: {
    productivity: number;
    reliability: number;
    efficiency: number;
    quality: number;
    collaboration: number;
  };
  roleDifficultyMultipliers: Record<string, number>;
  updatedAt: Timestamp;
  updatedBy: string;
}
