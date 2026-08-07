const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = '/Users/amalchand/Desktop/Kurical TMS/kurikal-tms-app-firebase-adminsdk-fbsvc-50a1948b26.json';
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ts(date) {
  return admin.firestore.Timestamp.fromDate(date instanceof Date ? date : new Date(date));
}
function str(v)  { return String(v); }
function bool(v) { return Boolean(v); }
function int(v)  { return Math.round(v); }
function nul()   { return null; }
function arr(items) { return items.length ? items : []; }
function map(fields) { return fields; }

function strArr(items) {
  return items.map(String);
}

function daysFromNow(d) {
  const dt = new Date();
  dt.setDate(dt.getDate() + d);
  return dt;
}

function daysAgo(d) { return daysFromNow(-d); }

// ─── Role Definitions ─────────────────────────────────────────────────────────

function buildPermissions(overrides) {
  const defaults = {
    tasks_view: false, tasks_create: false, tasks_edit: false,
    tasks_delete: false, tasks_approve: false,
    projects_view: false, projects_create: false, projects_edit: false,
    docs_view: false, docs_upload: false, docs_approve: false,
    team_view: false, team_manage: false,
    reports_view: false, reports_export: false,
    roles_manage: false, settings_manage: false,
    time_log: false, time_view_all: false,
    notifications_manage: false,
    chat_view: true, chat_send: true,
    chat_create_group: false, chat_announce: false, chat_moderate: false,
    attendance_view_all: false,
  };
  const merged = { ...defaults, ...overrides };
  return merged;
}

const ROLES = [
  {
    id: "director",
    name: "Director / Owner",
    description: "Full access to all features, reports, settings and team",
    color: "#1A3A5C",
    level: 100,
    permissions: buildPermissions({
      tasks_view: true, tasks_create: true, tasks_edit: true, tasks_delete: true, tasks_approve: true,
      projects_view: true, projects_create: true, projects_edit: true, projects_delete: true,
      docs_view: true, docs_upload: true, docs_approve: true,
      team_view: true, team_manage: true, team_delete: true,
      reports_view: true, reports_export: true,
      roles_manage: true, settings_manage: true,
      time_log: true, time_view_all: true,
      notifications_manage: true,
      chat_create_group: true, chat_announce: true, chat_moderate: true,
      attendance_view_all: true,
    }),
  },
  {
    id: "project_manager",
    name: "Project Manager",
    description: "Manages projects, tasks, team and approvals",
    color: "#2196F3",
    level: 70,
    permissions: buildPermissions({
      tasks_view: true, tasks_create: true, tasks_edit: true, tasks_delete: true, tasks_approve: true,
      projects_view: true, projects_create: true, projects_edit: true,
      docs_view: true, docs_upload: true, docs_approve: true,
      team_view: true, team_manage: true,
      reports_view: true, reports_export: true,
      time_log: true, time_view_all: true,
      notifications_manage: true,
      chat_create_group: true,
    }),
  },
  {
    id: "site_engineer",
    name: "Site Engineer",
    description: "Creates tasks, logs site progress, manages documents",
    color: "#009688",
    level: 50,
    permissions: buildPermissions({
      tasks_view: true, tasks_create: true, tasks_edit: true,
      projects_view: true,
      docs_view: true, docs_upload: true,
      team_view: true,
      reports_view: true,
      time_log: true,
    }),
  },
  {
    id: "foreman",
    name: "Foreman",
    description: "Updates assigned tasks, logs time, views site plans",
    color: "#F59E0B",
    level: 30,
    permissions: buildPermissions({
      tasks_view: true, tasks_edit: true,
      projects_view: true,
      docs_view: true,
      team_view: true,
      time_log: true,
    }),
  },
  {
    id: "labour",
    name: "Labour",
    description: "Views assigned tasks and logs attendance",
    color: "#9E9E9E",
    level: 10,
    permissions: buildPermissions({
      tasks_view: true,
      time_log: true,
      chat_send: true,
    }),
  },
  {
    id: "admin",
    name: "Admin",
    description: "Manages users, roles, system settings and notifications",
    color: "#9C27B0",
    level: 90,
    permissions: buildPermissions({
      tasks_view: true, tasks_delete: true,
      projects_view: true,
      docs_view: true,
      team_view: true, team_manage: true,
      reports_view: true, reports_export: true,
      roles_manage: true, settings_manage: true,
      time_view_all: true,
      notifications_manage: true,
      chat_create_group: true, chat_moderate: true,
    }),
  },
  {
    id: "accounts",
    name: "Accounts",
    description: "Views financial reports, invoices and project budgets",
    color: "#E11D48",
    level: 60,
    permissions: buildPermissions({
      tasks_view: true,
      projects_view: true,
      docs_view: true, docs_upload: true,
      team_view: true,
      reports_view: true, reports_export: true,
      time_view_all: true,
    }),
  },
];

// ─── User Definitions ─────────────────────────────────────────────────────────

