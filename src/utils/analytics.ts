import {
  AttendanceEntry,
  Client,
  CODE_META_MAP,
  MONTH_OPTIONS_2026,
  SppPackage,
  Therapist,
  TherapistClaim,
  TherapyCode,
} from '../types/clinic';

export interface TherapistMonthlyRecap {
  therapist: Therapist;
  systemHours: number;
  systemSessions: number;
  weekdayHours: number;
  saturdayHours: number;
  uniqueClientsCount: number;
  clientNames: string[];
  claimedHours: number;
  claimedSessions: number;
  discrepancyHours: number;
  discrepancyCount: number;
  hoursByCode: Record<TherapyCode, number>;
}

export interface ClientMonthlySppRecap {
  client: Client;
  sppPackage?: SppPackage;
  paidSessions: number;
  attendedSessions: number;
  attendedHours: number;
  remainingSessions: number;
  utilizationPct: number;
  countsByCode: Record<TherapyCode, number>;
  sppFee: number;
  paymentStatus: string;
}

export interface DiscrepancyItem {
  id: string;
  dayOfMonth: number;
  therapistId: string;
  therapistName: string;
  clientId: string;
  clientName: string;
  systemEntry?: AttendanceEntry;
  claim?: TherapistClaim;
  systemHours: number;
  claimedHours: number;
  diffHours: number;
  issueType: 'code_mismatch' | 'hours_mismatch' | 'missing_in_system' | 'missing_in_claim' | 'matched';
  statusLabel: string;
  note: string;
}

export interface MonthlyTrendPoint {
  monthKey: string;
  shortLabel: string;
  label: string;
  totalAttended: number;
  totalPaidSpp: number;
  attendanceRatePct: number;
  momGrowthPct: number | null;
  totalTherapistHours: number;
  activeClients: number;
}

function emptyCodeCounts(): Record<TherapyCode, number> {
  return {
    SI: 0,
    TW: 0,
    OT: 0,
    BT: 0,
    RM: 0,
    FS: 0,
    E: 0,
    Izin: 0,
    Ganti: 0,
    Hutang: 0,
    Hangus: 0,
  };
}

export function isSaturdayInMonth(monthKey: string, dayOfMonth: number): boolean {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, dayOfMonth).getDay() === 6;
}

export function computeDiscrepancies(
  monthKey: string,
  therapists: Therapist[],
  clients: Client[],
  entries: AttendanceEntry[],
  claims: TherapistClaim[]
): DiscrepancyItem[] {
  const therapistMap = new Map(therapists.map((t) => [t.id, t]));
  const clientMap = new Map(clients.map((c) => [c.id, c]));

  const monthEntries = entries.filter((e) => e.monthKey === monthKey);
  const monthClaims = claims.filter((c) => c.monthKey === monthKey);

  // Pair by (therapistId, clientId, dayOfMonth)
  const entryGroups = new Map<string, AttendanceEntry[]>();
  for (const e of monthEntries) {
    const key = `${e.therapistId}__${e.clientId}__${e.dayOfMonth}`;
    const arr = entryGroups.get(key) || [];
    arr.push(e);
    entryGroups.set(key, arr);
  }

  const claimGroups = new Map<string, TherapistClaim[]>();
  for (const c of monthClaims) {
    const key = `${c.therapistId}__${c.clientId}__${c.dayOfMonth}`;
    const arr = claimGroups.get(key) || [];
    arr.push(c);
    claimGroups.set(key, arr);
  }

  const allKeys = new Set([...entryGroups.keys(), ...claimGroups.keys()]);
  const items: DiscrepancyItem[] = [];

  for (const key of allKeys) {
    const eList = entryGroups.get(key) || [];
    const cList = claimGroups.get(key) || [];
    const maxLen = Math.max(eList.length, cList.length);

    for (let i = 0; i < maxLen; i++) {
      const sys = eList[i];
      const clm = cList[i];
      const therapistId = sys?.therapistId || clm?.therapistId || '';
      const clientId = sys?.clientId || clm?.clientId || '';
      const dayOfMonth = sys?.dayOfMonth || clm?.dayOfMonth || 1;
      const therapistName = therapistMap.get(therapistId)?.name || 'Terapis';
      const clientName = clientMap.get(clientId)?.name || 'Klien';

      const sysHours = sys ? (CODE_META_MAP[sys.code]?.countsAsAttended ? sys.hours : 0) : 0;
      const claimedHours = clm ? (CODE_META_MAP[clm.code]?.countsAsAttended ? clm.claimedHours : 0) : 0;
      const diffHours = Number((claimedHours - sysHours).toFixed(2));

      let issueType: DiscrepancyItem['issueType'] = 'matched';
      let statusLabel = 'Cocok';
      let note = clm?.claimNote || sys?.notes || '';

      if (clm?.reconcileStatus === 'resolved') {
        issueType = 'matched';
        statusLabel = 'Diselesaikan';
      } else if (sys && !clm) {
        if (CODE_META_MAP[sys.code]?.countsAsAttended) {
          issueType = 'missing_in_claim';
          statusLabel = 'Belum Diisi Terapis';
          note = note || 'Tercatat di sistem klinik, terapis belum mengisi laporan mandiri.';
        }
      } else if (!sys && clm) {
        issueType = 'missing_in_system';
        statusLabel = 'Belum Ada di Sistem';
        note = note || 'Terapis mengisi sesi ini, namun belum tercatat pada jadwal/check-in sistem.';
      } else if (sys && clm) {
        if (sys.code !== clm.code) {
          issueType = 'code_mismatch';
          statusLabel = `Beda Status (${clm.code} vs ${sys.code})`;
        } else if (Math.abs(diffHours) > 0.01) {
          issueType = 'hours_mismatch';
          statusLabel = 'Beda Durasi Jam';
        }
      }

      items.push({
        id: clm?.id || sys?.id || `${key}_${i}`,
        dayOfMonth,
        therapistId,
        therapistName,
        clientId,
        clientName,
        systemEntry: sys,
        claim: clm,
        systemHours: sysHours,
        claimedHours,
        diffHours,
        issueType,
        statusLabel,
        note,
      });
    }
  }

  return items.sort((a, b) => a.dayOfMonth - b.dayOfMonth || a.therapistName.localeCompare(b.therapistName));
}

