-- Create Enum Types
CREATE TYPE IF NOT EXISTS channel_type AS ENUM ('announcement', 'project', 'group', 'direct');
CREATE TYPE IF NOT EXISTS task_status AS ENUM ('todo', 'in_progress', 'review', 'completed');
CREATE TYPE IF NOT EXISTS task_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE IF NOT EXISTS inquiry_status AS ENUM ('new', 'contacted', 'closed');
CREATE TYPE IF NOT EXISTS inquiry_source AS ENUM ('website', 'mobile_app');
CREATE TYPE IF NOT EXISTS leave_type AS ENUM ('casual', 'sick', 'earned', 'unpaid', 'other');
CREATE TYPE IF NOT EXISTS expense_category AS ENUM ('materials', 'labour', 'transport', 'equipment', 'food', 'office', 'other');
CREATE TYPE IF NOT EXISTS review_type AS ENUM ('peer', 'manager');

-- Roles (we might keep roles in Supabase too for RLS joins)
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    permissions TEXT[] DEFAULT '{}',
    level INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    client_name TEXT,
    location TEXT,
    start_date TEXT,
    end_date TEXT,
    status TEXT,
    member_ids TEXT[] DEFAULT '{}',
    manager_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    assigned_to TEXT,
    created_by TEXT,
    status task_status DEFAULT 'todo',
    priority task_priority DEFAULT 'medium',
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    comments TEXT,
    attachments TEXT[] DEFAULT '{}',
    labels TEXT[] DEFAULT '{}',
    is_archived BOOLEAN DEFAULT FALSE,
    rejection_reason TEXT,
    rejection_count INTEGER DEFAULT 0,
    reopen_count INTEGER DEFAULT 0,
    extension_count INTEGER DEFAULT 0,
    original_due_date TIMESTAMP WITH TIME ZONE,
    peer_review_status TEXT,
    manager_review_status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attendance
CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    check_in_time TIMESTAMP WITH TIME ZONE,
    check_out_time TIMESTAMP WITH TIME ZONE,
    check_in_lat DOUBLE PRECISION,
    check_in_lng DOUBLE PRECISION,
    check_out_lat DOUBLE PRECISION,
    check_out_lng DOUBLE PRECISION,
    check_in_address TEXT,
    check_out_address TEXT,
    is_within_geofence BOOLEAN DEFAULT FALSE,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    overtime_override_minutes INTEGER
);

-- Chats
CREATE TABLE IF NOT EXISTS chat_channels (
    id TEXT PRIMARY KEY,
    type channel_type NOT NULL,
    name TEXT,
    description TEXT,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    icon_emoji TEXT,
    member_ids TEXT[] DEFAULT '{}',
    admin_ids TEXT[] DEFAULT '{}',
    created_by TEXT,
    last_message_text TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE,
    last_message_by TEXT,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    channel_id TEXT REFERENCES chat_channels(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    text TEXT NOT NULL,
    reply_to_id TEXT,
    is_edited BOOLEAN DEFAULT FALSE,
    read_by TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_attachments (
    id TEXT PRIMARY KEY,
    message_id TEXT REFERENCES chat_messages(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    size INTEGER NOT NULL,
    uploaded_by TEXT NOT NULL,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    folder_id TEXT,
    labels TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Site Diaries
CREATE TABLE IF NOT EXISTS site_diaries (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    progress_notes TEXT,
    worker_count INTEGER DEFAULT 0,
    issues_notes TEXT,
    safety_notes TEXT,
    temperature DOUBLE PRECISION,
    photo_urls TEXT[] DEFAULT '{}',
    author_id TEXT NOT NULL,
    work_done TEXT,
    manpower INTEGER,
    equipment TEXT,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leave Requests
CREATE TABLE IF NOT EXISTS leave_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    role_id TEXT,
    type leave_type NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    days DOUBLE PRECISION NOT NULL,
    reason TEXT,
    org_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Salary Slips
CREATE TABLE IF NOT EXISTS salary_slips (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    month TEXT NOT NULL,
    basic DOUBLE PRECISION NOT NULL,
    allowances JSONB DEFAULT '[]',
    deductions JSONB DEFAULT '[]',
    gross DOUBLE PRECISION NOT NULL,
    total_deductions DOUBLE PRECISION NOT NULL,
    net DOUBLE PRECISION NOT NULL,
    notes TEXT,
    created_by TEXT NOT NULL,
    created_by_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    title TEXT NOT NULL,
    category expense_category NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    date TEXT NOT NULL,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    project_name TEXT,
    note TEXT,
    org_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contact Inquiries
CREATE TABLE IF NOT EXISTS contact_inquiries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    project_type TEXT,
    message TEXT NOT NULL,
    status inquiry_status DEFAULT 'new',
    source inquiry_source DEFAULT 'website',
    assigned_to TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS app_notifications (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    user_id TEXT NOT NULL,
    is_read JSONB DEFAULT '{}',
    type TEXT NOT NULL,
    related_id TEXT,
    related_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_role TEXT,
    actor_avatar TEXT,
    target_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_name TEXT,
    description TEXT NOT NULL,
    changes JSONB DEFAULT '[]',
    meta JSONB DEFAULT '{}',
    severity TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance Reviews
CREATE TABLE IF NOT EXISTS performance_reviews (
    id TEXT PRIMARY KEY,
    task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
    reviewer_id TEXT NOT NULL,
    reviewee_id TEXT NOT NULL,
    type review_type NOT NULL,
    score INTEGER NOT NULL,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

