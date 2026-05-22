/**
 * Typed shapes for the Firestore collections the Admin PWA reads from.
 * Intentionally loose — admin reports must tolerate legacy/missing fields.
 */

export interface CenterDoc {
  id: string;
  name?: string;
  code?: string;
  city?: string;
  active?: boolean;
}

export interface UserDoc {
  id: string;
  uid?: string;
  email?: string;
  displayName?: string;
  nickname?: string;
  role?: string;
  centerId?: string | null;
  centerIds?: string[] | null;
  isSuperAdmin?: boolean;
  createdAt?: number;
}

export interface SaleDoc {
  id: string;
  invoiceNumber?: string;
  invoiceDate?: number | string;
  saleDate?: number | string;
  createdAt?: unknown;
  centerId?: string;
  branch?: string;
  customerName?: string;
  customerPhone?: string;
  patientName?: string;
  phone?: string;
  email?: string;
  address?: string;
  partyName?: string;
  enquiryId?: string;
  totalAmount?: number;
  grandTotal?: number;
  amountPaid?: number;
  paidAmount?: number;
  paymentStatus?: string;
  paymentMethod?: string;
  payments?: Array<Record<string, unknown>>;
  paymentRecords?: Array<Record<string, unknown>>;
  status?: string;
  cancelled?: boolean;
  gstAmount?: number;
  dueDate?: unknown;
  salespersonName?: string;
  salesperson?: { name?: string } | string;
  enquiryVisitIndex?: number;
  visitIndex?: number;
  exchangeCreditInr?: number;
  source?: string;
  referenceDoctor?: { id?: string; name?: string };
  businessCompany?: string;
  companyName?: string;
  products?: Array<Record<string, unknown>>;
  accessories?: Array<Record<string, unknown>>;
  manualLineItems?: Array<Record<string, unknown>>;
  items?: Array<{
    productName?: string;
    productId?: string;
    quantity?: number;
    rate?: number;
    amount?: number;
    mrp?: number;
    serialNumber?: string;
    serialNumbers?: string[];
  }>;
  staffId?: string;
  staffName?: string;
  userId?: string;
  userName?: string;
}

export interface EnquiryDoc {
  id: string;
  customerName?: string;
  name?: string;
  patientName?: string;
  fullName?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  status?: string;
  center?: string;
  visitingCenter?: string;
  centerId?: string;
  createdAt?: unknown;
  assignedTo?: string;
  assignedToName?: string;
  telecallerName?: string;
  telecallerId?: string;
  followUps?: Array<{
    id?: string;
    date?: unknown;
    nextFollowUpDate?: unknown;
    status?: string;
    outcome?: string;
    response?: string;
    note?: string;
    notes?: string;
    by?: string;
    byName?: string;
    telecaller?: string;
    duration?: number;
  }>;
  visits?: Array<Record<string, unknown>>;
  visitSchedules?: Array<Record<string, unknown>>;
  payments?: Array<Record<string, unknown>>;
  paymentRecords?: Array<Record<string, unknown>>;
}

export interface ProductDoc {
  id: string;
  name?: string;
  productName?: string;
  model?: string;
  type?: string;
  category?: string;
  company?: string;
  manufacturer?: string;
  quantityType?: string;
  hasSerialNumber?: boolean;
  dealerPrice?: number;
  mrp?: number;
}

export interface AppointmentDoc {
  id: string;
  title?: string;
  customerName?: string;
  name?: string;
  patientName?: string;
  patientPhone?: string;
  reference?: string;
  phone?: string;
  type?: string;
  appointmentType?: string;
  status?: string;
  date?: unknown;
  appointmentDate?: unknown;
  start?: unknown;
  end?: unknown;
  time?: string;
  startTime?: unknown;
  endTime?: unknown;
  centerId?: string;
  center?: string;
  centerName?: string;
  staffId?: string;
  staffName?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  homeVisitorStaffId?: string;
  homeVisitorName?: string;
  address?: string;
  telecaller?: string;
  cancelledReason?: string;
  rescheduledFrom?: unknown;
  enquiryId?: string;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StaffDoc {
  id: string;
  name?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  jobRole?: string;
  department?: string;
  staffNumber?: string;
  isActive?: boolean;
}

export interface ActivityLogDoc {
  id: string;
  timestamp?: unknown;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  centerId?: string | null;
  action?: string;
  module?: string;
  entityId?: string;
  entityName?: string;
  description?: string;
  changes?: Record<string, { before: unknown; after: unknown }>;
  metadata?: Record<string, unknown>;
}

export const COLLECTIONS = {
  users: 'users',
  centers: 'centers',
  sales: 'sales',
  enquiries: 'enquiries',
  appointments: 'appointments',
  activityLogs: 'activityLogs',
  staff: 'staff',
  notifications: 'notifications',
  companies: 'companies',
  parties: 'parties',
  products: 'products',
  materialInward: 'materialInward',
  purchases: 'purchases',
  materialsOut: 'materialsOut',
  staffTrialCustody: 'staffTrialCustody',
  salaries: 'salaries',
} as const;
