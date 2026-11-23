import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FilePlus2,
  FolderSearch,
  RefreshCw,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';
import {
  AttendanceEntry,
  Client,
  MONTH_OPTIONS_2026,
  Therapist,
} from '../../types/clinic';
import {
  AccrualSummary,
  ClientMonthlySppRecap,
  DiscrepancyItem,
  TherapistMonthlyRecap,
} from '../../utils/analytics';
import { addClient } from '../../services/clinicService';
import {
  createClinicSpreadsheet,
  DriveSpreadsheetFile,
  extractSpreadsheetId,
  getSpreadsheetMetadata,
  getTargetSheetNames,
  listDriveSpreadsheets,
  ParsedClientImport,
  parseClientsFromSheetRows,
  readSheetValues,
  SpreadsheetMetadata,
  syncMonthlyWorkbookToGoogleSheets,
} from '../../services/googleSheetsService';

interface GoogleSheetsSyncSheetProps {
  ownerId: string;
  monthKey: string;
  accessToken: string | null;
  onRefreshGoogleAccess: () => Promise<void>;
  therapists: Therapist[];
  clients: Client[];
  therapistRecaps: TherapistMonthlyRecap[];
  clientRecaps: ClientMonthlySppRecap[];
  discrepancies: DiscrepancyItem[];
  entries: AttendanceEntry[];
  accrualSummary: AccrualSummary;
}

