// src/types/models.ts
export interface User {
  id: number;
  username: string;
  email: string;
  role_user?: RoleUser;
  department?: string;
  position?: string;
  manager?: User;
  subordinates?: User[];
  is_manager?: boolean;
  attendances?: Attendance[];
  breaks?: Break[];
  leave_requests?: LeaveRequest[];
  time_logs?: TimeLog[];
  notifications?: Notification[];
}

export interface Attendance {
  id: number;
  users_permissions_user: User;
  date: Date;
  check_in?: Date;
  check_out?: Date;
  statuts: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'HOLIDAY';
  check_in_late_minutes: number;
  early_checkout_minutes: number;
  work_hours: number;
  location?: any;
  ip_address?: string;
  notes?: string;
}

export interface Break {
  id: number;
  users_permissions_user: User;
  time_log?: TimeLog;
  start_time: Date;
  end_time?: Date;
  duration_minutes?: number;
  type: 'LUNCH' | 'COFFEE' | 'SHORT' | 'OTHER';
  statuts: 'ACTIVE' | 'ENDED';
}

export interface TimeLog {
  id: number;
  user: User;
  project?: any;
  start_time: Date;
  end_time?: Date;
  statuts: 'ACTIVE' | 'PAUSED' | 'FINISHED';
  breaks?: Break[];
  total_break_minutes?: number;
  net_work_minutes?: number;
}

export interface LeaveRequest {
  id: number;
  user: User;
  approved_by?: User;
  type: 'ANNUAL' | 'SICK' | 'PERSONAL' | 'UNPAID' | 'MATERNITY' | 'OTHER';
  start_date: Date;
  end_date: Date;
  duration_days: number;
  reason?: string;
  statuts: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  approval_date?: Date;
  manager_comments?: string;
  attachment?: any;
}

export interface OvertimeRequest {
  id: number;
  user: User;
  project?: any;
  hours: number;
  reason?: string;
  statuts: 'PENDING' | 'APPROVED' | 'REJECTED';
  approved_by?: User;
  approval_date?: Date;
  manager_comments?: string;
}

export interface Notification {
  id: number;
  user: User;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'ALERT' | 'SYSTEM';
  is_read: boolean;
  createdAt: Date;
}

export interface RoleUser {
  id: number;
  name: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  description?: string;
  users?: User[];
}

export interface DashboardTodayResponse {
  date: string;
  attendance: {
    id?: number;
    checkIn?: Date;
    checkOut?: Date;
    status: string;
    isLate: boolean;
    lateMinutes: number;
    workHours: number;
    breakHours: number;
    expectedHours: number;
  };
  currentSession: {
    id: number;
    status: string;
    startTime: Date;
    isOnBreak: boolean;
    breakInfo: {
      id: number;
      type: string;
      startTime: Date;
      duration: number;
    } | null;
  } | null;
  leaveBalance: {
    annual: { total: number; used: number; remaining: number };
    sick: { total: number; used: number; remaining: number };
    personal: { total: number; used: number; remaining: number };
  };
  overtimeMonth: {
    total: number;
    pending: number;
    remaining: number;
  };
  actions: {
    canCheckIn: boolean;
    canCheckOut: boolean;
    canStartBreak: boolean;
    canEndBreak: boolean;
    canRequestOvertime: boolean;
    canRequestLeave: boolean;
  };
}