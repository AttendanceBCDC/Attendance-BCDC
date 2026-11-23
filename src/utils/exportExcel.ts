import * as XLSX from 'xlsx';
import {
  AttendanceEntry,
  CODE_META_MAP,
  getMonthCalendarDays,
  MONTH_OPTIONS_2026,
  THERAPY_CODE_LIST,
} from '../types/clinic';
import {
  AccrualSummary,
  ClientMonthlySppRecap,
  DiscrepancyItem,
  TherapistMonthlyRecap,
} from './analytics';

export function exportMonthlyWorkbook(params: {
  monthKey: string;
  therapistRecaps: TherapistMonthlyRecap[];
  clientRecaps: ClientMonthlySppRecap[];
  discrepancies: DiscrepancyItem[];
  entries: AttendanceEntry[];
  accrualSummary: AccrualSummary;
}): string {
  const { monthKey, therapistRecaps, clientRecaps, discrepancies, entries, accrualSummary } = params;
  const monthLabel = MONTH_OPTIONS_2026.find((m) => m.key === monthKey)?.label || monthKey;
  const { weekdays, saturdays } = getMonthCalendarDays(monthKey);
  const allDays = [...weekdays, ...saturdays];
  const monthEntries = entries.filter((e) => e.monthKey === monthKey);

  const wb = XLSX.utils.book_new();

  // Sheet 1: Rekap Terapis
  const therapistRows = therapistRecaps.map((r, idx) => ({
    No: idx + 1,
    'Nama Terapis / Psikolog': r.therapist.name,
    Bidang: r.therapist.specialty,
    Jabatan: r.therapist.roleTitle,
    'Klien Unik': r.uniqueClientsCount,
    'Sesi Sistem': r.systemSessions,
    'Jam Sistem': r.systemHours,
    'Jam Weekday': r.weekdayHours,
    'Jam Sabtu': r.saturdayHours,
    'Jam Klaim Terapis': r.claimedHours,
    'Selisih (Klaim - Sistem)': r.discrepancyHours,
    SI: r.hoursByCode.SI,
    TW: r.hoursByCode.TW,
    OT: r.hoursByCode.OT,
    BT: r.hoursByCode.BT,
    RM: r.hoursByCode.RM,
    FS: r.hoursByCode.FS,
    'E (Psikolog)': r.hoursByCode.E,
  }));
  const wsTherapist = XLSX.utils.json_to_sheet(therapistRows);
  XLSX.utils.book_append_sheet(wb, wsTherapist, 'Rekap Terapis');

  // Sheet 2: Spreadsheet Absensi
  const sheetRows = clientRecaps.map((cr, idx) => {
    const row: Record<string, string | number> = {
      No: idx + 1,
      'Nama Klien': cr.client.name,
      'Sesi SPP': cr.paidSessions,
    };

    for (const d of allDays) {
      const cellEntries = monthEntries.filter(
        (e) => e.clientId === cr.client.id && e.dayOfMonth === d.day
      );
      const colName = `${d.dayCode} ${d.day}`;
      row[colName] = cellEntries
        .map((e) => CODE_META_MAP[e.code]?.short || e.code)
        .join(' / ');
    }

    for (const meta of THERAPY_CODE_LIST) {
      row[meta.code] = cr.countsByCode[meta.code] || 0;
    }

    row['Total Hadir'] = cr.attendedSessions;
    row['% Kehadiran SPP'] = `${cr.utilizationPct}%`;
    return row;
  });
  const wsSheet = XLSX.utils.json_to_sheet(sheetRows);
  XLSX.utils.book_append_sheet(wb, wsSheet, `Absensi ${monthLabel}`);

  // Sheet 3: Rekonsiliasi Terapis
  const diffRows = discrepancies
    .filter((d) => d.issueType !== 'matched')
    .map((d) => ({
      Tanggal: `${d.dayOfMonth} ${monthLabel}`,
      Terapis: d.therapistName,
      Klien: d.clientName,
      'Status Sistem': d.systemEntry ? `${d.systemEntry.code} (${d.systemHours} jam)` : 'Tidak ada',
      'Klaim Terapis': d.claim ? `${d.claim.code} (${d.claimedHours} jam)` : 'Belum diisi',
      'Selisih Jam': d.diffHours,
      Keterangan: d.statusLabel,
      Catatan: d.note,
    }));
  const wsDiff = XLSX.utils.json_to_sheet(
    diffRows.length > 0
      ? diffRows
      : [{ Info: `Semua absensi terapis pada ${monthLabel} cocok dengan sistem.` }]
  );
  XLSX.utils.book_append_sheet(wb, wsDiff, 'Selisih Terapis');

  // Sheet 4: SPP & Kehadiran Klien
  const sppRows = clientRecaps.map((cr, idx) => ({
    No: idx + 1,
    'Nama Klien': cr.client.name,
    Program: cr.client.program,
    'Paket SPP (Sesi)': cr.paidSessions,
    'Nominal SPP': cr.sppFee,
    'Status Pembayaran': cr.paymentStatus,
    'Total Hadir': cr.attendedSessions,
    'Sisa Sesi': cr.remainingSessions,
    Izin: cr.countsByCode.Izin,
    Ganti: cr.countsByCode.Ganti,
    Hutang: cr.countsByCode.Hutang,
    Hangus: cr.countsByCode.Hangus,
    '% Kehadiran vs SPP': `${cr.utilizationPct}%`,
  }));
  const wsSpp = XLSX.utils.json_to_sheet(sppRows);
  XLSX.utils.book_append_sheet(wb, wsSpp, 'SPP & Klien');

  // Sheet 5: Pendapatan Diterima di Muka & Accrual
  const accrualRows = accrualSummary.items.map((item, idx) => ({
    No: idx + 1,
    'Nama Klien': item.clientRecap.client.name,
    'Paket (Sesi)': item.clientRecap.paidSessions,
    'Tarif / Sesi (Rp)': item.ratePerSession,
    'Tagihan SPP (Rp)': item.sppTotalFee,
    'Status Bayar': item.clientRecap.paymentStatus,
    'Kas Diterima (Rp)': item.cashReceived,
    'Sesi Terealisasi (Hadir+Hangus)': item.recognizedSessions,
    'Pendapatan Accrual (Rp)': item.accrualRevenue,
    'Pendapatan Diterima di Muka (Rp)': item.deferredRevenue,
    'Piutang / Kurang Bayar (Rp)': item.receivableAmount,
  }));
  const wsAccrual = XLSX.utils.json_to_sheet(accrualRows);
  XLSX.utils.book_append_sheet(wb, wsAccrual, 'Dimuka & Accrual');

  const filename = `LAPORAN_ABSENSI_BCDC_${monthKey}.xlsx`;
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);

  return filename;
}

