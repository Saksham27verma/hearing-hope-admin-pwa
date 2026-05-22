import type { StaffDoc } from '@/lib/firestore/queries';

type AnyObj = Record<string, unknown>;

export interface SalaryDoc {
  id: string;
  staffId?: string;
  month?: string;
  netSalary?: number;
  totalEarnings?: number;
  isPaid?: boolean;
  paidDate?: unknown;
  jobRole?: string;
}

export interface PayslipRow {
  id: string;
  staffId: string;
  staffName: string;
  month: string;
  monthLabel: string;
  netSalary: number;
  isPaid: boolean;
}

function str(v: unknown, fallback = '') {
  if (v === undefined || v === null) return fallback;
  return String(v).trim() || fallback;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function monthLabel(month: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) return month;
  const [y, m] = month.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function buildPayslipRows(staff: StaffDoc[], salaries: SalaryDoc[]): PayslipRow[] {
  const staffById = new Map(staff.map((s) => [s.id, s]));
  return salaries
    .map((salary) => {
      const staffId = str(salary.staffId) || str(salary.id).split('_')[0];
      const member = staffById.get(staffId);
      const month = str(salary.month);
      if (!staffId || !month) return null;
      return {
        id: salary.id,
        staffId,
        staffName: str(member?.name || (member as unknown as AnyObj)?.displayName, staffId),
        month,
        monthLabel: monthLabel(month),
        netSalary: num(salary.netSalary ?? salary.totalEarnings),
        isPaid: Boolean(salary.isPaid),
      };
    })
    .filter((row): row is PayslipRow => row != null)
    .sort((a, b) => b.month.localeCompare(a.month) || a.staffName.localeCompare(b.staffName));
}