export function computeTherapistMonthlyRecaps(
  monthKey: string,
  therapists: Therapist[],
  clients: Client[],
  entries: AttendanceEntry[],
  claims: TherapistClaim[]
): TherapistMonthlyRecap[] {
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const monthEntries = entries.filter((e) => e.monthKey === monthKey);
  const monthClaims = claims.filter((c) => c.monthKey === monthKey);
  const discrepancies = computeDiscrepancies(monthKey, therapists, clients, entries, claims);

  return therapists.map((therapist) => {
    const tEntries = monthEntries.filter((e) => e.therapistId === therapist.id);
    const tClaims = monthClaims.filter((c) => c.therapistId === therapist.id);
    const hoursByCode = emptyCodeCounts();
    const clientSet = new Set<string>();

    let systemHours = 0;
    let systemSessions = 0;
    let weekdayHours = 0;
    let saturdayHours = 0;

    for (const e of tEntries) {
      hoursByCode[e.code] = Number(((hoursByCode[e.code] || 0) + e.hours).toFixed(2));
      if (CODE_META_MAP[e.code]?.countsAsAttended) {
        systemHours += e.hours;
        systemSessions += 1;
        clientSet.add(e.clientId);
        if (isSaturdayInMonth(monthKey, e.dayOfMonth)) {
          saturdayHours += e.hours;
        } else {
          weekdayHours += e.hours;
        }
      }
    }

    let claimedHours = 0;
    let claimedSessions = 0;
    for (const c of tClaims) {
      if (CODE_META_MAP[c.code]?.countsAsAttended) {
        claimedHours += c.claimedHours;
        claimedSessions += 1;
      }
    }

    const tDiscrepancies = discrepancies.filter(
      (d) => d.therapistId === therapist.id && d.issueType !== 'matched'
    );

    const clientNames = Array.from(clientSet)
      .map((cid) => clientMap.get(cid)?.name || 'Klien')
      .sort();

    return {
      therapist,
      systemHours: Number(systemHours.toFixed(1)),
      systemSessions,
      weekdayHours: Number(weekdayHours.toFixed(1)),
      saturdayHours: Number(saturdayHours.toFixed(1)),
      uniqueClientsCount: clientSet.size,
      clientNames,
      claimedHours: Number(claimedHours.toFixed(1)),
      claimedSessions,
      discrepancyHours: Number((claimedHours - systemHours).toFixed(1)),
      discrepancyCount: tDiscrepancies.length,
      hoursByCode,
    };
  });
}

export function computeClientMonthlySppRecaps(
  monthKey: string,
  clients: Client[],
  sppPackages: SppPackage[],
  entries: AttendanceEntry[]
): ClientMonthlySppRecap[] {
  const monthEntries = entries.filter((e) => e.monthKey === monthKey);
  const pkgMap = new Map(
    sppPackages.filter((p) => p.monthKey === monthKey).map((p) => [p.clientId, p])
  );

  return clients.map((client) => {
    const pkg = pkgMap.get(client.id);
    const paidSessions = pkg ? pkg.paidSessions : client.defaultSppSessions;
    const cEntries = monthEntries.filter((e) => e.clientId === client.id);
    const countsByCode = emptyCodeCounts();

    let attendedSessions = 0;
    let attendedHours = 0;

    for (const e of cEntries) {
      countsByCode[e.code] = (countsByCode[e.code] || 0) + 1;
      if (CODE_META_MAP[e.code]?.countsAsAttended) {
        attendedSessions += 1;
        attendedHours += e.hours;
      }
    }

    const remainingSessions = paidSessions - attendedSessions;
    const utilizationPct =
      paidSessions > 0 ? Math.round((attendedSessions / paidSessions) * 1000) / 10 : 0;

    return {
      client,
      sppPackage: pkg,
      paidSessions,
      attendedSessions,
      attendedHours: Number(attendedHours.toFixed(1)),
      remainingSessions,
      utilizationPct,
      countsByCode,
      sppFee: pkg ? pkg.sppFee : paidSessions * 225000,
      paymentStatus: pkg ? pkg.paymentStatus : 'Belum Input',
    };
  });
}

