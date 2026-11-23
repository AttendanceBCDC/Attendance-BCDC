import React, { useMemo, useState } from 'react';
import { Plus, Search, Trash2, X } from 'lucide-react';
import {
  AttendanceEntry,
  Client,
  CODE_META_MAP,
  getMonthCalendarDays,
  MONTH_OPTIONS_2026,
  THERAPY_CODE_LIST,
  Therapist,
  TherapyCode,
} from '../../types/clinic';
import { ClientMonthlySppRecap } from '../../utils/analytics';
import {
  addClient,
  deleteAttendanceEntry,
  upsertAttendanceEntry,
} from '../../services/clinicService';

interface AttendanceSheetProps {
  ownerId: string;
  monthKey: string;
  therapists: Therapist[];
  entries: AttendanceEntry[];
  clientRecaps: ClientMonthlySppRecap[];
}

interface ActiveCellState {
  client: Client;
  day: number;
  dayCode: string;
  slot: 1 | 2;
  existing?: AttendanceEntry;
}

export const AttendanceSheet: React.FC<AttendanceSheetProps> = ({
  ownerId,
  monthKey,
  therapists,
  entries,
  clientRecaps,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTherapistId, setFilterTherapistId] = useState<string>('all');
  const [filterCode, setFilterCode] = useState<string>('all');
  const [activeCell, setActiveCell] = useState<ActiveCellState | null>(null);

  const [formTherapistId, setFormTherapistId] = useState('');
  const [formCode, setFormCode] = useState<TherapyCode>('SI');
  const [formHours, setFormHours] = useState<number>(1);
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Quick inline Add Client row at bottom of sheet
  const [newClientName, setNewClientName] = useState('');
  const [newClientSpp, setNewClientSpp] = useState(8);

  const monthLabel = MONTH_OPTIONS_2026.find((m) => m.key === monthKey)?.label || monthKey;
  const { weekdays, saturdays } = useMemo(() => getMonthCalendarDays(monthKey), [monthKey]);
  const monthEntries = useMemo(
    () => entries.filter((e) => e.monthKey === monthKey),
    [entries, monthKey]
  );

  const therapistMap = useMemo(
    () => new Map(therapists.map((t) => [t.id, t])),
    [therapists]
  );

  const entryLookup = useMemo(() => {
    const map = new Map<string, AttendanceEntry>();
    for (const e of monthEntries) {
      map.set(`${e.clientId}__${e.dayOfMonth}__${e.slot}`, e);
    }
    return map;
  }, [monthEntries]);

  const filteredRecaps = useMemo(() => {
    return clientRecaps.filter((cr) => {
      if (
        searchTerm.trim() &&
        !cr.client.name.toLowerCase().includes(searchTerm.trim().toLowerCase())
      ) {
        return false;
      }
      if (filterTherapistId !== 'all') {
        const hasT = monthEntries.some(
          (e) => e.clientId === cr.client.id && e.therapistId === filterTherapistId
        );
        if (!hasT && cr.client.primaryTherapistId !== filterTherapistId) return false;
      }
      if (filterCode !== 'all') {
        const hasC = monthEntries.some(
          (e) => e.clientId === cr.client.id && e.code === filterCode
        );
        if (!hasC) return false;
      }
      return true;
    });
  }, [clientRecaps, searchTerm, filterTherapistId, filterCode, monthEntries]);

  const openCellModal = (client: Client, day: number, dayCode: string, slot: 1 | 2) => {
    const existing = entryLookup.get(`${client.id}__${day}__${slot}`);
    setActiveCell({ client, day, dayCode, slot, existing });
    setFormTherapistId(
      existing?.therapistId || client.primaryTherapistId || therapists[0]?.id || ''
    );
    setFormCode(existing?.code || 'SI');
    setFormHours(existing?.hours ?? 1);
    setFormNotes(existing?.notes || '');
  };

  const handleSaveCell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCell || !formTherapistId) return;
    setSaving(true);
    try {
      await upsertAttendanceEntry(ownerId, activeCell.existing?.id || null, {
        monthKey,
        dayOfMonth: activeCell.day,
        slot: activeCell.slot,
        clientId: activeCell.client.id,
        therapistId: formTherapistId,
        code: formCode,
        hours: formHours,
        notes: formNotes,
      });
      setActiveCell(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCell = async () => {
    if (!activeCell?.existing) return;
    setSaving(true);
    try {
      await deleteAttendanceEntry(activeCell.existing.id);
      setActiveCell(null);
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim() || therapists.length === 0) return;
    setSaving(true);
    try {
      await addClient(ownerId, {
        name: newClientName,
        program: 'Terapi Reguler',
        defaultSppSessions: newClientSpp,
        primaryTherapistId: therapists[0].id,
      });
      setNewClientName('');
    } finally {
      setSaving(false);
    }
  };

  const renderDayCell = (
    client: Client,
    day: number,
    dayCode: string,
    slot: 1 | 2,
    isHoliday: boolean
  ) => {
    const entry = entryLookup.get(`${client.id}__${day}__${slot}`);
    const meta = entry ? CODE_META_MAP[entry.code] : null;
    const therapistName = entry ? therapistMap.get(entry.therapistId)?.name : '';

    return (
      <td
        key={`${day}-${slot}`}
        onClick={() => openCellModal(client, day, dayCode, slot)}
        title={
          entry
            ? `${entry.code} (${meta?.label}) · ${therapistName} · ${entry.hours} jam${
                entry.notes ? ` · ${entry.notes}` : ''
              }`
            : `Klik untuk isi Sesi ${slot} tanggal ${day}`
        }
        className={`w-8 min-w-8 h-6 border-r border-b border-slate-200 text-center cursor-pointer select-none transition-colors ${
          entry && meta
            ? `${meta.bgClass} ${meta.textClass} font-semibold`
            : isHoliday
            ? 'bg-red-50/70 hover:bg-red-100/80'
            : 'bg-white hover:bg-blue-50/70'
        }`}
      >
        {entry && meta ? (
          <span className="font-mono text-[11px] leading-none">{meta.short}</span>
        ) : (
          <span className="text-[10px] text-slate-200 hover:text-blue-400">+</span>
        )}
      </td>
    );
  };

  return (
    <div className="space-y-3">
      {/* Compact Sheet Filter & Legend Bar */}
      <div className="bg-white border border-slate-300 px-3 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-52">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari klien..."
              className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xs focus:outline-none focus:border-blue-600"
            />
          </div>
          <select
            value={filterTherapistId}
            onChange={(e) => setFilterTherapistId(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xs"
          >
            <option value="all">Semua Terapis</option>
            {therapists.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            value={filterCode}
            onChange={(e) => setFilterCode(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xs"
          >
            <option value="all">Semua Kode</option>
            {THERAPY_CODE_LIST.map((m) => (
              <option key={m.code} value={m.code}>
                {m.short} = {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-600">
          {THERAPY_CODE_LIST.map((m) => (
            <span key={m.code} className="inline-flex items-center gap-1">
              <span
                className={`inline-flex items-center justify-center w-4 h-4 rounded-xs font-mono text-[10px] font-bold border ${m.bgClass} ${m.textClass} ${m.borderClass}`}
              >
                {m.short}
              </span>
              <span>{m.code}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Main Spreadsheet Matrix */}
      <div className="bg-white border border-slate-300 overflow-hidden">
        <div className="overflow-x-auto sheet-scroll">
          <table className="border-collapse text-xs w-max min-w-full">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-[11px] font-semibold text-slate-700">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-20 bg-slate-100 border-r border-slate-300 px-2 py-2 w-10 text-center"
                >
                  NO
                </th>
                <th
                  rowSpan={2}
                  className="sticky left-10 z-20 bg-slate-100 border-r border-slate-300 px-3 py-2 min-w-[170px] text-left"
                >
                  NAMA KLIEN
                </th>
                <th
                  rowSpan={2}
                  className="sticky left-[210px] z-20 bg-slate-100 border-r-2 border-slate-400 px-2 py-2 w-14 text-center"
                >
                  SPP
                </th>
                <th
                  colSpan={weekdays.length}
                  className="border-r-2 border-slate-400 py-1.5 text-center bg-blue-50 text-blue-900"
                >
                  Week Day ({monthLabel})
                </th>
                <th
                  colSpan={saturdays.length}
                  className="border-r-2 border-slate-400 py-1.5 text-center bg-indigo-50 text-indigo-900"
                >
                  Sabtu
                </th>
                <th
                  colSpan={THERAPY_CODE_LIST.length + 2}
                  className="py-1.5 text-center bg-slate-100 text-slate-800"
                >
                  Keterangan (Hitung Otomatis)
                </th>
              </tr>

              <tr className="border-b border-slate-300 text-[10px] font-semibold">
                {weekdays.map((d) => (
                  <th
                    key={d.day}
                    title={d.holidayLabel || `${d.dayCode} ${d.day}`}
                    className={`w-8 min-w-8 py-1 border-r border-slate-200 text-center leading-tight ${
                      d.isHoliday ? 'bg-red-600 text-white' : 'bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>{d.dayCode}</div>
                    <div className="font-mono tabular-nums">{d.day}</div>
                  </th>
                ))}
                {saturdays.map((d, i) => (
                  <th
                    key={d.day}
                    title={d.holidayLabel || `Sabtu ${d.day}`}
                    className={`w-8 min-w-8 py-1 text-center leading-tight ${
                      i === saturdays.length - 1
                        ? 'border-r-2 border-slate-400'
                        : 'border-r border-slate-200'
                    } ${d.isHoliday ? 'bg-red-600 text-white' : 'bg-indigo-50/40 text-indigo-900'}`}
                  >
                    <div>{d.dayCode}</div>
                    <div className="font-mono tabular-nums">{d.day}</div>
                  </th>
                ))}
                {THERAPY_CODE_LIST.map((m) => (
                  <th
                    key={m.code}
                    className={`w-10 min-w-10 px-1 py-1.5 border-r border-slate-200 text-center ${m.bgClass} ${m.textClass}`}
                    title={m.label}
                  >
                    {m.code}
                  </th>
                ))}
                <th className="w-12 min-w-12 px-1 py-1.5 border-r border-slate-200 text-center bg-slate-100 text-slate-900">
                  Total
                </th>
                <th className="w-14 min-w-14 px-1 py-1.5 text-center bg-slate-100 text-slate-900">
                  % SPP
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredRecaps.map((cr, idx) => (
                <React.Fragment key={cr.client.id}>
                  <tr>
                    <td
                      rowSpan={2}
                      className="sticky left-0 z-10 bg-white border-r border-b border-slate-300 text-center font-mono text-slate-500 tabular-nums"
                    >
                      {idx + 1}
                    </td>
                    <td
                      rowSpan={2}
                      className="sticky left-10 z-10 bg-white border-r border-b border-slate-300 px-3 py-1"
                    >
                      <div className="font-medium text-slate-900 truncate max-w-[155px]">
                        {cr.client.name}
                      </div>
                    </td>
                    <td
                      rowSpan={2}
                      className="sticky left-[210px] z-10 bg-amber-50/50 border-r-2 border-b border-slate-400 text-center font-mono font-semibold text-slate-800 tabular-nums"
                    >
                      {cr.paidSessions}
                    </td>

                    {weekdays.map((d) =>
                      renderDayCell(cr.client, d.day, d.dayCode, 1, d.isHoliday)
                    )}
                    {saturdays.map((d) =>
                      renderDayCell(cr.client, d.day, d.dayCode, 1, d.isHoliday)
                    )}

                    {THERAPY_CODE_LIST.map((m) => (
                      <td
                        key={m.code}
                        rowSpan={2}
                        className="border-r border-b border-slate-200 text-center font-mono tabular-nums text-slate-700 bg-slate-50/30"
                      >
                        {cr.countsByCode[m.code] > 0 ? (
                          <span className="font-semibold text-slate-900">
                            {cr.countsByCode[m.code]}
                          </span>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </td>
                    ))}
                    <td
                      rowSpan={2}
                      className="border-r border-b border-slate-200 text-center font-mono font-bold text-slate-900 bg-slate-100/70 tabular-nums"
                    >
                      {cr.attendedSessions}
                    </td>
                    <td
                      rowSpan={2}
                      className={`border-b border-slate-200 text-center font-mono font-semibold tabular-nums ${
                        cr.utilizationPct >= 90
                          ? 'text-emerald-700 bg-emerald-50/50'
                          : cr.utilizationPct >= 65
                          ? 'text-blue-700 bg-blue-50/40'
                          : 'text-amber-700 bg-amber-50/60'
                      }`}
                    >
                      {cr.utilizationPct}%
                    </td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    {weekdays.map((d) =>
                      renderDayCell(cr.client, d.day, d.dayCode, 2, d.isHoliday)
                    )}
                    {saturdays.map((d) =>
                      renderDayCell(cr.client, d.day, d.dayCode, 2, d.isHoliday)
                    )}
                  </tr>
                </React.Fragment>
              ))}

              {/* Quick Inline Add Client Row */}
              <tr className="bg-slate-50 border-t-2 border-slate-300">
                <td className="sticky left-0 z-10 bg-slate-50 border-r border-slate-300 text-center font-bold text-blue-700">
                  +
                </td>
                <td className="sticky left-10 z-10 bg-slate-50 border-r border-slate-300 px-2 py-1.5">
                  <input
                    type="text"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="Tambah nama klien baru..."
                    maxLength={100}
                    className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded-xs"
                  />
                </td>
                <td className="sticky left-[210px] z-10 bg-slate-50 border-r-2 border-slate-400 px-1 py-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={newClientSpp}
                    onChange={(e) => setNewClientSpp(Number(e.target.value))}
                    className="w-12 px-1 py-1 text-xs font-mono text-center bg-white border border-slate-300 rounded-xs"
                  />
                </td>
                <td
                  colSpan={weekdays.length + saturdays.length + THERAPY_CODE_LIST.length + 2}
                  className="px-3 py-1.5"
                >
                  <button
                    onClick={handleQuickAddClient}
                    disabled={!newClientName.trim() || saving || therapists.length === 0}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-40 text-white text-xs font-medium rounded-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Klien ke Sheet
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Cell Modal */}
      {activeCell && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-lg w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold font-display text-slate-900">
                  Isi Sel Absensi — {activeCell.client.name}
                </h4>
                <p className="text-xs text-slate-500">
                  {activeCell.dayCode} {activeCell.day} {monthLabel} · Slot {activeCell.slot}
                </p>
              </div>
              <button
                onClick={() => setActiveCell(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCell} className="p-4 space-y-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  Terapis / Psikolog
                </label>
                <select
                  value={formTherapistId}
                  onChange={(e) => setFormTherapistId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xs"
                >
                  {therapists.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.specialty})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  Kode Terapi / Status
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {THERAPY_CODE_LIST.map((m) => (
                    <button
                      type="button"
                      key={m.code}
                      onClick={() => setFormCode(m.code)}
                      className={`px-2 py-1.5 rounded-xs border text-left text-[11px] flex items-center gap-1.5 ${
                        formCode === m.code
                          ? 'border-blue-700 ring-2 ring-blue-600/20 font-semibold'
                          : 'border-slate-200'
                      } ${m.bgClass} ${m.textClass}`}
                    >
                      <span className="font-mono font-bold uppercase w-4">{m.short}</span>
                      <span className="truncate">{m.code}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Durasi (Jam)</label>
                  <select
                    value={formHours}
                    onChange={(e) => setFormHours(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xs"
                  >
                    <option value={0.5}>0.5 jam</option>
                    <option value={1}>1 jam</option>
                    <option value={1.5}>1.5 jam</option>
                    <option value={2}>2 jam</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Catatan</label>
                  <input
                    type="text"
                    maxLength={240}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Opsional..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                {activeCell.existing ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleDeleteCell}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 rounded-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Sel
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveCell(null)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium rounded-xs"
                  >
                    {saving ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
