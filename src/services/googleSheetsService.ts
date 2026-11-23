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
} from '../utils/analytics';

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface SheetTabMeta {
  sheetId: number;
  title: string;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheets: SheetTabMeta[];
}

export interface ParsedClientImport {
  name: string;
  defaultSppSessions: number;
}

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  return trimmed;
}

async function googleFetch<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    let errMsg = `Google API Error (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error?.message) {
        errMsg = body.error.message;
      }
    } catch {
      // ignore json parse failure
    }
    throw new Error(errMsg);
  }

  return res.json() as Promise<T>;
}

export async function listDriveSpreadsheets(
  accessToken: string,
  searchQuery?: string
): Promise<DriveSpreadsheetFile[]> {
  let q = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
  if (searchQuery && searchQuery.trim()) {
    const safe = searchQuery.trim().replace(/'/g, "\\'");
    q += ` and name contains '${safe}'`;
  }
  const params = new URLSearchParams({
    q,
    fields: 'files(id,name,modifiedTime,webViewLink)',
    orderBy: 'modifiedTime desc',
    pageSize: '25',
  });

  const data = await googleFetch<{ files?: DriveSpreadsheetFile[] }>(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    accessToken
  );
  return data.files || [];
}

export async function getSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetMetadata> {
  const params = new URLSearchParams({
    fields: 'spreadsheetId,properties.title,spreadsheetUrl,sheets(properties(sheetId,title))',
  });
  const data = await googleFetch<{
    spreadsheetId: string;
    properties?: { title?: string };
    spreadsheetUrl?: string;
    sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
  }>(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?${params.toString()}`, accessToken);

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || 'Spreadsheet Tanpa Judul',
    spreadsheetUrl:
      data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
    sheets: (data.sheets || []).map((s, idx) => ({
      sheetId: s.properties?.sheetId ?? idx,
      title: s.properties?.title || `Tab ${idx + 1}`,
    })),
  };
}

export async function readSheetValues(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  cellRange = 'A1:AZ120'
): Promise<string[][]> {
  const fullRange = `'${sheetTitle.replace(/'/g, "''")}'!${cellRange}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(fullRange)}`;

  const data = await googleFetch<{ values?: string[][] }>(url, accessToken);
  return data.values || [];
}

export function getTargetSheetNames(monthKey: string): {
  therapistsTab: string;
  attendanceTab: string;
  discrepancyTab: string;
  sppTab: string;
  accrualTab: string;
  allTabs: string[];
} {
  const monthLabel = MONTH_OPTIONS_2026.find((m) => m.key === monthKey)?.label || monthKey;
  const therapistsTab = 'Rekap Terapis';
  const attendanceTab = `Absensi ${monthLabel}`;
  const discrepancyTab = 'Selisih Terapis';
  const sppTab = 'SPP & Klien';
  const accrualTab = 'Dimuka & Accrual';
  return {
    therapistsTab,
    attendanceTab,
    discrepancyTab,
    sppTab,
    accrualTab,
    allTabs: [therapistsTab, attendanceTab, discrepancyTab, sppTab, accrualTab],
  };
}

export async function createClinicSpreadsheet(
  accessToken: string,
  title: string,
  monthKey: string
): Promise<SpreadsheetMetadata> {
  const { allTabs } = getTargetSheetNames(monthKey);
  const body = {
    properties: { title },
    sheets: allTabs.map((tabTitle) => ({
      properties: { title: tabTitle },
    })),
  };

  const data = await googleFetch<{
    spreadsheetId: string;
    properties?: { title?: string };
    spreadsheetUrl?: string;
    sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
  }>('https://sheets.googleapis.com/v4/spreadsheets', accessToken, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || title,
    spreadsheetUrl:
      data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
    sheets: (data.sheets || []).map((s, idx) => ({
      sheetId: s.properties?.sheetId ?? idx,
      title: s.properties?.title || allTabs[idx],
    })),
  };
}

