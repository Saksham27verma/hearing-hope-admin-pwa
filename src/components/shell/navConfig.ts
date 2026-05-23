import {
  LayoutDashboard,
  Wallet,
  PhoneCall,
  PackageSearch,
  CalendarDays,
  ActivitySquare,
  BarChart3,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';

export interface AdminNavItem {
  text: string;
  path: string;
  icon: LucideIcon;
  /** When true, only super-admins see this. */
  superAdminOnly?: boolean;
  /** Short text shown as the right-aligned hint on hover (e.g. "Today" or "Live"). */
  badge?: string;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { text: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, badge: 'Live' },
  { text: 'Sales & Financials', path: '/sales', icon: Wallet },
  { text: 'WhatsApp Approvals', path: '/whatsapp-approvals', icon: MessageSquare },
  { text: 'Call Management', path: '/calls', icon: PhoneCall },
  { text: 'Inventory', path: '/inventory', icon: PackageSearch },
  { text: 'Appointments', path: '/appointments', icon: CalendarDays, badge: 'Today' },
  { text: 'Activity Logs', path: '/activity', icon: ActivitySquare },
  { text: 'CRM Reports', path: '/reports', icon: BarChart3 },
];