export function computeMonthlyTrends(
  clients: Client[],
  sppPackages: SppPackage[],
  entries: AttendanceEntry[]
): MonthlyTrendPoint[] {
  const activeMonths = MONTH_OPTIONS_2026.filter(
    (m) =>
      entries.some((e) => e.monthKey === m.key) ||
      sppPackages.some((p) => p.monthKey === m.key)
  );

  const raw = activeMonths.map((m) => {
    const monthEntries = entries.filter((e) => e.monthKey === m.key);
    const pkgMap = new Map(
      sppPackages.filter((p) => p.monthKey === m.key).map((p) => [p.clientId, p])
    );

    const activeClientIds = new Set(monthEntries.map((e) => e.clientId));
    let totalPaidSpp = 0;
    clients.forEach((c) => {
      const pkg = pkgMap.get(c.id);
      if (pkg) {
        totalPaidSpp += pkg.paidSessions;
      } else if (activeClientIds.has(c.id)) {
        totalPaidSpp += c.defaultSppSessions;
      }
    });

    let totalAttended = 0;
    let totalTherapistHours = 0;
    for (const e of monthEntries) {
      if (CODE_META_MAP[e.code]?.countsAsAttended) {
        totalAttended += 1;
        totalTherapistHours += e.hours;
      }
    }

    const attendanceRatePct =
      totalPaidSpp > 0 ? Math.round((totalAttended / totalPaidSpp) * 1000) / 10 : 0;

    return {
      monthKey: m.key,
      shortLabel: m.shortLabel,
      label: m.label,
      totalAttended,
      totalPaidSpp,
      attendanceRatePct,
      totalTherapistHours: Number(totalTherapistHours.toFixed(1)),
      activeClients: activeClientIds.size,
    };
  });

  return raw.map((point, idx) => {
    if (idx === 0) {
      return { ...point, momGrowthPct: null };
    }
    const prev = raw[idx - 1];
    const diff = Number((point.attendanceRatePct - prev.attendanceRatePct).toFixed(1));
    return { ...point, momGrowthPct: diff };
  });
}

export interface AccrualDeferredItem {
  clientRecap: ClientMonthlySppRecap;
  ratePerSession: number;
  sppTotalFee: number;
  cashReceived: number;
  recognizedSessions: number;
  accrualRevenue: number;
  deferredRevenue: number;
  receivableAmount: number;
}

export interface AccrualSummary {
  items: AccrualDeferredItem[];
  totalSppFee: number;
  totalCashReceived: number;
  totalAccrualRevenue: number;
  totalDeferredRevenue: number;
  totalReceivableAmount: number;
}

export function computeAccrualAndDeferredRecap(
  clientRecaps: ClientMonthlySppRecap[]
): AccrualSummary {
  let totalSppFee = 0;
  let totalCashReceived = 0;
  let totalAccrualRevenue = 0;
  let totalDeferredRevenue = 0;
  let totalReceivableAmount = 0;

  const items: AccrualDeferredItem[] = clientRecaps.map((cr) => {
    const sppTotalFee = cr.sppFee;
    const ratePerSession =
      cr.paidSessions > 0 ? Math.round(sppTotalFee / cr.paidSessions) : 225000;

    // Kas diterima berdasarkan status pembayaran SPP
    const cashReceived =
      cr.paymentStatus === 'Lunas'
        ? sppTotalFee
        : cr.paymentStatus === 'Cicilan'
        ? Math.round(sppTotalFee * 0.5)
        : 0;

    // Sesi yang diakui sebagai pendapatan accrual = hadir + hangus (tidak termasuk Izin karena dapat diganti)
    const recognizedSessions = cr.attendedSessions + (cr.countsByCode.Hangus || 0);
    const accrualRevenue = recognizedSessions * ratePerSession;

    // Jika kas diterima > pendapatan accrual -> sisa menjadi Pendapatan Diterima di Muka
    const deferredRevenue = Math.max(0, cashReceived - accrualRevenue);
    // Jika pendapatan accrual > kas diterima -> menjadi Piutang / Sesi Terpakai Belum Lunas
    const receivableAmount = Math.max(0, accrualRevenue - cashReceived);

    totalSppFee += sppTotalFee;
    totalCashReceived += cashReceived;
    totalAccrualRevenue += accrualRevenue;
    totalDeferredRevenue += deferredRevenue;
    totalReceivableAmount += receivableAmount;

    return {
      clientRecap: cr,
      ratePerSession,
      sppTotalFee,
      cashReceived,
      recognizedSessions,
      accrualRevenue,
      deferredRevenue,
      receivableAmount,
    };
  });

  return {
    items,
    totalSppFee,
    totalCashReceived,
    totalAccrualRevenue,
    totalDeferredRevenue,
    totalReceivableAmount,
  };
}

