import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  Calendar,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  LogOut,
} from 'lucide-react';
import {
  db,
  googleSignInWithWorkspace,
  handleFirestoreError,
  initWorkspaceAuthListener,
  OperationType,
  signOutWorkspace,
  testConnection,
} from './firebase';
import {
  AttendanceEntry,
  Client,
  MONTH_OPTIONS_2026,
  SppPackage,
  Therapist,
  TherapistClaim,
} from './types/clinic';
import { ensureUserProfileAndSeed } from './services/clinicService';
import {
  computeAccrualAndDeferredRecap,
  computeClientMonthlySppRecaps,
  computeDiscrepancies,
  computeMonthlyTrends,
  computeTherapistMonthlyRecaps,
} from './utils/analytics';
import { buildMonthlyAttendanceTsv, exportMonthlyWorkbook } from './utils/exportExcel';
import { SheetTabId, SummarySheet } from './components/sheets/SummarySheet';
import { AttendanceSheet } from './components/sheets/AttendanceSheet';
import { TherapistSheet } from './components/sheets/TherapistSheet';
import { SppSheet } from './components/sheets/SppSheet';
import { AccrualSheet } from './components/sheets/AccrualSheet';
import { GoogleSheetsSyncSheet } from './components/sheets/GoogleSheetsSyncSheet';