export async function syncMonthlyWorkbookToGoogleSheets(
  accessToken: string,
  spreadsheetId: string,
  params: {
    monthKey: string;
    therapistRecaps: TherapistMonthlyRecap[];
    clientRecaps: ClientMonthlySppRecap[];
    discrepancies: DiscrepancyItem[];
    entries: AttendanceEntry[];
    accrualSummary: AccrualSummary;
  }
): Promise<{ updatedTabs: string[]; spreadsheetUrl: string }> {
  const { monthKey, therapistRecaps, clientRecaps, discrepancies, entries, accrualSummary } = params;
  const monthLabel = MONTH_OPTIONS_2026.find((m) => m.key === monthKey)?.label || monthKey;
  const tabs = getTargetSheetNames(monthKey);

  // 1. Fetch existing tabs so we never assume tab names
  const meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  const existingTitles = new Set(meta.sheets.map((s) => s.title));
  const missingTabs = tabs.allTabs.filter((t) => !existingTitles.has(t));

  if (missingTabs.length > 0) {
    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: missingTabs.map((title) => ({
            addSheet: { properties: { title } },
          })),
        }),
      }
    );
  }

  // 2. Clear existing values on the 5 target tabs before writing
  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchClear`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        ranges: tabs.allTabs.map((t) => `'${t.replace(/'/g, "''")}'!A1:ZZ500`),
      }),
    }
  );

  // 3. Build 2D value matrices
  const therapistMatrix: (string | number)[][] = [
    [
      'No',
      'Nama Terapis / Psikolog',
      'Bidang',
      'Jabatan',
      'Klien Unik',
      'Sesi Sistem',
      'Jam Sistem',
      'Jam Weekday',
      'Jam Sabtu',
      'Jam Isian Terapis',
      'Selisih (Klaim - Sistem)',
      'SI',
      'TW',
      'OT',
      'BT',
      'RM',
      'FS',
      'E',
    ],
    ...therapistRecaps.map((r, idx) => [
      idx + 1,
      r.therapist.name,
      r.therapist.specialty,
      r.therapist.roleTitle,
      r.uniqueClientsCount,
      r.systemSessions,
      r.systemHours,
      r.weekdayHours,
      r.saturdayHours,
      r.claimedHours,
      r.discrepancyHours,
      r.hoursByCode.SI,
      r.hoursByCode.TW,
      r.hoursByCode.OT,
      r.hoursByCode.BT,
      r.hoursByCode.RM,
      r.hoursByCode.FS,
      r.hoursByCode.E,
    ]),
  ];

  const { weekdays, saturdays } = getMonthCalendarDays(monthKey);
  const allDays = [...weekdays, ...saturdays];
  const monthEntries = entries.filter((e) => e.monthKey === monthKey);

  const attendanceMatrix: (string | number)[][] = [
    [
      'NO',
      'NAMA KLIEN',
      'Sesi SPP',
      ...allDays.map((d) => `${d.dayCode} ${d.day}`),
      ...THERAPY_CODE_LIST.map((m) => m.code),
      'Total Hadir',
      '% Kehadiran SPP',
    ],
    ...clientRecaps.map((cr, idx) => [
      idx + 1,
      cr.client.name,
      cr.paidSessions,
      ...allDays.map((d) => {
        const cellEntries = monthEntries.filter(
          (e) => e.clientId === cr.client.id && e.dayOfMonth === d.day
        );
        return cellEntries.map((e) => CODE_META_MAP[e.code]?.short || e.code).join(' / ');
      }),
      ...THERAPY_CODE_LIST.map((m) => cr.countsByCode[m.code] || 0),
      cr.attendedSessions,
      `${cr.utilizationPct}%`,
    ]),
  ];

  const mismatchList = discrepancies.filter((d) => d.issueType !== 'matched');
  const discrepancyMatrix: (string | number)[][] = [
    [
      'Tanggal',
      'Terapis',
      'Klien',
      'Status Sistem',
      'Klaim Terapis',
      'Selisih Jam',
      'Keterangan',
      'Catatan',
    ],
    ...(mismatchList.length > 0
      ? mismatchList.map((d) => [
          `${d.dayOfMonth} ${monthLabel}`,
          d.therapistName,
          d.clientName,
          d.systemEntry ? `${d.systemEntry.code} (${d.systemHours} jam)` : 'Tidak ada',
          d.claim ? `${d.claim.code} (${d.claimedHours} jam)` : 'Belum diisi',
          d.diffHours,
          d.statusLabel,
          d.note,
        ])
      : [[`Semua absensi terapis pada ${monthLabel} sinkron dengan sistem.`]]),
  ];

  const sppMatrix: (string | number)[][] = [
    [
      'No',
      'Nama Klien',
      'Program',
      'Paket SPP (Sesi)',
      'Nominal SPP (Rp)',
      'Status Pembayaran',
      'Total Hadir',
      'Sisa Sesi',
      'Izin',
      'Ganti',
      'Hutang',
      'Hangus',
      '% Kehadiran vs SPP',
    ],
    ...clientRecaps.map((cr, idx) => [
      idx + 1,
      cr.client.name,
      cr.client.program,
      cr.paidSessions,
      cr.sppFee,
      cr.paymentStatus,
      cr.attendedSessions,
      cr.remainingSessions,
      cr.countsByCode.Izin,
      cr.countsByCode.Ganti,
      cr.countsByCode.Hutang,
      cr.countsByCode.Hangus,
      `${cr.utilizationPct}%`,
    ]),
  ];

  const accrualMatrix: (string | number)[][] = [
    [
      'No',
      'Nama Klien',
      'Paket SPP (Sesi)',
      'Tarif / Sesi (Rp)',
      'Tagihan SPP (Rp)',
      'Status Bayar',
      'Kas Diterima (Rp)',
      'Sesi Terealisasi (Hadir+Hangus)',
      'Pendapatan Accrual (Rp)',
      'Pendapatan Diterima di Muka (Rp)',
      'Piutang / Kurang Bayar (Rp)',
    ],
    ...accrualSummary.items.map((item, idx) => [
      idx + 1,
      item.clientRecap.client.name,
      item.clientRecap.paidSessions,
      item.ratePerSession,
      item.sppTotalFee,
      item.clientRecap.paymentStatus,
      item.cashReceived,
      item.recognizedSessions,
      item.accrualRevenue,
      item.deferredRevenue,
      item.receivableAmount,
    ]),
    [
      'TOTAL',
      monthLabel,
      accrualSummary.items.reduce((s, i) => s + i.clientRecap.paidSessions, 0),
      '',
      accrualSummary.totalSppFee,
      '',
      accrualSummary.totalCashReceived,
      accrualSummary.items.reduce((s, i) => s + i.recognizedSessions, 0),
      accrualSummary.totalAccrualRevenue,
      accrualSummary.totalDeferredRevenue,
      accrualSummary.totalReceivableAmount,
    ],
  ];

  const quoteTab = (t: string) => `'${t.replace(/'/g, "''")}'!A1`;

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: quoteTab(tabs.therapistsTab), values: therapistMatrix },
          { range: quoteTab(tabs.attendanceTab), values: attendanceMatrix },
          { range: quoteTab(tabs.discrepancyTab), values: discrepancyMatrix },
          { range: quoteTab(tabs.sppTab), values: sppMatrix },
          { range: quoteTab(tabs.accrualTab), values: accrualMatrix },
        ],
      }),
    }
  );

  return {
    updatedTabs: tabs.allTabs,
    spreadsheetUrl: meta.spreadsheetUrl,
  };
}

