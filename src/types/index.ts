import { Timestamp } from 'firebase/firestore';

// ─── Permissions ─────────────────────────────────────────────────────────────
export interface Permissions {
  tasks_view?: boolean;
  tasks_view_all?: boolean;
  tasks_create?: boolean;
  tasks_edit?: boolean;
  tasks_delete?: boolean;
  tasks_approve?: boolean;
  projects_view?: boolean;
  projects_view_all?: boolean;
  projects_create?: boolean;
  projects_edit?: boolean;
  projects_delete?: boolean;
  docs_view?: boolean;
  docs_view_all?: boolean;
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
  // HR & Finance (leave / payroll / expenses). Optional so existing role
  // documents remain valid; access falls back to role level / existing perms.
  leave_manage?: boolean;
  payroll_manage?: boolean;
  expense_manage?: boolean;
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
  avatarUrl?: string;
  roleId: string;
  isActive: boolean;
  orgId: string;
  createdAt?: Timestamp;
  lastLoginAt?: Timestamp;
  projectIds?: string[];
  fcmToken?: string;
  biometricEnabled?: boolean;
  preferences?: {
    announcements: boolean;
    chats: boolean;
    tasks: boolean;
  };
}

// ─── Project ──────────────────────────────────────────────────────────────────
export type ProjectStatus = 'active' | 'on_hold' | 'completed';
export type HealthStatus = 'green' | 'amber' | 'red';

export interface Project {
  id: string;
  name: string;
  description: string;
  siteAddress: string;
  clientName: string;
  status: ProjectStatus;
  startDate: Timestamp;
  expectedEndDate: Timestamp;
  actualEndDate?: Timestamp;
  memberIds: string[];
  projectManagerId: string;
  progressPercent: number;
  healthStatus: HealthStatus;
  budget?: number;
  createdAt: Timestamp;
  siteCoordinates?: { latitude: number, longitude: number };
}

// ─── Task ─────────────────────────────────────────────────────────────────────
export type TaskStatus = 'in_progress' | 'under_review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'none';

export interface Subtask {
  id: string;
  title: string;
  isDone: boolean;
  completedBy?: string;
}

export interface TaskComment {
  id: string;
  authorId: string;
  text: string;
  mentions?: string[];
  attachmentUrls?: string[];
  createdAt: Timestamp;
  editedAt?: Timestamp;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string;
  milestoneId?: string;
  assigneeIds: string[];
  assignedRoleId?: string;
  assignedRoleIds?: string[];
  createdBy: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Timestamp;
  estimatedHours: number;
  actualHours?: number;
  tags: string[];
  dependsOn?: string[];
  isRecurring?: boolean;
  recurrenceRule?: string;
  isTemplate?: boolean;
  attachmentUrls?: string[];
  photoUrls?: string[];
  // Approval workflow removed — these remain optional for backward compatibility
  // with existing documents but are no longer set or enforced.
  approvalStatus?: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: Timestamp;
  slaDeadline?: Timestamp;
  slaBreached?: boolean;
  memberProgress?: Record<string, {
    status: TaskStatus;
    updatedAt?: Timestamp;
    actualHours?: number;
    completedBy?: string;
    completedAt?: Timestamp;
    completionStatus?: 'completed' | 'completed_on_time' | 'completed_late';
    delaySeconds?: number;
  }>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
  projectId?: string;
  overtimeOverrideMinutes?: number;
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
  // Mobile-primary field names (source of truth)
  progressNotes: string;
  workerCount: number;
  issuesNotes: string;
  safetyNotes: string;
  temperature?: number;
  photoUrls: string[];
  // Firestore rule for site_diaries checks resource.data.authorId.
  authorId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  // Legacy web fields (for backward compat reading old entries)
  workDone?: string;
  manpower?: number;
  equipment?: string;
  remarks?: string;
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
export interface AuditChange {
  field: string;
  label?: string;
  from?: string | null;
  to?: string | null;
}

export interface AuditLog {
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  actorRole?: string;
  actorAvatar?: string;
  targetId: string;
  targetType: string;
  targetName?: string;
  description: string;
  changes?: AuditChange[];
  meta?: Record<string, unknown>;
  severity?: 'info' | 'warning' | 'critical';
  createdAt: Timestamp;

  // ── legacy aliases kept for any code still reading the old shape ──
  /** @deprecated use actorId */
  userId?: string;
  /** @deprecated use actorName */
  userName?: string;
  /** @deprecated use description */
  details?: string;
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

// ─── Leave Application (log-only, no approval) ──────────────────────────────────
export type LeaveType = 'casual' | 'sick' | 'earned' | 'unpaid' | 'other';

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  roleId?: string;
  type: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  days: number;
  reason: string;
  orgId?: string;
  createdAt?: Timestamp;
}

// ─── Salary Slip ────────────────────────────────────────────────────────────────
export interface SalaryComponent {
  label: string;
  amount: number;
}

export interface SalarySlip {
  id: string;
  userId: string;
  userName: string;
  month: string; // YYYY-MM
  basic: number;
  allowances: SalaryComponent[];
  deductions: SalaryComponent[];
  gross: number;          // basic + sum(allowances)
  totalDeductions: number;
  net: number;            // gross - totalDeductions
  notes?: string;
  createdBy: string;
  createdByName?: string;
  createdAt?: Timestamp;
}

// ─── Expense (simple log) ───────────────────────────────────────────────────────
export type ExpenseCategory =
  | 'materials' | 'labour' | 'transport' | 'equipment' | 'food' | 'office' | 'other';

export interface Expense {
  id: string;
  userId: string;
  userName: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string; // YYYY-MM-DD
  projectId?: string;
  projectName?: string;
  note?: string;
  orgId?: string;
  createdAt?: Timestamp;
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