export const GoogleSheetsSyncSheet: React.FC<GoogleSheetsSyncSheetProps> = ({
  ownerId,
  monthKey,
  accessToken,
  onRefreshGoogleAccess,
  therapists,
  clients,
  therapistRecaps,
  clientRecaps,
  discrepancies,
  entries,
  accrualSummary,
}) => {
  const monthLabel = MONTH_OPTIONS_2026.find((m) => m.key === monthKey)?.label || monthKey;
  const targetTabs = getTargetSheetNames(monthKey).allTabs;

  const [driveFiles, setDriveFiles] = useState<DriveSpreadsheetFile[]>([]);
  const [driveSearch, setDriveSearch] = useState('');
  const [loadingDrive, setLoadingDrive] = useState(false);

  const [manualUrlInput, setManualUrlInput] = useState('');
  const [selectedMeta, setSelectedMeta] = useState<SpreadsheetMetadata | null>(null);
  const [selectedTabTitle, setSelectedTabTitle] = useState<string>('');
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [newSheetTitle, setNewSheetTitle] = useState('LAPORAN ABSENSI TERAPI BCDC 2026');
  const [creatingSheet, setCreatingSheet] = useState(false);

  // Mandatory Confirmation Dialogs
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [pendingImportClients, setPendingImportClients] = useState<ParsedClientImport[] | null>(
    null
  );
  const [importingClients, setImportingClients] = useState(false);

  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
    url?: string;
  } | null>(null);

  const loadDriveFiles = async (search?: string) => {
    if (!accessToken) return;
    setLoadingDrive(true);
    setStatusMessage(null);
    try {
      const files = await listDriveSpreadsheets(accessToken, search);
      setDriveFiles(files);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memuat daftar Google Sheets dari Drive.',
      });
    } finally {
      setLoadingDrive(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      loadDriveFiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const handleSelectSpreadsheet = async (spreadsheetId: string) => {
    if (!accessToken || !spreadsheetId) return;
    setLoadingPreview(true);
    setStatusMessage(null);
    try {
      const meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
      setSelectedMeta(meta);
      const firstTab = meta.sheets[0]?.title || '';
      setSelectedTabTitle(firstTab);
      if (firstTab) {
        const rows = await readSheetValues(accessToken, meta.spreadsheetId, firstTab);
        setPreviewRows(rows);
      } else {
        setPreviewRows([]);
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal membaca metadata Google Sheets.',
      });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleOpenTabPreview = async (tabTitle: string) => {
    if (!accessToken || !selectedMeta) return;
    setSelectedTabTitle(tabTitle);
    setLoadingPreview(true);
    setStatusMessage(null);
    try {
      const rows = await readSheetValues(accessToken, selectedMeta.spreadsheetId, tabTitle);
      setPreviewRows(rows);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal membaca isi tab Google Sheets.',
      });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCreateNewSpreadsheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !newSheetTitle.trim()) return;
    setCreatingSheet(true);
    setStatusMessage(null);
    try {
      const meta = await createClinicSpreadsheet(accessToken, newSheetTitle.trim(), monthKey);
      setSelectedMeta(meta);
      setSelectedTabTitle(meta.sheets[0]?.title || '');
      setPreviewRows([]);
      await loadDriveFiles(driveSearch);
      setStatusMessage({
        type: 'success',
        text: `Spreadsheet "${meta.title}" berhasil dibuat di Google Drive Anda. Klik "Sinkronkan ke Google Sheets" untuk mengisi datanya.`,
        url: meta.spreadsheetUrl,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal membuat spreadsheet baru.',
      });
    } finally {
      setCreatingSheet(false);
    }
  };

  const handleConfirmedSync = async () => {
    if (!accessToken || !selectedMeta) return;
    setSyncing(true);
    setStatusMessage(null);
    try {
      const res = await syncMonthlyWorkbookToGoogleSheets(accessToken, selectedMeta.spreadsheetId, {
        monthKey,
        therapistRecaps,
        clientRecaps,
        discrepancies,
        entries,
        accrualSummary,
      });
      setShowSyncConfirm(false);
      // Refresh preview of current tab
      const refreshedMeta = await getSpreadsheetMetadata(accessToken, selectedMeta.spreadsheetId);
      setSelectedMeta(refreshedMeta);
      const previewTab = res.updatedTabs[0];
      setSelectedTabTitle(previewTab);
      const rows = await readSheetValues(accessToken, selectedMeta.spreadsheetId, previewTab);
      setPreviewRows(rows);
      setStatusMessage({
        type: 'success',
        text: `Berhasil menyinkronkan ${res.updatedTabs.length} tab (${monthLabel}) ke "${refreshedMeta.title}".`,
        url: res.spreadsheetUrl,
      });
    } catch (err) {
      setShowSyncConfirm(false);
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyinkronkan data ke Google Sheets.',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handlePrepareClientImport = () => {
    const parsed = parseClientsFromSheetRows(previewRows);
    const existingNames = new Set(clients.map((c) => c.name.trim().toLowerCase()));
    const onlyNew = parsed.filter((p) => !existingNames.has(p.name.trim().toLowerCase()));
    if (parsed.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'Kolom "NAMA" / "NAMA KLIEN" tidak ditemukan di 15 baris pertama tab ini.',
      });
      return;
    }
    if (onlyNew.length === 0) {
      setStatusMessage({
        type: 'success',
        text: `Semua ${parsed.length} klien yang ditemukan di tab "${selectedTabTitle}" sudah ada di aplikasi.`,
      });
      return;
    }
    setPendingImportClients(onlyNew);
  };

  const handleConfirmImportClients = async () => {
    if (!pendingImportClients || therapists.length === 0) return;
    setImportingClients(true);
    try {
      const defaultTherapistId = therapists[0].id;
      for (const item of pendingImportClients) {
        await addClient(ownerId, {
          name: item.name,
          program: 'Impor Google Sheets',
          defaultSppSessions: item.defaultSppSessions,
          primaryTherapistId: defaultTherapistId,
        });
      }
      setStatusMessage({
        type: 'success',
        text: `${pendingImportClients.length} klien baru berhasil diimpor dari Google Sheets.`,
      });
      setPendingImportClients(null);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal mengimpor klien.',
      });
    } finally {
      setImportingClients(false);
    }
  };

  // If no in-memory Google Workspace OAuth access token is present, ask user to grant/refresh via Google Sign-In
  if (!accessToken) {
    return (
      <div className="bg-white border border-slate-300 p-8 max-w-xl mx-auto my-6 space-y-5 text-center">
        <div className="space-y-1.5">
          <h3 className="text-base font-bold font-display text-slate-900">
            Hubungkan Akses Google Drive &amp; Google Sheets
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Untuk membaca file Google Sheets yang sudah ada di Drive Anda atau mengirim laporan bulanan langsung ke Google Sheets, silakan konfirmasi akses Google Anda terlebih dahulu.
          </p>
        </div>

        <div className="flex justify-center">
          <button
            onClick={onRefreshGoogleAccess}
            className="inline-flex items-center gap-3 px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-md shadow-2xs transition-colors"
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

  return (
    <div className="space-y-4">
      {statusMessage && (
        <div
          className={`px-4 py-3 border text-xs flex flex-wrap items-center justify-between gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          {statusMessage.url && (
            <a
              href={statusMessage.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold underline"
            >
              Buka di Google Sheets <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Panel: Drive File Picker + Create New */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-slate-300 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                1. Pilih Google Sheets dari Drive
              </span>
              <button
                onClick={() => loadDriveFiles(driveSearch)}
                disabled={loadingDrive}
                className="p-1 text-slate-500 hover:text-slate-900"
                title="Muat ulang daftar Drive"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingDrive ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="p-3 border-b border-slate-200 space-y-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loadDriveFiles(driveSearch);
                }}
                className="flex gap-1.5"
              >
                <input
                  type="text"
                  value={driveSearch}
                  onChange={(e) => setDriveSearch(e.target.value)}
                  placeholder="Cari nama file di Drive..."
                  className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xs"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-medium rounded-xs"
                >
                  <FolderSearch className="w-3.5 h-3.5" />
                </button>
              </form>

              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={manualUrlInput}
                  onChange={(e) => setManualUrlInput(e.target.value)}
                  placeholder="Atau tempel link / ID Google Sheets..."
                  className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xs"
                />
                <button
                  type="button"
                  onClick={() => handleSelectSpreadsheet(extractSpreadsheetId(manualUrlInput))}
                  disabled={!manualUrlInput.trim()}
                  className="px-2.5 py-1.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-40 text-white text-xs font-medium rounded-xs"
                >
                  Buka
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-200 max-h-64 overflow-y-auto">
              {loadingDrive ? (
                <div className="p-4 text-xs text-slate-400 text-center">
                  Memuat daftar Google Sheets...
                </div>
              ) : driveFiles.length === 0 ? (
                <div className="p-4 text-xs text-slate-400 text-center">
                  Tidak ada spreadsheet ditemukan di Google Drive.
                </div>
              ) : (
                driveFiles.map((file) => {
                  const isSelected = selectedMeta?.spreadsheetId === file.id;
                  return (
                    <button
                      key={file.id}
                      onClick={() => handleSelectSpreadsheet(file.id)}
                      className={`w-full text-left px-3.5 py-2.5 text-xs transition-colors flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-blue-50 text-blue-900 font-semibold'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <span className="truncate">{file.name}</span>
                      {file.modifiedTime && (
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          {new Date(file.modifiedTime).toLocaleDateString('id-ID')}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Create New Spreadsheet Card */}
          <form
            onSubmit={handleCreateNewSpreadsheet}
            className="bg-white border border-slate-300 p-3.5 space-y-2.5"
          >
            <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <FilePlus2 className="w-3.5 h-3.5 text-emerald-700" />
              Atau Buat Spreadsheet Baru di Drive
            </div>
            <input
              type="text"
              value={newSheetTitle}
              onChange={(e) => setNewSheetTitle(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xs"
            />
            <button
              type="submit"
              disabled={creatingSheet || !newSheetTitle.trim()}
              className="w-full py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-xs font-medium rounded-xs"
            >
              {creatingSheet ? 'Membuat di Drive...' : 'Buat Spreadsheet BCDC Baru'}
            </button>
          </form>
        </div>

        {/* Right Panel: Selected Spreadsheet Tabs, Sync Action & Preview */}
        <div className="lg:col-span-8 bg-white border border-slate-300 overflow-hidden flex flex-col">
          {!selectedMeta ? (
            <div className="p-10 text-center text-xs text-slate-500 my-auto space-y-2">
              <p className="font-medium text-slate-700">
                Pilih salah satu file Google Sheets di sebelah kiri atau buat file baru.
              </p>
              <p>
                Anda bisa mengirim 5 tab rekap ({targetTabs.join(', ')}) ke Google Sheets, atau mengimpor daftar klien dari file Google Sheets yang sudah ada.
              </p>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 bg-slate-100 border-b border-slate-300 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-900 truncate">
                      {selectedMeta.title}
                    </h3>
                    <a
                      href={selectedMeta.spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-700 hover:underline inline-flex items-center gap-0.5 shrink-0"
                    >
                      Buka <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-[11px] font-mono text-slate-500 truncate">
                    ID: {selectedMeta.spreadsheetId}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={handlePrepareClientImport}
                    disabled={previewRows.length === 0 || therapists.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-medium rounded-xs disabled:opacity-40"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Impor Klien dari Tab Ini
                  </button>

                  <button
                    onClick={() => setShowSyncConfirm(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium rounded-xs"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    Sinkronkan ke Google Sheets
                  </button>
                </div>
              </div>

              {/* Actual Tabs inside Selected Google Spreadsheet */}
              <div className="bg-slate-50 border-b border-slate-300 px-3 pt-1.5 flex items-center gap-1 overflow-x-auto">
                {selectedMeta.sheets.map((tab) => (
                  <button
                    key={tab.sheetId}
                    onClick={() => handleOpenTabPreview(tab.title)}
                    className={`px-3 py-1.5 text-xs rounded-t-xs border-t border-x whitespace-nowrap ${
                      selectedTabTitle === tab.title
                        ? 'bg-white border-slate-300 font-semibold text-blue-700 -mb-px pb-2'
                        : 'bg-slate-100 border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.title}
                  </button>
                ))}
              </div>

              {/* Preview Grid */}
              <div className="flex-1 overflow-auto max-h-[460px] sheet-scroll">
                {loadingPreview ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Membaca isi tab &ldquo;{selectedTabTitle}&rdquo;...
                  </div>
                ) : previewRows.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Tab &ldquo;{selectedTabTitle}&rdquo; masih kosong. Klik &ldquo;Sinkronkan ke Google Sheets&rdquo; untuk mengisi data {monthLabel}.
                  </div>
                ) : (
                  <table className="border-collapse text-[11px] w-max min-w-full">
                    <tbody>
                      {previewRows.slice(0, 35).map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className={rIdx === 0 ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'}
                        >
                          <td className="px-2 py-1 border-r border-b border-slate-200 bg-slate-50 font-mono text-slate-400 text-center w-8">
                            {rIdx + 1}
                          </td>
                          {row.slice(0, 20).map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className="px-2.5 py-1 border-r border-b border-slate-200 text-slate-800 whitespace-nowrap max-w-[200px] truncate"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* MANDATORY Confirmation Dialog before Overwriting Google Sheets */}
      {showSyncConfirm && selectedMeta && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-lg max-w-md w-full shadow-xl overflow-hidden">
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" />
                Konfirmasi Pembaruan Google Sheets
              </div>
              <button
                onClick={() => setShowSyncConfirm(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs text-slate-700">
              <p>
                Anda akan menulis dan menimpa isi tab berikut pada file Google Sheets{' '}
                <span className="font-semibold text-slate-900">
                  &ldquo;{selectedMeta.title}&rdquo;
                </span>
                :
              </p>
              <ul className="list-disc pl-5 space-y-1 font-mono text-[11px] text-slate-800">
                {targetTabs.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <p className="text-[11px] text-slate-500">
                Tab lain di luar 5 nama di atas tidak akan diubah. Lanjutkan pembaruan data bulan{' '}
                <span className="font-semibold">{monthLabel}</span>?
              </p>
            </div>
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSyncConfirm(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-xs"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={syncing}
                onClick={handleConfirmedSync}
                className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xs"
              >
                {syncing ? 'Menyinkronkan...' : 'Konfirmasi & Update Google Sheets'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog before Importing Clients from Google Sheets */}
      {pendingImportClients && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-lg max-w-md w-full shadow-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">
                Konfirmasi Impor {pendingImportClients.length} Klien Baru
              </span>
              <button
                onClick={() => setPendingImportClients(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs text-slate-700">
              <p>
                Ditemukan {pendingImportClients.length} klien baru dari tab{' '}
                <span className="font-semibold">&ldquo;{selectedTabTitle}&rdquo;</span>:
              </p>
              <div className="max-h-48 overflow-y-auto border border-slate-200 divide-y divide-slate-100">
                {pendingImportClients.map((c, idx) => (
                  <div key={idx} className="px-3 py-1.5 flex justify-between">
                    <span className="font-medium text-slate-900">{c.name}</span>
                    <span className="font-mono text-slate-500">{c.defaultSppSessions} sesi</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingImportClients(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-xs"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={importingClients}
                onClick={handleConfirmImportClients}
                className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xs"
              >
                {importingClients ? 'Mengimpor...' : 'Konfirmasi & Impor Klien'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