const SHEET_TABS: Array<{ id: SheetTabId; label: string }> = [
  { id: 'summary', label: '1. Ringkasan & Tren' },
  { id: 'attendance', label: '2. Absensi Bulanan' },
  { id: 'therapists', label: '3. Terapis & Selisih' },
  { id: 'spp', label: '4. SPP & Kehadiran' },
  { id: 'accrual', label: '5. Pendapatan Dimuka & Accrual' },
  { id: 'gsheets', label: '6. Sinkron Google Sheets' },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const [activeSheet, setActiveSheet] = useState<SheetTabId>('summary');
  const [monthKey, setMonthKey] = useState<string>('2026-01');
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sppPackages, setSppPackages] = useState<SppPackage[]>([]);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [claims, setClaims] = useState<TherapistClaim[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    testConnection();
    const unsub = initWorkspaceAuthListener(async (nextUser, token) => {
      setUser(nextUser);
      setAccessToken(token);
      setAuthReady(true);
      if (nextUser) {
        setSeeding(true);
        try {
          await ensureUserProfileAndSeed(
            nextUser.uid,
            nextUser.displayName || nextUser.email || 'Admin BCDC'
          );
        } catch (err) {
          console.error(err);
        } finally {
          setSeeding(false);
        }
      } else {
        setTherapists([]);
        setClients([]);
        setSppPackages([]);
        setEntries([]);
        setClaims([]);
        setDataLoaded(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;

    let loadedCount = 0;
    const markLoaded = () => {
      loadedCount += 1;
      if (loadedCount >= 5) setDataLoaded(true);
    };

    const qTherapists = query(collection(db, 'therapists'), where('ownerId', '==', user.uid));
    const qClients = query(collection(db, 'clients'), where('ownerId', '==', user.uid));
    const qPackages = query(collection(db, 'sppPackages'), where('ownerId', '==', user.uid));
    const qEntries = query(collection(db, 'attendanceEntries'), where('ownerId', '==', user.uid));
    const qClaims = query(collection(db, 'therapistClaims'), where('ownerId', '==', user.uid));

    const u1 = onSnapshot(
      qTherapists,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Therapist, 'id'>) }));
        list.sort((a, b) => a.name.localeCompare(b.name));
        setTherapists(list);
        markLoaded();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'therapists')
    );

    const u2 = onSnapshot(
      qClients,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Client, 'id'>) }));
        list.sort((a, b) => a.name.localeCompare(b.name));
        setClients(list);
        markLoaded();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'clients')
    );

    const u3 = onSnapshot(
      qPackages,
      (snap) => {
        setSppPackages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SppPackage, 'id'>) })));
        markLoaded();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'sppPackages')
    );

    const u4 = onSnapshot(
      qEntries,
      (snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceEntry, 'id'>) })));
        markLoaded();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'attendanceEntries')
    );

    const u5 = onSnapshot(
      qClaims,
      (snap) => {
        setClaims(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TherapistClaim, 'id'>) })));
        markLoaded();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'therapistClaims')
    );

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
    };
  }, [authReady, user]);

  const therapistRecaps = useMemo(
    () => computeTherapistMonthlyRecaps(monthKey, therapists, clients, entries, claims),
    [monthKey, therapists, clients, entries, claims]
  );

  const clientRecaps = useMemo(
    () => computeClientMonthlySppRecaps(monthKey, clients, sppPackages, entries),
    [monthKey, clients, sppPackages, entries]
  );

  const discrepancies = useMemo(
    () => computeDiscrepancies(monthKey, therapists, clients, entries, claims),
    [monthKey, therapists, clients, entries, claims]
  );

  const trends = useMemo(
    () => computeMonthlyTrends(clients, sppPackages, entries),
    [clients, sppPackages, entries]
  );

  const accrualSummary = useMemo(
    () => computeAccrualAndDeferredRecap(clientRecaps),
    [clientRecaps]
  );

  const handleLogin = async () => {
    setAuthError(null);
    try {
      const res = await googleSignInWithWorkspace();
      setUser(res.user);
      setAccessToken(res.accessToken);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Gagal masuk dengan Google. Silakan coba lagi.'
      );
    }
  };

  const handleLogout = async () => {
    await signOutWorkspace();
    setAccessToken(null);
  };

  const handleExport = () => {
    const filename = exportMonthlyWorkbook({
      monthKey,
      therapistRecaps,
      clientRecaps,
      discrepancies,
      entries,
      accrualSummary,
    });
    setExportFeedback(`File ${filename} diunduh`);
    setTimeout(() => setExportFeedback(null), 4000);
  };

  const handleCopyToSheets = async () => {
    const tsv = buildMonthlyAttendanceTsv({ monthKey, clientRecaps, entries });
    try {
      await navigator.clipboard.writeText(tsv);
      setExportFeedback('Tabel disalin! Silakan Paste (Ctrl+V) di Google Sheets');
    } catch {
      setExportFeedback('Gagal menyalin otomatis, silakan gunakan Export .XLSX');
    }
    setTimeout(() => setExportFeedback(null), 4500);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-sm text-slate-500">Memuat spreadsheet klinik...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-300 rounded-lg p-7 space-y-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700">
              <FileSpreadsheet className="w-4 h-4" />
              BCDC Terapi &amp; Kelas Psikolog
            </div>
            <h1 className="text-xl font-bold font-display text-slate-900">
              Spreadsheet Absensi Terapis, SPP &amp; Google Sheets
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              Workbook interaktif untuk rekap jam terapis, selisih laporan terapis vs sistem, utilisasi paket SPP, pendapatan diterima di muka &amp; accrual, serta sinkronisasi langsung dengan Google Sheets.
            </p>
          </div>

          {authError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xs text-xs text-red-700">
              {authError}
            </div>
          )}

          <button
            onClick={handleLogin}
            className="w-full inline-flex items-center justify-center gap-3 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-semibold rounded-md shadow-2xs transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
            <span>Sign in with Google</span>
          </button>
        </div>
      </div>
    );
  }

  const openDiffCount = discrepancies.filter((d) => d.issueType !== 'matched').length;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Compact Spreadsheet Top Toolbar */}
      <header className="bg-white border-b border-slate-300 px-4 py-2.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileSpreadsheet className="w-5 h-5 text-emerald-700 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-bold font-display text-slate-900 truncate">
              LAPORAN ABSENSI &amp; KEUANGAN TERAPI BCDC
            </h1>
            <p className="text-[11px] text-slate-500 truncate">
              {user.displayName || user.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative inline-flex items-center">
            <Calendar className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
            <select
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
              aria-label="Pilih bulan laporan"
              className="pl-8 pr-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-xs text-slate-800 focus:outline-none focus:border-blue-600"
            >
              {MONTH_OPTIONS_2026.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {exportFeedback && (
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xs">
              <Check className="w-3 h-3" />
              {exportFeedback}
            </span>
          )}

          <button
            onClick={handleCopyToSheets}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-medium rounded-xs transition-colors whitespace-nowrap"
            title="Salin data absensi bulanan agar bisa langsung Paste ke Google Sheets"
          >
            <Copy className="w-3.5 h-3.5" />
            Salin ke Sheets
          </button>

          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium rounded-xs transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export .XLSX
          </button>

          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xs transition-colors whitespace-nowrap"
            title="Keluar dari akun"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar
          </button>
        </div>
      </header>

      {/* Google Sheets-style Worksheet Tabs Bar */}
      <div className="bg-slate-200/80 border-b border-slate-300 px-4 pt-1.5 flex items-center gap-1 overflow-x-auto">
        {SHEET_TABS.map((tab) => {
          const isActive = activeSheet === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSheet(tab.id)}
              className={`px-3.5 py-2 text-xs font-medium rounded-t-md border-t border-x transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
                isActive
                  ? 'bg-white border-slate-300 text-blue-700 font-semibold -mb-px pb-2.5'
                  : 'bg-slate-100/70 border-transparent text-slate-600 hover:bg-white/70 hover:text-slate-900'
              }`}
            >
              <span>{tab.label}</span>
              {tab.id === 'therapists' && openDiffCount > 0 && (
                <span className="font-mono text-[11px] font-semibold text-amber-700 tabular-nums">
                  ({openDiffCount})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Full-Width Sheet Canvas */}
      <main className="flex-1 p-3 sm:p-4 max-w-[1600px] w-full mx-auto">
        {seeding || !dataLoaded ? (
          <div className="space-y-3">
            <div className="h-24 bg-white border border-slate-300 animate-pulse" />
            <div className="h-80 bg-white border border-slate-300 animate-pulse" />
          </div>
        ) : (
          <>
            {activeSheet === 'summary' && (
              <SummarySheet
                monthKey={monthKey}
                onSelectMonth={setMonthKey}
                therapistRecaps={therapistRecaps}
                clientRecaps={clientRecaps}
                discrepancies={discrepancies}
                trends={trends}
                accrualSummary={accrualSummary}
                onSwitchSheet={setActiveSheet}
              />
            )}
            {activeSheet === 'attendance' && (
              <AttendanceSheet
                ownerId={user.uid}
                monthKey={monthKey}
                therapists={therapists}
                entries={entries}
                clientRecaps={clientRecaps}
              />
            )}
            {activeSheet === 'therapists' && (
              <TherapistSheet
                ownerId={user.uid}
                monthKey={monthKey}
                therapists={therapists}
                clients={clients}
                recaps={therapistRecaps}
                discrepancies={discrepancies}
              />
            )}
            {activeSheet === 'spp' && (
              <SppSheet
                ownerId={user.uid}
                monthKey={monthKey}
                therapists={therapists}
                clientRecaps={clientRecaps}
              />
            )}
            {activeSheet === 'accrual' && (
              <AccrualSheet
                ownerId={user.uid}
                monthKey={monthKey}
                accrualSummary={accrualSummary}
              />
            )}
            {activeSheet === 'gsheets' && (
              <GoogleSheetsSyncSheet
                ownerId={user.uid}
                monthKey={monthKey}
                accessToken={accessToken}
                onRefreshGoogleAccess={handleLogin}
                therapists={therapists}
                clients={clients}
                therapistRecaps={therapistRecaps}
                clientRecaps={clientRecaps}
                discrepancies={discrepancies}
                entries={entries}
                accrualSummary={accrualSummary}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