export function buildMonthlyAttendanceTsv(params: {
  monthKey: string;
  clientRecaps: ClientMonthlySppRecap[];
  entries: AttendanceEntry[];
}): string {
  const { monthKey, clientRecaps, entries } = params;
  const { weekdays, saturdays } = getMonthCalendarDays(monthKey);
  const allDays = [...weekdays, ...saturdays];
  const monthEntries = entries.filter((e) => e.monthKey === monthKey);

  const headers = [
    'NO',
    'NAMA KLIEN',
    'SPP',
    ...allDays.map((d) => `${d.dayCode} ${d.day}`),
    ...THERAPY_CODE_LIST.map((m) => m.code),
    'Total Hadir',
    '% SPP',
  ];

  const rows = clientRecaps.map((cr, idx) => {
    const dayCells = allDays.map((d) => {
      const cellEntries = monthEntries.filter(
        (e) => e.clientId === cr.client.id && e.dayOfMonth === d.day
      );
      return cellEntries.map((e) => CODE_META_MAP[e.code]?.short || e.code).join('/');
    });
    const codeTotals = THERAPY_CODE_LIST.map((m) => String(cr.countsByCode[m.code] || 0));
    return [
      String(idx + 1),
      cr.client.name,
      String(cr.paidSessions),
      ...dayCells,
      ...codeTotals,
      String(cr.attendedSessions),
      `${cr.utilizationPct}%`,
    ].join('\t');
  });

  return [headers.join('\t'), ...rows].join('\n');
}
