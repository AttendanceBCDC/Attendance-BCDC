export type TherapyCode =
  | 'SI'
  | 'TW'
  | 'OT'
  | 'BT'
  | 'RM'
  | 'FS'
  | 'E'
  | 'Izin'
  | 'Ganti'
  | 'Hutang'
  | 'Hangus';

export type TherapySpecialty = 'SI' | 'TW' | 'OT' | 'BT' | 'RM' | 'FS' | 'E';

export interface CodeMeta {
  code: TherapyCode;
  short: string;
  label: string;
  category: 'therapy' | 'status';
  countsAsAttended: boolean;
  bgClass: string;
  textClass: string;
  borderClass: string;
  hex: string;
}

export const THERAPY_CODE_LIST: CodeMeta[] = [
  {
    code: 'SI',
    short: 's',
    label: 'Sensori Integrasi',
    category: 'therapy',
    countsAsAttended: true,
    bgClass: 'bg-purple-100',
    textClass: 'text-purple-900',
    borderClass: 'border-purple-200',
    hex: '#9333EA',
  },
  {
    code: 'TW',
    short: 'w',
    label: 'Terapi Wicara',
    category: 'therapy',
    countsAsAttended: true,
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-900',
    borderClass: 'border-amber-200',
    hex: '#D97706',
  },
  {
    code: 'OT',
    short: 'o',
    label: 'Okupasi Terapi',
    category: 'therapy',
    countsAsAttended: true,
    bgClass: 'bg-orange-100',
    textClass: 'text-orange-900',
    borderClass: 'border-orange-200',
    hex: '#EA580C',
  },
  {
    code: 'BT',
    short: 'b',
    label: 'Behavior Therapy',
    category: 'therapy',
    countsAsAttended: true,
    bgClass: 'bg-sky-100',
    textClass: 'text-sky-900',
    borderClass: 'border-sky-200',
    hex: '#0284C7',
  },
  {
    code: 'RM',
    short: 'r',
    label: 'Remedial',
    category: 'therapy',
    countsAsAttended: true,
    bgClass: 'bg-rose-100',
    textClass: 'text-rose-900',
    borderClass: 'border-rose-200',
    hex: '#E11D48',
  },
  {
    code: 'FS',
    short: 'f',
    label: 'Fisioterapi',
    category: 'therapy',
    countsAsAttended: true,
    bgClass: 'bg-fuchsia-100',
    textClass: 'text-fuchsia-900',
    borderClass: 'border-fuchsia-200',
    hex: '#C026D3',
  },
  {
    code: 'E',
    short: 'e',
    label: 'Kelas Psikolog / Evaluasi',
    category: 'therapy',
    countsAsAttended: true,
    bgClass: 'bg-emerald-100',
    textClass: 'text-emerald-900',
    borderClass: 'border-emerald-200',
    hex: '#16A34A',
  },
  {
    code: 'Izin',
    short: 'i',
    label: 'Izin / Tidak Hadir',
    category: 'status',
    countsAsAttended: false,
    bgClass: 'bg-red-600',
    textClass: 'text-white',
    borderClass: 'border-red-700',
    hex: '#DC2626',
  },
  {
    code: 'Ganti',
    short: 'g',
    label: 'Sesi Ganti / Reschedule',
    category: 'status',
    countsAsAttended: true,
    bgClass: 'bg-yellow-700',
    textClass: 'text-white',
    borderClass: 'border-yellow-800',
    hex: '#A16207',
  },
  {
    code: 'Hutang',
    short: 'u',
    label: 'Hutang Sesi',
    category: 'status',
    countsAsAttended: true,
    bgClass: 'bg-amber-800',
    textClass: 'text-white',
    borderClass: 'border-amber-900',
    hex: '#92400E',
  },
  {
    code: 'Hangus',
    short: 'h',
    label: 'Sesi Hangus',
    category: 'status',
    countsAsAttended: false,
    bgClass: 'bg-slate-900',
    textClass: 'text-white',
    borderClass: 'border-slate-950',
    hex: '#0F172A',
  },
];

export const CODE_META_MAP: Record<TherapyCode, CodeMeta> = THERAPY_CODE_LIST.reduce(
  (acc, item) => {
    acc[item.code] = item;
    return acc;
  },
  {} as Record<TherapyCode, CodeMeta>
);

export const SPECIALTY_CODES: TherapySpecialty[] = ['SI', 'TW', 'OT', 'BT', 'RM', 'FS', 'E'];

export interface UserProfile {
  uid: string;
  displayName: string;
  clinicName: string;
  seeded: boolean;
}

export interface Therapist {
  id: string;
  ownerId: string;
  name: string;
  specialty: TherapySpecialty;
  roleTitle: string;
  monthlyTargetHours: number;
  active: boolean;
}

