import React, { useMemo, useState } from 'react';
import {
  Check,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  Client,
  CODE_META_MAP,
  MONTH_OPTIONS_2026,
  SPECIALTY_CODES,
  THERAPY_CODE_LIST,
  Therapist,
  TherapyCode,
  TherapySpecialty,
} from '../../types/clinic';
import { DiscrepancyItem, TherapistMonthlyRecap } from '../../utils/analytics';
import {
  addTherapist,
  addTherapistClaim,
  deleteTherapist,
  deleteTherapistClaim,
  updateTherapist,
  updateTherapistClaimStatus,
  upsertAttendanceEntry,
} from '../../services/clinicService';

interface TherapistSheetProps {
  ownerId: string;
  monthKey: string;
  therapists: Therapist[];
  clients: Client[];
  recaps: TherapistMonthlyRecap[];
  discrepancies: DiscrepancyItem[];
}

export const TherapistSheet: React.FC<TherapistSheetProps> = ({
  ownerId,
  monthKey,
  therapists,
  clients,
  recaps,
  discrepancies,
}) => {
  const monthLabel = MONTH_OPTIONS_2026.find((m) => m.key === monthKey)?.label || monthKey;

  // Inline Edit Therapist State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editSpec, setEditSpec] = useState<TherapySpecialty>('SI');
  const [editTarget, setEditTarget] = useState(72);
  const [editActive, setEditActive] = useState(true);

  // Confirm Delete Therapist inline state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Inline Add New Therapist Row
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Terapis');
  const [newSpec, setNewSpec] = useState<TherapySpecialty>('SI');
  const [newTarget, setNewTarget] = useState(72);

  // Filter & Inline Add Claim Row
  const [filterTherapistId, setFilterTherapistId] = useState('all');
  const [showOnlyIssues, setShowOnlyIssues] = useState(true);
  const [claimTherapistId, setClaimTherapistId] = useState(therapists[0]?.id || '');
  const [claimClientId, setClaimClientId] = useState(clients[0]?.id || '');
  const [claimDay, setClaimDay] = useState(15);
  const [claimCode, setClaimCode] = useState<TherapyCode>('SI');
  const [claimHours, setClaimHours] = useState(1);
  const [claimNote, setClaimNote] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const startEdit = (t: Therapist) => {
    setEditingId(t.id);
    setEditName(t.name);
    setEditRole(t.roleTitle);
    setEditSpec(t.specialty);
    setEditTarget(t.monthlyTargetHours);
    setEditActive(t.active);
    setConfirmDeleteId(null);
    setDeleteError(null);
  };

  const handleSaveEdit = async (tId: string) => {
    if (!editName.trim()) return;
    setBusyKey(`edit_${tId}`);
    try {
      await updateTherapist(tId, {
        name: editName,
        roleTitle: editRole || 'Terapis',
        specialty: editSpec,
        monthlyTargetHours: editTarget,
        active: editActive,
      });
      setEditingId(null);
    } finally {
      setBusyKey(null);
    }
  };

  const handleAddTherapist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusyKey('add_t');
    try {
      await addTherapist(ownerId, {
        name: newName,
        roleTitle: newRole || 'Terapis',
        specialty: newSpec,
        monthlyTargetHours: newTarget,
      });
      setNewName('');
    } finally {
      setBusyKey(null);
    }
  };

  const handleDeleteTherapist = async (tId: string) => {
    setDeleteError(null);
    const remaining = therapists.filter((t) => t.id !== tId);
    const affectedClients = clients.filter((c) => c.primaryTherapistId === tId);
    if (affectedClients.length > 0 && remaining.length === 0) {
      setDeleteError('Minimal sisakan 1 terapis karena masih ada klien yang terdaftar.');
      return;
    }
    setBusyKey(`del_${tId}`);
    try {
      await deleteTherapist(tId, affectedClients, remaining[0]?.id);
      setConfirmDeleteId(null);
    } finally {
      setBusyKey(null);
    }
  };

  const filteredDiscrepancies = useMemo(() => {
    return discrepancies.filter((d) => {
      if (filterTherapistId !== 'all' && d.therapistId !== filterTherapistId) return false;
      if (showOnlyIssues && d.issueType === 'matched') return false;
      return true;
    });
  }, [discrepancies, filterTherapistId, showOnlyIssues]);

  const handleAddClaimRow = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedT = claimTherapistId || therapists[0]?.id;
    const resolvedC = claimClientId || clients[0]?.id;
    if (!resolvedT || !resolvedC) return;
    setBusyKey('add_claim');
    try {
      await addTherapistClaim(ownerId, {
        monthKey,
        dayOfMonth: Number(claimDay) || 1,
        therapistId: resolvedT,
        clientId: resolvedC,
        code: claimCode,
        claimedHours: Number(claimHours) || 1,
        reconcileStatus: 'pending',
        claimNote,
      });
      setClaimNote('');
    } finally {
      setBusyKey(null);
    }
  };

  const handleAcceptToSystem = async (item: DiscrepancyItem) => {
    if (!item.claim) return;
    setBusyKey(item.id);
    try {
      await upsertAttendanceEntry(ownerId, item.systemEntry?.id || null, {
        monthKey,
        dayOfMonth: item.dayOfMonth,
        slot: item.systemEntry?.slot || 1,
        clientId: item.clientId,
        therapistId: item.therapistId,
        code: item.claim.code,
        hours: item.claim.claimedHours,
        notes: item.claim.claimNote || 'Sinkronisasi dari klaim terapis',
      });
      await updateTherapistClaimStatus(item.claim.id, {
        code: item.claim.code,
        claimedHours: item.claim.claimedHours,
        reconcileStatus: 'resolved',
        claimNote: item.claim.claimNote || 'Disesuaikan ke sistem',
      });
    } finally {
      setBusyKey(null);
    }
  };

  const handleResolveClaim = async (item: DiscrepancyItem) => {
    if (!item.claim) return;
    setBusyKey(item.id);
    try {
      await updateTherapistClaimStatus(item.claim.id, {
        code: item.claim.code,
        claimedHours: item.claim.claimedHours,
        reconcileStatus: 'resolved',
        claimNote: item.claim.claimNote || 'Selesai dicek',
      });
    } finally {
      setBusyKey(null);
    }
  };

  const handleConfirmMatchFromSystem = async (item: DiscrepancyItem) => {
    if (!item.systemEntry) return;
    setBusyKey(item.id);
    try {
      await addTherapistClaim(ownerId, {
        monthKey,
        dayOfMonth: item.dayOfMonth,
        therapistId: item.therapistId,
        clientId: item.clientId,
        code: item.systemEntry.code,
        claimedHours: item.systemEntry.hours,
        reconcileStatus: 'matched',
        claimNote: 'Sesuai jadwal sistem',
      });
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Sheet 1: Master & Rekap Terapis (Inline Edit / Add / Delete) */}
      <div className="bg-white border border-slate-300 overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-semibold text-slate-800">
              Data Terapis, Rekap Jam &amp; Klien ({monthLabel})
            </span>
            <span className="text-[11px] text-slate-500 ml-2">
              · Klik ikon pensil untuk edit nama/bidang, atau hapus langsung di baris
            </span>
          </div>
          {deleteError && <span className="text-xs text-red-700 font-medium">{deleteError}</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-300 text-[11px] font-semibold text-slate-600">
                <th className="py-2 px-3 border-r border-slate-200 w-10 text-center">No</th>
                <th className="py-2 px-3 border-r border-slate-200 min-w-[200px]">Nama Terapis / Psikolog</th>
                <th className="py-2 px-3 border-r border-slate-200 min-w-[160px]">Jabatan</th>
                <th className="py-2 px-3 border-r border-slate-200 text-center">Bidang</th>
                <th className="py-2 px-3 border-r border-slate-200 text-right">Target (Jam)</th>
                <th className="py-2 px-3 border-r border-slate-200 text-right">Klien Unik</th>
                <th className="py-2 px-3 border-r border-slate-200 text-right">Jam Sistem</th>
                <th className="py-2 px-3 border-r border-slate-200 text-right">Isian Terapis</th>
                <th className="py-2 px-3 border-r border-slate-200 text-right">Selisih</th>
                <th className="py-2 px-3 text-center w-28">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {recaps.map((r, idx) => {
                const t = r.therapist;
                const isEditing = editingId === t.id;
                const isConfirmDel = confirmDeleteId === t.id;
                const hasDiff = Math.abs(r.discrepancyHours) > 0.01 || r.discrepancyCount > 0;

                return (
                  <tr key={t.id} className={isEditing ? 'bg-blue-50/40' : 'hover:bg-slate-50'}>
                    <td className="py-2 px-3 border-r border-slate-200 text-center font-mono text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-200">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          maxLength={100}
                          className="w-full px-2 py-1 text-xs bg-white border border-blue-500 rounded-xs"
                        />
                      ) : (
                        <div className="px-1">
                          <span className="font-medium text-slate-900">{t.name}</span>
                          {!t.active && (
                            <span className="ml-1.5 text-[10px] text-slate-400">(Nonaktif)</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-200">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          maxLength={80}
                          className="w-full px-2 py-1 text-xs bg-white border border-blue-500 rounded-xs"
                        />
                      ) : (
                        <span className="px-1 text-slate-600">{t.roleTitle}</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-200 text-center">
                      {isEditing ? (
                        <select
                          value={editSpec}
                          onChange={(e) => setEditSpec(e.target.value as TherapySpecialty)}
                          className="px-1.5 py-1 text-xs font-mono bg-white border border-blue-500 rounded-xs"
                        >
                          {SPECIALTY_CODES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-mono font-semibold text-slate-800">{t.specialty}</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-200 text-right font-mono tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          min={1}
                          max={400}
                          value={editTarget}
                          onChange={(e) => setEditTarget(Number(e.target.value))}
                          className="w-16 px-1.5 py-1 text-xs text-right bg-white border border-blue-500 rounded-xs"
                        />
                      ) : (
                        <span className="text-slate-600">{t.monthlyTargetHours}</span>
                      )}
                    </td>
                    <td
                      className="py-2 px-3 border-r border-slate-200 text-right font-mono tabular-nums text-blue-700 font-semibold"
                      title={r.clientNames.join(', ')}
                    >
                      {r.uniqueClientsCount}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {r.systemHours}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-right font-mono tabular-nums text-slate-700">
                      {r.claimedHours}
                    </td>
                    <td
                      className={`py-2 px-3 border-r border-slate-200 text-right font-mono tabular-nums font-semibold ${
                        hasDiff ? 'text-amber-700 bg-amber-50/70' : 'text-emerald-700'
                      }`}
                    >
                      {hasDiff
                        ? `${r.discrepancyHours > 0 ? '+' : ''}${r.discrepancyHours}`
                        : '0'}
                    </td>
                    <td className="py-1.5 px-2 text-center whitespace-nowrap">
                      {isEditing ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleSaveEdit(t.id)}
                            disabled={busyKey === `edit_${t.id}`}
                            className="p-1 bg-blue-700 text-white rounded-xs hover:bg-blue-800"
                            title="Simpan perubahan"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 bg-slate-200 text-slate-700 rounded-xs hover:bg-slate-300"
                            title="Batal"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : isConfirmDel ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleDeleteTherapist(t.id)}
                            disabled={busyKey === `del_${t.id}`}
                            className="px-2 py-0.5 bg-red-600 text-white text-[11px] font-medium rounded-xs hover:bg-red-700"
                          >
                            Hapus
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-1.5 py-0.5 bg-slate-200 text-slate-700 text-[11px] rounded-xs"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => startEdit(t)}
                            className="p-1 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-xs"
                            title="Edit nama & data terapis"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setConfirmDeleteId(t.id);
                              setEditingId(null);
                              setDeleteError(null);
                            }}
                            className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xs"
                            title="Hapus terapis"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Inline Add Therapist Row */}
              <tr className="bg-slate-50/90 border-t-2 border-slate-300">
                <td className="py-2 px-3 border-r border-slate-200 text-center text-blue-700 font-bold">
                  +
                </td>
                <td className="py-1.5 px-2 border-r border-slate-200">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ketik nama terapis baru..."
                    maxLength={100}
                    className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded-xs focus:outline-none focus:border-blue-600"
                  />
                </td>
                <td className="py-1.5 px-2 border-r border-slate-200">
                  <input
                    type="text"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    placeholder="Jabatan (mis. Psikolog)"
                    maxLength={80}
                    className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded-xs focus:outline-none focus:border-blue-600"
                  />
                </td>
                <td className="py-1.5 px-2 border-r border-slate-200 text-center">
                  <select
                    value={newSpec}
                    onChange={(e) => setNewSpec(e.target.value as TherapySpecialty)}
                    className="px-1.5 py-1 text-xs font-mono bg-white border border-slate-300 rounded-xs"
                  >
                    {SPECIALTY_CODES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1.5 px-2 border-r border-slate-200 text-right">
                  <input
                    type="number"
                    min={1}
                    max={400}
                    value={newTarget}
                    onChange={(e) => setNewTarget(Number(e.target.value))}
                    className="w-16 px-1.5 py-1 text-xs font-mono text-right bg-white border border-slate-300 rounded-xs"
                  />
                </td>
                <td colSpan={4} className="py-1.5 px-3 border-r border-slate-200 text-[11px] text-slate-400">
                  Baris tambah terapis baru langsung
                </td>
                <td className="py-1.5 px-2 text-center">
                  <button
                    onClick={handleAddTherapist}
                    disabled={!newName.trim() || busyKey === 'add_t'}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-40 text-white text-[11px] font-medium rounded-xs"
                  >
                    <Plus className="w-3 h-3" />
                    Tambah
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Sheet 2: Audit Selisih Isian Terapis vs Sistem */}
      <div className="bg-white border border-slate-300 overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-800">
              Audit Selisih Absensi Terapis vs Sistem ({monthLabel})
            </span>
            <select
              value={filterTherapistId}
              onChange={(e) => setFilterTherapistId(e.target.value)}
              className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-xs"
            >
              <option value="all">Semua Terapis</option>
              {therapists.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyIssues}
              onChange={(e) => setShowOnlyIssues(e.target.checked)}
              className="rounded-xs"
            />
            Tampilkan hanya yang ada selisih
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-300 text-[11px] font-semibold text-slate-600">
                <th className="py-2 px-3 border-r border-slate-200 w-16">Tgl</th>
                <th className="py-2 px-3 border-r border-slate-200">Terapis</th>
                <th className="py-2 px-3 border-r border-slate-200">Klien</th>
                <th className="py-2 px-3 border-r border-slate-200">Kenyataan Sistem</th>
                <th className="py-2 px-3 border-r border-slate-200">Isian Terapis</th>
                <th className="py-2 px-3 border-r border-slate-200 text-right">Selisih (Jam)</th>
                <th className="py-2 px-3 border-r border-slate-200">Status &amp; Catatan</th>
                <th className="py-2 px-3 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredDiscrepancies.map((item) => {
                const isMismatch = item.issueType !== 'matched';
                const sysMeta = item.systemEntry ? CODE_META_MAP[item.systemEntry.code] : null;
                const clmMeta = item.claim ? CODE_META_MAP[item.claim.code] : null;
                return (
                  <tr
                    key={item.id}
                    className={isMismatch ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-slate-50'}
                  >
                    <td className="py-2 px-3 border-r border-slate-200 font-mono tabular-nums">
                      {item.dayOfMonth}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-medium text-slate-900">
                      {item.therapistName}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-slate-700">
                      {item.clientName}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-mono">
                      {item.systemEntry && sysMeta ? (
                        `${item.systemEntry.code} (${item.systemHours}j)`
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-mono">
                      {item.claim && clmMeta ? (
                        `${item.claim.code} (${item.claimedHours}j)`
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td
                      className={`py-2 px-3 border-r border-slate-200 text-right font-mono font-semibold tabular-nums ${
                        item.diffHours !== 0 ? 'text-amber-700' : 'text-slate-400'
                      }`}
                    >
                      {item.diffHours > 0 ? `+${item.diffHours}` : item.diffHours}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 max-w-xs">
                      <span
                        className={`font-medium ${
                          isMismatch ? 'text-amber-800' : 'text-emerald-700'
                        }`}
                      >
                        {item.statusLabel}
                      </span>
                      {item.note && (
                        <span className="text-slate-500 ml-1.5">— {item.note}</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap space-x-1">
                      {item.claim && isMismatch && (
                        <>
                          <button
                            disabled={busyKey === item.id}
                            onClick={() => handleAcceptToSystem(item)}
                            className="px-2 py-1 bg-blue-700 hover:bg-blue-800 text-white text-[11px] font-medium rounded-xs"
                          >
                            Terima ke Sistem
                          </button>
                          <button
                            disabled={busyKey === item.id}
                            onClick={() => handleResolveClaim(item)}
                            className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 text-[11px] rounded-xs"
                          >
                            Tandai Selesai
                          </button>
                        </>
                      )}
                      {item.issueType === 'missing_in_claim' && (
                        <button
                          disabled={busyKey === item.id}
                          onClick={() => handleConfirmMatchFromSystem(item)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] rounded-xs"
                        >
                          Cocokkan
                        </button>
                      )}
                      {item.claim && (
                        <button
                          disabled={busyKey === item.id}
                          onClick={() => deleteTherapistClaim(item.claim!.id)}
                          className="p-1 text-slate-400 hover:text-red-600"
                          title="Hapus baris klaim"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Inline Add Therapist Claim Row */}
              <tr className="bg-slate-50/90 border-t-2 border-slate-300">
                <td className="py-1.5 px-2 border-r border-slate-200">
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={claimDay}
                    onChange={(e) => setClaimDay(Number(e.target.value))}
                    className="w-12 px-1.5 py-1 text-xs font-mono bg-white border border-slate-300 rounded-xs"
                  />
                </td>
                <td className="py-1.5 px-2 border-r border-slate-200">
                  <select
                    value={claimTherapistId || therapists[0]?.id || ''}
                    onChange={(e) => setClaimTherapistId(e.target.value)}
                    className="w-full px-1.5 py-1 text-xs bg-white border border-slate-300 rounded-xs"
                  >
                    {therapists.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1.5 px-2 border-r border-slate-200">
                  <select
                    value={claimClientId || clients[0]?.id || ''}
                    onChange={(e) => setClaimClientId(e.target.value)}
                    className="w-full px-1.5 py-1 text-xs bg-white border border-slate-300 rounded-xs"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1.5 px-2 border-r border-slate-200 text-slate-400 text-[11px]">
                  Otomatis cek
                </td>
                <td className="py-1.5 px-2 border-r border-slate-200">
                  <select
                    value={claimCode}
                    onChange={(e) => setClaimCode(e.target.value as TherapyCode)}
                    className="w-full px-1.5 py-1 text-xs font-mono bg-white border border-slate-300 rounded-xs"
                  >
                    {THERAPY_CODE_LIST.map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.code}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1.5 px-2 border-r border-slate-200 text-right">
                  <input
                    type="number"
                    step={0.5}
                    min={0}
                    max={12}
                    value={claimHours}
                    onChange={(e) => setClaimHours(Number(e.target.value))}
                    className="w-14 px-1.5 py-1 text-xs font-mono text-right bg-white border border-slate-300 rounded-xs"
                  />
                </td>
                <td className="py-1.5 px-2 border-r border-slate-200">
                  <input
                    type="text"
                    value={claimNote}
                    onChange={(e) => setClaimNote(e.target.value)}
                    placeholder="Catatan isian terapis..."
                    maxLength={240}
                    className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded-xs"
                  />
                </td>
                <td className="py-1.5 px-3 text-right">
                  <button
                    onClick={handleAddClaimRow}
                    disabled={busyKey === 'add_claim' || therapists.length === 0 || clients.length === 0}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-700 hover:bg-blue-800 text-white text-[11px] font-medium rounded-xs"
                  >
                    <Plus className="w-3 h-3" />
                    Input Klaim
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