export function parseClientsFromSheetRows(rows: string[][]): ParsedClientImport[] {
  let nameCol = -1;
  let sesiCol = -1;
  let headerRowIdx = -1;

  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cell = (row[c] || '').trim().toLowerCase();
      if (cell === 'nama' || cell === 'nama klien' || cell === 'name' || cell === 'client') {
        nameCol = c;
        headerRowIdx = r;
      }
      if (
        cell.includes('sesi') ||
        cell.includes('paket') ||
        cell === 'spp'
      ) {
        sesiCol = c;
      }
    }
    if (nameCol !== -1) break;
  }

  if (nameCol === -1) {
    // Fallback: assume col 1 or 2 has names if no explicit header matched
    return [];
  }

  const results: ParsedClientImport[] = [];
  const seen = new Set<string>();

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const rawName = (row[nameCol] || '').trim();
    if (!rawName || rawName.toLowerCase() === 'total' || /^\d+$/.test(rawName)) continue;
    const key = rawName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const rawSesi = sesiCol !== -1 ? Number((row[sesiCol] || '').replace(/[^\d.]/g, '')) : 8;
    const sessions = Number.isFinite(rawSesi) && rawSesi > 0 && rawSesi <= 100 ? rawSesi : 8;
    results.push({
      name: rawName.slice(0, 100),
      defaultSppSessions: sessions,
    });
  }

  return results;
}
