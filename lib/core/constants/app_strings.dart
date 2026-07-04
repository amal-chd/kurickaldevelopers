class AppStrings {
  // App
  static const String appName = 'Task Pilot';

  // Auth
  static const String signIn = 'Sign In';
  static const String signOut = 'Sign Out';
  static const String email = 'Email';
  static const String password = 'Password';
  static const String forgotPassword = 'Forgot password?';
  static const String signInWithGoogle = 'Sign in with Google';
  static const String verifyYourNumber = 'Verify your number';
  static const String resendOtp = 'Resend OTP';
  static const String verify = 'Verify';
  static const String whatsYourName = "What's your name?";
  static const String selectYourRole = 'Select your role';
  static const String enableNotifications = 'Enable notifications?';
  static const String enableBiometric = 'Enable biometric login?';

  // Nav
  static const String dashboard = 'Dashboard';
  static const String tasks = 'Tasks';
  static const String projects = 'Projects';
  static const String team = 'Team';
  static const String more = 'More';

  // Dashboard
  static const String goodMorning = 'Good morning';
  static const String goodAfternoon = 'Good afternoon';
  static const String goodEvening = 'Good evening';
  static const String tasksDueToday = 'Tasks Due Today';
  static const String overdueTasks = 'Overdue Tasks';
  static const String pendingApprovals = 'Pending Approvals';
  static const String activeProjects = 'Active Projects';
  static const String myTasks = 'My Tasks';
  static const String activeSites = 'Active Sites';
  static const String recentActivity = 'Recent Activity';

  // Tasks
  static const String createTask = 'Create Task';
  static const String taskTitle = 'Task Title';
  static const String description = 'Description';
  static const String assignee = 'Assignee';
  static const String dueDate = 'Due Date';
  static const String priority = 'Priority';
  static const String status = 'Status';
  static const String subtasks = 'Subtasks';
  static const String comments = 'Comments';
  static const String attachments = 'Attachments';
  static const String timeTracking = 'Time Tracking';
  static const String addComment = 'Add a comment...';
  static const String requestApproval = 'Request Approval';
  static const String approve = 'Approve';
  static const String reject = 'Reject';

  // Projects
  static const String newProject = 'New Project';
  static const String milestones = 'Milestones';
  static const String gantt = 'Gantt';
  static const String documents = 'Documents';
  static const String reports = 'Reports';
  static const String progress = 'Progress';

  // Team
  static const String checkIn = 'Check In';
  static const String checkOut = 'Check Out';
  static const String attendance = 'Attendance';

  // Documents
  static const String uploadDocument = 'Upload Document';
  static const String sendForApproval = 'Send for Approval';

  // Errors
  static const String somethingWentWrong = 'Something went wrong';
  static const String noInternet = 'No internet connection';
  static const String retryLabel = 'Retry';
  static const String noPermission = "You don't have access to this";
  static const String outsideGeofence = 'You are outside the site boundary';

  // Greetings
  static String greeting(String name) {
    final hour = DateTime.now().hour;
    if (hour < 12) return '$goodMorning, $name';
    if (hour < 17) return '$goodAfternoon, $name';
    return '$goodEvening, $name';
  }
}