export interface Client {
  id: string;
  ownerId: string;
  name: string;
  program: string;
  defaultSppSessions: number;
  primaryTherapistId: string;
  active: boolean;
}

export type PaymentStatus = 'Lunas' | 'Cicilan' | 'Belum Bayar';

export interface SppPackage {
  id: string;
  ownerId: string;
  clientId: string;
  monthKey: string;
  paidSessions: number;
  packageName: string;
  sppFee: number;
  paymentStatus: PaymentStatus;
}

export interface AttendanceEntry {
  id: string;
  ownerId: string;
  monthKey: string;
  dayOfMonth: number;
  slot: 1 | 2;
  clientId: string;
  therapistId: string;
  code: TherapyCode;
  hours: number;
  notes: string;
}

export type ReconcileStatus = 'pending' | 'matched' | 'discrepancy' | 'resolved';

export interface TherapistClaim {
  id: string;
  ownerId: string;
  monthKey: string;
  dayOfMonth: number;
  therapistId: string;
  clientId: string;
  code: TherapyCode;
  claimedHours: number;
  reconcileStatus: ReconcileStatus;
  claimNote: string;
}

export interface MonthOption {
  key: string;
  label: string;
  shortLabel: string;
}

export const MONTH_OPTIONS_2026: MonthOption[] = [
  { key: '2026-01', label: 'Januari 2026', shortLabel: 'Jan' },
  { key: '2026-02', label: 'Februari 2026', shortLabel: 'Feb' },
  { key: '2026-03', label: 'Maret 2026', shortLabel: 'Mar' },
  { key: '2026-04', label: 'April 2026', shortLabel: 'Apr' },
  { key: '2026-05', label: 'Mei 2026', shortLabel: 'Mei' },
  { key: '2026-06', label: 'Juni 2026', shortLabel: 'Jun' },
  { key: '2026-07', label: 'Juli 2026', shortLabel: 'Jul' },
  { key: '2026-08', label: 'Agustus 2026', shortLabel: 'Ags' },
  { key: '2026-09', label: 'September 2026', shortLabel: 'Sep' },
  { key: '2026-10', label: 'Oktober 2026', shortLabel: 'Okt' },
  { key: '2026-11', label: 'November 2026', shortLabel: 'Nov' },
  { key: '2026-12', label: 'Desember 2026', shortLabel: 'Des' },
];

export interface CalendarDayInfo {
  day: number;
  dayCode: string;
  isSaturday: boolean;
  isSunday: boolean;
  isHoliday: boolean;
  holidayLabel?: string;
}

const DAY_SHORT_ID = ['MG', 'SN', 'SL', 'RB', 'KM', 'JM', 'SB'];

// Indonesian national holidays in 2026 (subset for visual clarity on sheet headers)
const HOLIDAYS_2026: Record<string, string> = {
  '2026-01-01': 'Tahun Baru',
  '2026-01-16': 'Isra Mikraj',
  '2026-02-17': 'Imlek',
  '2026-03-19': 'Nyepi',
  '2026-03-20': 'Idul Fitri',
  '2026-03-21': 'Idul Fitri',
  '2026-04-03': 'Wafat Yesus',
  '2026-05-01': 'Hari Buruh',
  '2026-05-14': 'Kenaikan Yesus',
  '2026-05-27': 'Idul Adha',
  '2026-06-01': 'Hari Lahir Pancasila',
  '2026-06-16': 'Tahun Baru Islam',
  '2026-08-17': 'HUT RI',
  '2026-08-25': 'Maulid Nabi',
  '2026-12-25': 'Hari Natal',
};

export function getMonthCalendarDays(monthKey: string): {
  weekdays: CalendarDayInfo[];
  saturdays: CalendarDayInfo[];
  allActiveDays: CalendarDayInfo[];
} {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const daysInMonth = new Date(year, month, 0).getDate();

  const weekdays: CalendarDayInfo[] = [];
  const saturdays: CalendarDayInfo[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month - 1, d);
    const dow = dt.getDay();
    const isoDate = `${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`;
    const holidayLabel = HOLIDAYS_2026[isoDate];
    const info: CalendarDayInfo = {
      day: d,
      dayCode: DAY_SHORT_ID[dow],
      isSaturday: dow === 6,
      isSunday: dow === 0,
      isHoliday: Boolean(holidayLabel),
      holidayLabel,
    };
    if (dow === 0) continue; // Clinic closed on Sunday
    if (dow === 6) {
      saturdays.push(info);
    } else {
      weekdays.push(info);
    }
  }

  return {
    weekdays,
    saturdays,
    allActiveDays: [...weekdays, ...saturdays],
  };
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}