const USERS_DEF = [
  { name: "Thomas Kurickal", email: "thomas@kurickaldevelopers.com", phone: "+919876543210", roleId: "director" },
  { name: "Ravi Nair",       email: "ravi@kurickaldevelopers.com",   phone: "+919876543211", roleId: "project_manager" },
  { name: "Arjun Menon",     email: "arjun@kurickaldevelopers.com",  phone: "+919876543212", roleId: "site_engineer" },
  { name: "Priya Pillai",    email: "priya@kurickaldevelopers.com",  phone: "+919876543213", roleId: "site_engineer" },
  { name: "Suresh Kumar",    email: "suresh@kurickaldevelopers.com", phone: "+919876543214", roleId: "foreman" },
  { name: "Biju Thomas",     email: "biju@kurickaldevelopers.com",   phone: "+919876543215", roleId: "labour" },
  { name: "Meena George",    email: "meena@kurickaldevelopers.com",  phone: "+919876543216", roleId: "admin" },
  { name: "Anitha Raj",      email: "anitha@kurickaldevelopers.com", phone: "+919876543217", roleId: "accounts" },
];

const PASSWORD = "Kurickal@2024";

// ─── Main Seed Function ───────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║  Kurickal TMS — Admin SDK Database Seed Script   ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // ── 1. Roles ────────────────────────────────────────────────────────────────
  console.log("📋 Seeding roles...");
  for (const role of ROLES) {
    const roleDoc = {
      name: str(role.name),
      description: str(role.description),
      color: str(role.color),
      level: int(role.level),
      isSystem: bool(true),
      createdBy: str("system"),
      createdAt: ts(new Date()),
      permissions: role.permissions,
    };
    await db.collection("roles").doc(role.id).set(roleDoc, { merge: true });
    console.log(`  ✓ Role: ${role.name}`);
  }

  // ── 2. Auth Users + Firestore User Docs ─────────────────────────────────────
  console.log("\n👤 Seeding users...");
  const uids = {}; // name → uid

  for (const user of USERS_DEF) {
    let uid;
    try {
      const existingUser = await auth.getUserByEmail(user.email);
      uid = existingUser.uid;
      console.log(`  ↩ User already exists in Auth: ${user.email} (${uid})`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        const newUser = await auth.createUser({
          email: user.email,
          password: PASSWORD,
          displayName: user.name,
          phoneNumber: user.phone,
        });
        uid = newUser.uid;
        console.log(`  ✓ Created user in Auth: ${user.email} (${uid})`);
      } else {
        throw error;
      }
    }
    uids[user.name] = uid;

    const userDoc = {
      name: str(user.name),
      email: str(user.email),
      phone: str(user.phone),
      roleId: str(user.roleId),
      avatarUrl: nul(),
      projectIds: arr([]),   // filled in after projects are created
      fcmToken: nul(),
      isActive: bool(true),
      biometricEnabled: bool(false),
      createdAt: ts(daysAgo(90)),
      lastLoginAt: ts(new Date()),
    };
    await db.collection("users").doc(uid).set(userDoc, { merge: true });
    console.log(`  ✓ Firestore user doc: ${user.name} [${user.roleId}]`);
  }

  // Convenience UID accessors
  const uid = (name) => uids[name] || "";
  const thomasUid  = uid("Thomas Kurickal");
  const raviUid    = uid("Ravi Nair");
  const arjunUid   = uid("Arjun Menon");
  const priyaUid   = uid("Priya Pillai");
  const sureshUid  = uid("Suresh Kumar");
  const bijuUid    = uid("Biju Thomas");
  const meenaUid   = uid("Meena George");
  const anithaUid  = uid("Anitha Raj");

  // ── 3. Projects ─────────────────────────────────────────────────────────────
  console.log("\n🏗️  Seeding projects...");

  // Project 1: Kurickal Residences Phase 1
  const proj1Members = [thomasUid, raviUid, arjunUid, sureshUid, bijuUid, priyaUid];
  const proj1Ref = await db.collection("projects").add({
    name:             str("Kurickal Residences Phase 1"),
    description:      str("G+3 residential apartment complex with 24 units, underground parking and rooftop garden. Client: Mr. Thomas Kurickal"),
    siteAddress:      str("Plot 24, Kakkanad Industrial Estate, Kochi - 682030"),
    clientName:       str("Thomas Kurickal"),
    projectManagerId: str(raviUid),
    memberIds:        strArr(proj1Members),
    status:           str("active"),
    startDate:        ts(daysAgo(180)),
    expectedEndDate:  ts(daysFromNow(120)),
    actualEndDate:    nul(),
    progressPercent:  int(65),
    healthStatus:     str("green"),
    createdAt:        ts(daysAgo(185)),
    siteCoordinates:  nul(),
  });
  const proj1Id = proj1Ref.id;
  console.log(`  ✓ Project 1: Kurickal Residences Phase 1 [${proj1Id}]`);

  // Project 2: Commercial Complex Edappally
  const proj2Members = [thomasUid, raviUid, arjunUid, priyaUid, sureshUid];
  const proj2Ref = await db.collection("projects").add({
    name:             str("Commercial Complex Edappally"),
    description:      str("4-storey commercial complex with retail shops, office spaces and basement parking. Client: Edappally Builders Pvt Ltd"),
    siteAddress:      str("NH-66 Bypass, Edappally Junction, Kochi - 682024"),
    clientName:       str("Edappally Builders Pvt Ltd"),
    projectManagerId: str(raviUid),
    memberIds:        strArr(proj2Members),
    status:           str("active"),
    startDate:        ts(daysAgo(90)),
    expectedEndDate:  ts(daysFromNow(270)),
    actualEndDate:    nul(),
    progressPercent:  int(30),
    healthStatus:     str("amber"),
    createdAt:        ts(daysAgo(95)),
    siteCoordinates:  nul(),
  });
  const proj2Id = proj2Ref.id;
  console.log(`  ✓ Project 2: Commercial Complex Edappally [${proj2Id}]`);

  // Project 3: Villa Project Thrissur
  const proj3Members = [thomasUid, raviUid, priyaUid, sureshUid, bijuUid];
  const proj3Ref = await db.collection("projects").add({
    name:             str("Kurickal Villa Thrissur"),
    description:      str("Luxury 5-bedroom villa with pool, landscaping and home automation. Currently on hold pending revised drawings approval."),
    siteAddress:      str("Pottore Road, Thrissur - 680001"),
    clientName:       str("Dr. Reji Mathew"),
    projectManagerId: str(raviUid),
    memberIds:        strArr(proj3Members),
    status:           str("on_hold"),
    startDate:        ts(daysAgo(210)),
    expectedEndDate:  ts(daysFromNow(90)),
    actualEndDate:    nul(),
    progressPercent:  int(48),
    healthStatus:     str("red"),
    createdAt:        ts(daysAgo(215)),
    siteCoordinates:  nul(),
  });
  const proj3Id = proj3Ref.id;
  console.log(`  ✓ Project 3: Kurickal Villa Thrissur [${proj3Id}]`);

  // Update projectIds on each user doc
  console.log("\n🔗 Linking project IDs to users...");
  const userProjectMap = {
    [thomasUid]:  [proj1Id, proj2Id, proj3Id],
    [raviUid]:    [proj1Id, proj2Id, proj3Id],
    [arjunUid]:   [proj1Id, proj2Id],
    [priyaUid]:   [proj1Id, proj2Id, proj3Id],
    [sureshUid]:  [proj1Id, proj2Id, proj3Id],
    [bijuUid]:    [proj1Id, proj3Id],
    [meenaUid]:   [proj1Id, proj2Id, proj3Id],
    [anithaUid]:  [proj1Id, proj2Id, proj3Id],
  };
  for (const [uid, projIds] of Object.entries(userProjectMap)) {
    if (uid) {
      await db.collection("users").doc(uid).set({ projectIds: strArr(projIds) }, { merge: true });
    }
  }
  console.log("  ✓ All user projectIds updated");

  // ── 4. Milestones ────────────────────────────────────────────────────────────
  console.log("\n🏁 Seeding milestones...");

  const proj1Milestones = [
    { name: "Foundation & Substructure",   phase: "foundation", status: "completed", progress: 100, due: daysAgo(90),  completedAt: daysAgo(85) },
    { name: "RCC Frame & Columns",         phase: "structure",  status: "completed", progress: 100, due: daysAgo(30),  completedAt: daysAgo(25) },
    { name: "Brick Masonry & Plastering",  phase: "structure",  status: "in_progress", progress: 70,  due: daysFromNow(20) },
    { name: "MEP Rough-In Works",          phase: "mep",        status: "in_progress", progress: 40,  due: daysFromNow(45) },
    { name: "Finishing & Handover",        phase: "finishing",  status: "pending",     progress: 0,   due: daysFromNow(120) },
  ];

  for (const m of proj1Milestones) {
    const fields = {
      name: str(m.name), phase: str(m.phase),
      dueDate: ts(m.due), status: str(m.status),
      progressPercent: int(m.progress),
      completedAt: m.completedAt ? ts(m.completedAt) : nul(),
    };
    await db.collection("projects").doc(proj1Id).collection("milestones").add(fields);
  }
  console.log("  ✓ Proj 1 milestones");

  const proj2Milestones = [
    { name: "Excavation & Foundation",    phase: "foundation", status: "completed",   progress: 100, due: daysAgo(60),  completedAt: daysAgo(55) },
    { name: "Ground Floor Structure",     phase: "structure",  status: "in_progress", progress: 60,  due: daysFromNow(30) },
    { name: "Upper Floors Construction",  phase: "structure",  status: "pending",     progress: 0,   due: daysFromNow(120) },
    { name: "MEP & Utilities",            phase: "mep",        status: "pending",     progress: 0,   due: daysFromNow(210) },
    { name: "Fit-Out & Handover",         phase: "finishing",  status: "pending",     progress: 0,   due: daysFromNow(270) },
  ];
  for (const m of proj2Milestones) {
    const fields = {
      name: str(m.name), phase: str(m.phase),
      dueDate: ts(m.due), status: str(m.status),
      progressPercent: int(m.progress),
      completedAt: m.completedAt ? ts(m.completedAt) : nul(),
    };
    await db.collection("projects").doc(proj2Id).collection("milestones").add(fields);
  }
  console.log("  ✓ Proj 2 milestones");

  // ── 5. Tasks ─────────────────────────────────────────────────────────────────
  console.log("\n✅ Seeding tasks...");

  const tasks = [
    // ── Project 1 tasks ──
    {
      title: "Install formwork for roof slab — Block A",
      description: "Set up plywood formwork and props for 150mm thick roof slab on Block A 3rd floor. Mix design M25.",
      projectId: proj1Id, createdBy: raviUid, assigneeIds: [arjunUid, sureshUid],
      status: "in_progress", priority: "high",
      dueDate: daysFromNow(5), estimatedHours: 16,
      tags: ["rcc", "formwork", "block-a"],
      approvalStatus: "not_required",
    },
    {
      title: "Complete brick masonry — 2nd floor west wing",
      description: "230mm thick brick masonry work for west wing rooms 201–210. Use M1 mortar mix.",
      projectId: proj1Id, createdBy: arjunUid, assigneeIds: [sureshUid, bijuUid],
      status: "in_progress", priority: "medium",
      dueDate: daysFromNow(8), estimatedHours: 24,
      tags: ["masonry", "brickwork"],
      approvalStatus: "not_required",
    },
    {
      title: "Electrical conduit laying — all floors",
      description: "Lay concealed PVC conduits (25mm & 32mm) as per electrical drawing Rev-C before plastering begins.",
      projectId: proj1Id, createdBy: raviUid, assigneeIds: [arjunUid],
      status: "review", priority: "high",
      dueDate: daysFromNow(3), estimatedHours: 40,
      tags: ["electrical", "mep"],
      approvalStatus: "pending",
    },
    {
      title: "Internal plastering — ground floor",
      description: "12mm cement mortar plaster for all internal walls. Curing for 7 days required.",
      projectId: proj1Id, createdBy: arjunUid, assigneeIds: [sureshUid, bijuUid],
      status: "assigned", priority: "medium",
      dueDate: daysFromNow(15), estimatedHours: 32,
      tags: ["plastering", "finishing"],
      approvalStatus: "not_required",
    },
    {
      title: "Procure and deliver M-Sand — 50 loads",
      description: "Source M-Sand from approved quarry and ensure 50 loads are delivered to site before Thursday.",
      projectId: proj1Id, createdBy: raviUid, assigneeIds: [raviUid],
      status: "done", priority: "high",
      dueDate: daysAgo(2), estimatedHours: 4,
      tags: ["procurement", "materials"],
      approvalStatus: "not_required",
    },
    {
      title: "Waterproofing — terrace & wet areas",
      description: "Apply 2-coat crystalline waterproofing on terrace and bathroom wet areas. Test for 48-hour ponding.",
      projectId: proj1Id, createdBy: raviUid, assigneeIds: [arjunUid, priyaUid],
      status: "created", priority: "high",
      dueDate: daysFromNow(25), estimatedHours: 20,
      tags: ["waterproofing", "terrace"],
      approvalStatus: "not_required",
    },

    // ── Project 2 tasks ──
    {
      title: "Ground floor column concreting",
      description: "Concrete pour for 18 columns (400×400mm) using M30 mix. Ensure vibration and curing.",
      projectId: proj2Id, createdBy: raviUid, assigneeIds: [arjunUid, sureshUid],
      status: "in_progress", priority: "critical",
      dueDate: daysFromNow(2), estimatedHours: 20,
      tags: ["rcc", "columns", "ground-floor"],
      approvalStatus: "not_required",
    },
    {
      title: "Basement waterproofing inspection",
      description: "Inspect completed basement waterproofing before backfilling. Check for cracks and water seepage.",
      projectId: proj2Id, createdBy: priyaUid, assigneeIds: [priyaUid, raviUid],
      status: "review", priority: "high",
      dueDate: daysAgo(1), estimatedHours: 4,
      tags: ["waterproofing", "inspection", "basement"],
      approvalStatus: "pending",
    },
    {
      title: "Prepare shop drawings — structural steel",
      description: "Coordinate with structural engineer and prepare shop drawings for 1st floor steel beams.",
      projectId: proj2Id, createdBy: raviUid, assigneeIds: [priyaUid],
      status: "in_progress", priority: "medium",
      dueDate: daysFromNow(7), estimatedHours: 16,
      tags: ["drawings", "structural"],
      approvalStatus: "not_required",
    },
    {
      title: "Site drainage and stormwater layout",
      description: "Lay perforated PVC drainage pipes and connect to municipal storm drain as per drainage plan.",
      projectId: proj2Id, createdBy: arjunUid, assigneeIds: [sureshUid, bijuUid],
      status: "assigned", priority: "low",
      dueDate: daysFromNow(30), estimatedHours: 12,
      tags: ["drainage", "civil"],
      approvalStatus: "not_required",
    },

    // ── Project 3 tasks ──
    {
      title: "Review architect's revised drawings",
      description: "Client has requested changes to the pool area and master bedroom layout. Review Rev-D drawings and raise queries.",
      projectId: proj3Id, createdBy: thomasUid, assigneeIds: [raviUid, priyaUid],
      status: "in_progress", priority: "high",
      dueDate: daysFromNow(3), estimatedHours: 6,
      tags: ["drawings", "design"],
      approvalStatus: "not_required",
    },
    {
      title: "Tile flooring — ground floor bedrooms",
      description: "Lay 800×800mm vitrified tiles in GF bedrooms 1 & 2. Use tile adhesive and grout as per spec.",
      projectId: proj3Id, createdBy: priyaUid, assigneeIds: [sureshUid, bijuUid],
      status: "on_hold", priority: "medium",
      dueDate: daysFromNow(14), estimatedHours: 28,
      tags: ["tiling", "finishing"],
      approvalStatus: "not_required",
    },
    {
      title: "Swimming pool shotcrete work",
      description: "Apply 150mm reinforced shotcrete for pool shell. Waterproof coating after 14-day cure.",
      projectId: proj3Id, createdBy: raviUid, assigneeIds: [arjunUid, sureshUid],
      status: "on_hold", priority: "high",
      dueDate: daysFromNow(21), estimatedHours: 32,
      tags: ["pool", "shotcrete"],
      approvalStatus: "not_required",
    },
  ];

  const taskIds = [];
  for (const t of tasks) {
    const taskRef = await db.collection("tasks").add({
      title:          str(t.title),
      description:    str(t.description),
      projectId:      str(t.projectId),
      milestoneId:    nul(),
      assigneeIds:    strArr(t.assigneeIds),
      createdBy:      str(t.createdBy),
      status:         str(t.status),
      priority:       str(t.priority),
      dueDate:        ts(t.dueDate),
      estimatedHours: int(t.estimatedHours),
      actualHours:    int(0),
      tags:           strArr(t.tags),
      dependsOn:      arr([]),
      isRecurring:    bool(false),
      recurrenceRule: nul(),
      isTemplate:     bool(false),
      attachmentUrls: arr([]),
      photoUrls:      arr([]),
      approvalStatus: str(t.approvalStatus),
      approvedBy:     nul(),
      approvedAt:     nul(),
      slaDeadline:    nul(),
      slaBreached:    bool(false),
      createdAt:      ts(daysAgo(Math.floor(Math.random() * 10) + 1)),
      updatedAt:      ts(new Date()),
    });
    taskIds.push(taskRef.id);
    console.log(`  ✓ Task: "${t.title.substring(0, 50)}"`);
  }

  // Add subtasks to first task
  const firstTaskId = taskIds[0];
  if (firstTaskId) {
    const subtasks = [
      { title: "Set up base props and runners", isDone: true, doneBy: sureshUid },
      { title: "Lay plywood sheets and oil", isDone: true, doneBy: sureshUid },
      { title: "Fix formwork edges and joints", isDone: false },
      { title: "Engineer inspection sign-off", isDone: false },
    ];
    for (const sub of subtasks) {
      await db.collection("tasks").doc(firstTaskId).collection("subtasks").add({
        title:  str(sub.title),
        isDone: bool(sub.isDone),
        doneAt: sub.isDone ? ts(daysAgo(1)) : nul(),
        doneBy: sub.doneBy ? str(sub.doneBy) : nul(),
      });
    }
    console.log("  ✓ Subtasks added to task 1");

    // Add a comment
    await db.collection("tasks").doc(firstTaskId).collection("comments").add({
      authorId:  str(arjunUid),
      text:      str("Props are set. Plywood inspection done. Ready for formwork edge fixing."),
      createdAt: ts(daysAgo(1)),
      updatedAt: ts(daysAgo(1)),
      isEdited:  bool(false),
    });
    console.log("  ✓ Comment added to task 1");
  }

  // ── 6. Chat Channels ─────────────────────────────────────────────────────────
  console.log("\n💬 Seeding chat channels...");
  const allUids = [thomasUid, raviUid, arjunUid, priyaUid, sureshUid, bijuUid, meenaUid, anithaUid];

  function buildUnreadCounts(members, senderUid, count = 1) {
    const fields = {};
    for (const u of members) {
      fields[u] = int(u === senderUid ? 0 : count);
    }
    return fields;
  }

  // Channel 1: Company Announcements
  await db.collection("chats").doc("ch_announcements").set({
    type:            str("announcement"),
    name:            str("Company Announcements"),
    description:     str("Official announcements from Kurickal Developers LLP management"),
    projectId:       nul(),
    iconEmoji:       str("📢"),
    memberIds:       strArr(allUids),
    adminIds:        strArr([thomasUid, meenaUid]),
    createdBy:       str(thomasUid),
    createdAt:       ts(daysAgo(60)),
    lastMessageText: str("Welcome to Kurickal Developers LLP. This channel is for official announcements only. Please keep conversations respectful and professional."),
    lastMessageAt:   ts(daysAgo(30)),
    lastMessageBy:   str(thomasUid),
    isArchived:      bool(false),
    unreadCounts:    buildUnreadCounts(allUids, thomasUid, 1),
  }, { merge: true });
  // Seed the announcement message
  await db.collection("chats").doc("ch_announcements").collection("messages").add({
    channelId:          str("ch_announcements"),
    senderId:           str(thomasUid),
    text:               str("Welcome to Kurickal Developers LLP. This channel is for official announcements only. Please keep conversations respectful and professional."),
    type:               str("system"),
    attachmentUrl:      nul(),
    attachmentName:     nul(),
    attachmentMimeType: nul(),
    attachmentSize:     nul(),
    taskId:             nul(),
    taskTitle:          nul(),
    taskProjectId:      nul(),
    taskStatus:         nul(),
    replyToId:          nul(),
    replyToText:        nul(),
    replyToSenderId:    nul(),
    replyToSenderName:  nul(),
    reactions:          map({}),
    editedAt:           nul(),
    isDeleted:          bool(false),
    createdAt:          ts(daysAgo(30)),
  });
  console.log("  ✓ Company Announcements channel");

  // Channel 2: Project 1 channel
  await db.collection("chats").doc(`proj_${proj1Id}`).set({
    type:            str("project"),
    name:            str("Kurickal Residences Ph.1"),
    description:     str("Project channel for Kurickal Residences Phase 1 — Kakkanad"),
    projectId:       str(proj1Id),
    iconEmoji:       str("🏗️"),
    memberIds:       strArr(proj1Members),
    adminIds:        strArr([raviUid, thomasUid]),
    createdBy:       str(raviUid),
    createdAt:       ts(daysAgo(180)),
    lastMessageText: str("Formwork inspection scheduled tomorrow 8AM. All team on site please."),
    lastMessageAt:   ts(daysAgo(0)),
    lastMessageBy:   str(raviUid),
    isArchived:      bool(false),
    unreadCounts:    buildUnreadCounts(proj1Members, raviUid, 2),
  }, { merge: true });
  for (const msg of [
    { sender: raviUid, text: "Project channel is now active. All site updates to be posted here.", daysAgo_: 180 },
    { sender: arjunUid, text: "Foundation work completed. Cube test results are satisfactory. Moving to column work.", daysAgo_: 85 },
    { sender: sureshUid, text: "Brickwork for 2nd floor west wing started. 4 masons on site today.", daysAgo_: 10 },
    { sender: priyaUid, text: "Electrical conduit drawing Rev-C received. Sharing with the team.", daysAgo_: 5 },
    { sender: raviUid, text: "Formwork inspection scheduled tomorrow 8AM. All team on site please.", daysAgo_: 0 },
  ]) {
    await db.collection("chats").doc(`proj_${proj1Id}`).collection("messages").add({
      channelId: str(`proj_${proj1Id}`), senderId: str(msg.sender),
      text: str(msg.text), type: str("text"),
      attachmentUrl: nul(), attachmentName: nul(), attachmentMimeType: nul(), attachmentSize: nul(),
      taskId: nul(), taskTitle: nul(), taskProjectId: nul(), taskStatus: nul(),
      replyToId: nul(), replyToText: nul(), replyToSenderId: nul(), replyToSenderName: nul(),
      reactions: map({}), editedAt: nul(), isDeleted: bool(false),
      createdAt: ts(daysAgo(msg.daysAgo_)),
    });
  }
  console.log("  ✓ Kurickal Residences Ph.1 channel");

  // Channel 3: Project 2 channel
  await db.collection("chats").doc(`proj_${proj2Id}`).set({
    type:            str("project"),
    name:            str("Commercial Complex Edappally"),
    description:     str("Project channel for Commercial Complex Edappally"),
    projectId:       str(proj2Id),
    iconEmoji:       str("🏢"),
    memberIds:       strArr(proj2Members),
    adminIds:        strArr([raviUid, thomasUid]),
    createdBy:       str(raviUid),
    createdAt:       ts(daysAgo(90)),
    lastMessageText: str("Foundation work completed on Block A. Starting column work from Monday. Labour deployed: 18 workers."),
    lastMessageAt:   ts(daysAgo(3)),
    lastMessageBy:   str(arjunUid),
    isArchived:      bool(false),
    unreadCounts:    buildUnreadCounts(proj2Members, arjunUid, 1),
  }, { merge: true });
  for (const msg of [
    { sender: raviUid, text: "Commercial Complex project channel is live. Site office set up at main gate.", daysAgo_: 90 },
    { sender: arjunUid, text: "Excavation completed. Soil report is satisfactory for the raft foundation.", daysAgo_: 55 },
    { sender: priyaUid, text: "Basement waterproofing done. Need PM inspection before we backfill.", daysAgo_: 3 },
    { sender: arjunUid, text: "Foundation work completed on Block A. Starting column work from Monday. Labour deployed: 18 workers.", daysAgo_: 3 },
  ]) {
    await db.collection("chats").doc(`proj_${proj2Id}`).collection("messages").add({
      channelId: str(`proj_${proj2Id}`), senderId: str(msg.sender),
      text: str(msg.text), type: str("text"),
      attachmentUrl: nul(), attachmentName: nul(), attachmentMimeType: nul(), attachmentSize: nul(),
      taskId: nul(), taskTitle: nul(), taskProjectId: nul(), taskStatus: nul(),
      replyToId: nul(), replyToText: nul(), replyToSenderId: nul(), replyToSenderName: nul(),
      reactions: map({}), editedAt: nul(), isDeleted: bool(false),
      createdAt: ts(daysAgo(msg.daysAgo_)),
    });
  }
  console.log("  ✓ Commercial Complex Edappally channel");

  // Channel 4: Site Engineers group
  const siteEngrMembers = [thomasUid, raviUid, arjunUid, priyaUid];
  await db.collection("chats").doc("ch_site_engineers").set({
    type:            str("group"),
    name:            str("Site Engineers"),
    description:     str("Technical discussions, drawing reviews and site issue escalations"),
    projectId:       nul(),
    iconEmoji:       str("📐"),
    memberIds:       strArr(siteEngrMembers),
    adminIds:        strArr([raviUid]),
    createdBy:       str(raviUid),
    createdAt:       ts(daysAgo(45)),
    lastMessageText: str("Revised structural drawings uploaded to Documents. Please review."),
    lastMessageAt:   ts(daysAgo(2)),
    lastMessageBy:   str(priyaUid),
    isArchived:      bool(false),
    unreadCounts:    buildUnreadCounts(siteEngrMembers, priyaUid, 1),
  }, { merge: true });
  await db.collection("chats").doc("ch_site_engineers").collection("messages").add({
    channelId: str("ch_site_engineers"), senderId: str(raviUid),
    text: str("Engineers group created for technical discussions. Use this for drawing queries, site issues and design clarifications."),
    type: str("text"),
    attachmentUrl: nul(), attachmentName: nul(), attachmentMimeType: nul(), attachmentSize: nul(),
    taskId: nul(), taskTitle: nul(), taskProjectId: nul(), taskStatus: nul(),
    replyToId: nul(), replyToText: nul(), replyToSenderId: nul(), replyToSenderName: nul(),
    reactions: map({ "👍": arr([arjunUid, priyaUid].map(str)) }),
    editedAt: nul(), isDeleted: bool(false),
    createdAt: ts(daysAgo(45)),
  });
  await db.collection("chats").doc("ch_site_engineers").collection("messages").add({
    channelId: str("ch_site_engineers"), senderId: str(priyaUid),
    text: str("Revised structural drawings uploaded to Documents. Please review."),
    type: str("text"),
    attachmentUrl: nul(), attachmentName: nul(), attachmentMimeType: nul(), attachmentSize: nul(),
    taskId: nul(), taskTitle: nul(), taskProjectId: nul(), taskStatus: nul(),
    replyToId: nul(), replyToText: nul(), replyToSenderId: nul(), replyToSenderName: nul(),
    reactions: map({}), editedAt: nul(), isDeleted: bool(false),
    createdAt: ts(daysAgo(2)),
  });
  console.log("  ✓ Site Engineers group channel");

  // DM: Ravi ↔ Thomas
  const dmIds = [raviUid, thomasUid].sort();
  const dmId = `dm_${dmIds[0]}_${dmIds[1]}`;
  await db.collection("chats").doc(dmId).set({
    type:            str("direct"),
    name:            str(""),
    description:     str(""),
    projectId:       nul(),
    iconEmoji:       nul(),
    memberIds:       strArr([raviUid, thomasUid]),
    adminIds:        arr([]),
    createdBy:       str(raviUid),
    createdAt:       ts(daysAgo(30)),
    lastMessageText: str("The waterproofing issue has been fixed. Will update you with photos."),
    lastMessageAt:   ts(daysAgo(1)),
    lastMessageBy:   str(raviUid),
    isArchived:      bool(false),
    unreadCounts:    buildUnreadCounts([raviUid, thomasUid], raviUid, 1),
  }, { merge: true });
  for (const msg of [
    { sender: thomasUid, text: "Ravi, what's the update on the Kakkanad terrace waterproofing issue?", daysAgo_: 2 },
    { sender: raviUid, text: "The waterproofing issue has been fixed. Will update you with photos.", daysAgo_: 1 },
  ]) {
    await db.collection("chats").doc(dmId).collection("messages").add({
      channelId: str(dmId), senderId: str(msg.sender),
      text: str(msg.text), type: str("text"),
      attachmentUrl: nul(), attachmentName: nul(), attachmentMimeType: nul(), attachmentSize: nul(),
      taskId: nul(), taskTitle: nul(), taskProjectId: nul(), taskStatus: nul(),
      replyToId: nul(), replyToText: nul(), replyToSenderId: nul(), replyToSenderName: nul(),
      reactions: map({}), editedAt: nul(), isDeleted: bool(false),
      createdAt: ts(daysAgo(msg.daysAgo_)),
    });
  }
  console.log("  ✓ DM: Thomas ↔ Ravi");

  // ── 7. Site Diary Entries ────────────────────────────────────────────────────
  console.log("\n📋 Seeding site diary entries...");

  const diaryEntries = [
    {
      projectId: proj1Id, authorId: arjunUid,
      date: daysAgo(2), weather: "sunny", workerCount: 22,
      progressNotes: "Brickwork completed for rooms 205-208. Lintel casting done for 2nd floor east wing. RMC batch test passed (cube strength 28.4 N/mm²).",
      issuesNotes: "M-Sand stock running low. Ordered 20 loads for tomorrow.",
      safetyNotes: "Safety briefing conducted. All workers wearing PPE. No incidents.",
    },
    {
      projectId: proj1Id, authorId: arjunUid,
      date: daysAgo(1), weather: "partlyCloudy", workerCount: 18,
      progressNotes: "Electrical conduit laying started on 2nd floor. 60% complete. Plumbing stub-outs marked for bathrooms.",
      issuesNotes: "One scaffolding bracket found damaged — replaced immediately.",
      safetyNotes: "Scaffold inspection done by foreman. All clear.",
    },
    {
      projectId: proj2Id, authorId: priyaUid,
      date: daysAgo(3), weather: "cloudy", workerCount: 15,
      progressNotes: "Basement waterproofing completed on north wall. Testing by ponding started.",
      issuesNotes: "Minor crack found at column base C-7. Reported to structural engineer for review.",
      safetyNotes: "Barricading around excavation renewed. Warning signs updated.",
    },
    {
      projectId: proj2Id, authorId: priyaUid,
      date: daysAgo(1), weather: "rainy", workerCount: 8,
      progressNotes: "Work suspended due to rain from 12PM. Morning session: rebar cutting and bending for ground floor columns.",
      issuesNotes: "Rain water accumulation in basement — pump deployed.",
      safetyNotes: "Site secured. Non-essential workers sent home due to weather.",
    },
  ];

  for (const e of diaryEntries) {
    const dateStr = e.date.toISOString().substring(0, 10);
    await db.collection("site_diary").add({
      projectId:     str(e.projectId),
      authorId:      str(e.authorId),
      date:          str(dateStr),
      weather:       str(e.weather),
      workerCount:   int(e.workerCount),
      progressNotes: str(e.progressNotes),
      issuesNotes:   str(e.issuesNotes),
      safetyNotes:   str(e.safetyNotes),
      photoUrls:     arr([]),
      temperature:   nul(),
      createdAt:     ts(e.date),
      updatedAt:     ts(e.date),
    });
  }
  console.log("  ✓ 4 site diary entries created");

  // ── 8. Notifications ─────────────────────────────────────────────────────────
  console.log("\n🔔 Seeding notifications...");

  const notifications = [
    { recipientId: arjunUid, type: "task_assigned", title: "New Task Assigned", body: "You have been assigned to 'Install formwork for roof slab — Block A'", relatedId: taskIds[0] || "", relatedType: "task", daysAgo_: 3 },
    { recipientId: arjunUid, type: "task_due",      title: "Task Due Tomorrow", body: "'Electrical conduit laying — all floors' is due tomorrow. Please complete.", relatedId: taskIds[2] || "", relatedType: "task", daysAgo_: 1 },
    { recipientId: raviUid,  type: "approval_needed", title: "Approval Required", body: "Arjun Menon submitted 'Electrical conduit laying' for your approval.", relatedId: taskIds[2] || "", relatedType: "task", daysAgo_: 2 },
    { recipientId: thomasUid, type: "task_overdue", title: "Task Overdue", body: "'Basement waterproofing inspection' is overdue by 1 day.", relatedId: taskIds[7] || "", relatedType: "task", daysAgo_: 0 },
    { recipientId: priyaUid, type: "task_assigned", title: "New Task Assigned", body: "You have been assigned to 'Review architect's revised drawings'", relatedId: taskIds[10] || "", relatedType: "task", daysAgo_: 1 },
    { recipientId: sureshUid, type: "task_assigned", title: "New Task Assigned", body: "You have been assigned to 'Complete brick masonry — 2nd floor west wing'", relatedId: taskIds[1] || "", relatedType: "task", daysAgo_: 5 },
  ];

  for (const n of notifications) {
    await db.collection("notifications").add({
      recipientId: str(n.recipientId),
      type:        str(n.type),
      title:       str(n.title),
      body:        str(n.body),
      relatedId:   str(n.relatedId),
      relatedType: str(n.relatedType),
      isRead:      bool(false),
      createdAt:   ts(daysAgo(n.daysAgo_)),
    });
  }
  console.log("  ✓ 6 notifications created");

  // ── Done ──────────────────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║  ✅  Seeding Complete!                           ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log("║  Roles     : 7 created/updated                  ║");
  console.log("║  Users     : 8 created/updated                  ║");
  console.log("║  Projects  : 3 created                          ║");
  console.log("║  Tasks     : 13 created                         ║");
  console.log("║  Channels  : 5 created/updated                  ║");
  console.log("║  Diary     : 4 entries                          ║");
  console.log("║  Notifs    : 6 created                          ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log("║  All users password: Kurickal@2024              ║");
  console.log("╚══════════════════════════════════════════════════╝\n");
}

main().catch(console.error);
