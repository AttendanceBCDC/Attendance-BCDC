import React, { useMemo, useState } from 'react';
import { Check, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import {
  Client,
  formatRupiah,
  MONTH_OPTIONS_2026,
  PaymentStatus,
  Therapist,
} from '../../types/clinic';
import { ClientMonthlySppRecap } from '../../utils/analytics';
import {
  addClient,
  deleteClient,
  updateClient,
  upsertSppPackage,
} from '../../services/clinicService';

interface SppSheetProps {
  ownerId: string;
  monthKey: string;
  therapists: Therapist[];
  clientRecaps: ClientMonthlySppRecap[];
}

export const SppSheet: React.FC<SppSheetProps> = ({
  ownerId,
  monthKey,
  therapists,
  clientRecaps,
}) => {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'under' | 'full' | 'issues'>('all');

  // Inline Edit Client + SPP Row
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editProgram, setEditProgram] = useState('');
  const [editSessions, setEditSessions] = useState(8);
  const [editFee, setEditFee] = useState(1800000);
  const [editPayStatus, setEditPayStatus] = useState<PaymentStatus>('Lunas');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Inline Add Client Row
  const [newName, setNewName] = useState('');
  const [newProgram, setNewProgram] = useState('Sensori Integrasi');
  const [newSessions, setNewSessions] = useState(8);
  const [newTherapistId, setNewTherapistId] = useState(therapists[0]?.id || '');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const monthLabel = MONTH_OPTIONS_2026.find((m) => m.key === monthKey)?.label || monthKey;

  const filtered = useMemo(() => {
    return clientRecaps.filter((cr) => {
      if (search.trim() && !cr.client.name.toLowerCase().includes(search.trim().toLowerCase())) {
        return false;
      }
      if (filterMode === 'under') return cr.utilizationPct < 75;
      if (filterMode === 'full') return cr.utilizationPct >= 100;
      if (filterMode === 'issues') return cr.countsByCode.Hutang > 0 || cr.countsByCode.Hangus > 0;
      return true;
    });
  }, [clientRecaps, search, filterMode]);

  const startEdit = (cr: ClientMonthlySppRecap) => {
    setEditingClientId(cr.client.id);
    setEditName(cr.client.name);
    setEditProgram(cr.client.program);
    setEditSessions(cr.paidSessions);
    setEditFee(cr.sppFee);
    setEditPayStatus(
      cr.paymentStatus === 'Cicilan'
        ? 'Cicilan'
        : cr.paymentStatus === 'Belum Bayar' || cr.paymentStatus === 'Belum Input'
        ? 'Belum Bayar'
        : 'Lunas'
    );
    setConfirmDeleteId(null);
  };

  const handleSaveRow = async (cr: ClientMonthlySppRecap) => {
    if (!editName.trim()) return;
    setBusyKey(`save_${cr.client.id}`);
    try {
      await updateClient(cr.client.id, {
        name: editName,
        program: editProgram || 'Terapi Reguler',
        defaultSppSessions: editSessions,
        primaryTherapistId: cr.client.primaryTherapistId,
        active: cr.client.active,
      });
      await upsertSppPackage(ownerId, cr.sppPackage?.id || null, {
        clientId: cr.client.id,
        monthKey,
        paidSessions: editSessions,
        packageName: `Paket ${editSessions} Sesi`,
        sppFee: editFee,
        paymentStatus: editPayStatus,
      });
      setEditingClientId(null);
    } finally {
      setBusyKey(null);
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedTherapist = newTherapistId || therapists[0]?.id;
    if (!newName.trim() || !resolvedTherapist) return;
    setBusyKey('add_client');
    try {
      await addClient(ownerId, {
        name: newName,
        program: newProgram || 'Sensori Integrasi',
        defaultSppSessions: newSessions,
        primaryTherapistId: resolvedTherapist,
      });
      setNewName('');
    } finally {
      setBusyKey(null);
    }
  };

  const handleDelete = async (client: Client) => {
    setBusyKey(`del_${client.id}`);
    try {
      await deleteClient(client.id);
      setConfirmDeleteId(null);
    } finally {
      setBusyKey(null);
    }
  };

  const totalPaid = clientRecaps.reduce((s, c) => s + c.paidSessions, 0);
  const totalAttended = clientRecaps.reduce((s, c) => s + c.attendedSessions, 0);
  const totalFee = clientRecaps.reduce((s, c) => s + c.sppFee, 0);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white border border-slate-300 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama klien..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xs focus:outline-none focus:border-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 p-0.5 bg-slate-100 border border-slate-200 rounded-xs">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-2.5 py-1 text-xs font-medium rounded-xs ${
              filterMode === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
            }`}
          >
            Semua ({clientRecaps.length})
          </button>
          <button
            onClick={() => setFilterMode('under')}
            className={`px-2.5 py-1 text-xs font-medium rounded-xs ${
              filterMode === 'under' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
            }`}
          >
            &lt; 75% Hadir
          </button>
          <button
            onClick={() => setFilterMode('full')}
            className={`px-2.5 py-1 text-xs font-medium rounded-xs ${
              filterMode === 'full' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
            }`}
          >
            Penuh ≥ 100%
          </button>
          <button
            onClick={() => setFilterMode('issues')}
            className={`px-2.5 py-1 text-xs font-medium rounded-xs ${
              filterMode === 'issues' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
            }`}
          >
            Hutang / Hangus
          </button>
        </div>
      </div>

      {/* Spreadsheet Table */}
      <div className="bg-white border border-slate-300 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-[11px] font-semibold text-slate-700">
                <th className="py-2.5 px-3 border-r border-slate-200 w-10 text-center">No</th>
                <th className="py-2.5 px-3 border-r border-slate-200 min-w-[175px]">Nama Klien</th>
                <th className="py-2.5 px-3 border-r border-slate-200 min-w-[155px]">Program</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-right">Paket (Sesi)</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-right">Nominal SPP</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-center">Status Bayar</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-right">Hadir</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-right">Sisa</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-right">I / G / U / H</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-right">% SPP</th>
                <th className="py-2.5 px-3 text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((cr, idx) => {
                const isEdit = editingClientId === cr.client.id;
                const isDel = confirmDeleteId === cr.client.id;

                return (
                  <tr key={cr.client.id} className={isEdit ? 'bg-blue-50/40' : 'hover:bg-slate-50'}>
                    <td className="py-2 px-3 border-r border-slate-200 text-center font-mono text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-200">
                      {isEdit ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          maxLength={100}
                          className="w-full px-2 py-1 text-xs bg-white border border-blue-500 rounded-xs"
                        />
                      ) : (
                        <span className="px-1 font-medium text-slate-900">{cr.client.name}</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-200">
                      {isEdit ? (
                        <input
                          type="text"
                          value={editProgram}
                          onChange={(e) => setEditProgram(e.target.value)}
                          maxLength={80}
                          className="w-full px-2 py-1 text-xs bg-white border border-blue-500 rounded-xs"
                        />
                      ) : (
                        <span className="px-1 text-slate-600">{cr.client.program}</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-200 text-right font-mono tabular-nums">
                      {isEdit ? (
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={editSessions}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setEditSessions(val);
                            setEditFee(val * 225000);
                          }}
                          className="w-16 px-1.5 py-1 text-xs text-right bg-white border border-blue-500 rounded-xs"
                        />
                      ) : (
                        <span className="font-semibold text-slate-800">{cr.paidSessions}</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-200 text-right font-mono tabular-nums">
                      {isEdit ? (
                        <input
                          type="number"
                          min={0}
                          step={5000}
                          value={editFee}
                          onChange={(e) => setEditFee(Number(e.target.value))}
                          className="w-28 px-1.5 py-1 text-xs text-right bg-white border border-blue-500 rounded-xs"
                        />
                      ) : (
                        <span>{formatRupiah(cr.sppFee)}</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-200 text-center">
                      {isEdit ? (
                        <select
                          value={editPayStatus}
                          onChange={(e) => setEditPayStatus(e.target.value as PaymentStatus)}
                          className="px-1.5 py-1 text-xs bg-white border border-blue-500 rounded-xs"
                        >
                          <option value="Lunas">Lunas</option>
                          <option value="Cicilan">Cicilan</option>
                          <option value="Belum Bayar">Belum Bayar</option>
                        </select>
                      ) : (
                        <span
                          className={`font-medium ${
                            cr.paymentStatus === 'Lunas'
                              ? 'text-emerald-700'
                              : cr.paymentStatus === 'Cicilan'
                              ? 'text-amber-700'
                              : 'text-red-600'
                          }`}
                        >
                          {cr.paymentStatus}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-right font-mono font-semibold tabular-nums text-slate-900">
                      {cr.attendedSessions}
                    </td>
                    <td
                      className={`py-2 px-3 border-r border-slate-200 text-right font-mono font-semibold tabular-nums ${
                        cr.remainingSessions < 0
                          ? 'text-red-600'
                          : cr.remainingSessions > 0
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {cr.remainingSessions}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-right font-mono tabular-nums text-slate-500">
                      {cr.countsByCode.Izin}/{cr.countsByCode.Ganti}/{cr.countsByCode.Hutang}/
                      {cr.countsByCode.Hangus}
                    </td>
                    <td
                      className={`py-2 px-3 border-r border-slate-200 text-right font-mono font-semibold tabular-nums ${
                        cr.utilizationPct >= 90
                          ? 'text-emerald-700 bg-emerald-50/40'
                          : cr.utilizationPct >= 65
                          ? 'text-blue-700'
                          : 'text-amber-700 bg-amber-50/50'
                      }`}
                    >
                      {cr.utilizationPct}%
                    </td>
                    <td className="py-1.5 px-2 text-center whitespace-nowrap">
                      {isEdit ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleSaveRow(cr)}
                            disabled={busyKey === `save_${cr.client.id}`}
                            className="p-1 bg-blue-700 text-white rounded-xs hover:bg-blue-800"
                            title="Simpan baris"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingClientId(null)}
                            className="p-1 bg-slate-200 text-slate-700 rounded-xs"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : isDel ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(cr.client)}
                            disabled={busyKey === `del_${cr.client.id}`}
                            className="px-2 py-0.5 bg-red-600 text-white text-[11px] font-medium rounded-xs"
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
                            onClick={() => startEdit(cr)}
                            className="p-1 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-xs"
                            title="Edit klien & paket SPP"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setConfirmDeleteId(cr.client.id);
                              setEditingClientId(null);
                            }}
                            className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xs"
                            title="Hapus klien"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Inline Add New Client Row */}
              <tr className="bg-slate-50/90 border-t-2 border-slate-300">
                <td className="py-2 px-3 border-r border-slate-200 text-center text-blue-700 font-bold">
                  +
                </td>
                <td className="py-1.5 px-2 border-r border-slate-200">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ketik nama klien baru..."
                    maxLength={100}
                    className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded-xs focus:outline-none focus:border-blue-600"
                  />
                </td>
                <td className="py-1.5 px-2 border-r border-slate-200">
                  <input
                    type="text"
                    value={newProgram}
                    onChange={(e) => setNewProgram(e.target.value)}
                    placeholder="Program terapi"
                    maxLength={80}
                    className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded-xs"
                  />
                </td>
                <td className="py-1.5 px-2 border-r border-slate-200 text-right">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={newSessions}
                    onChange={(e) => setNewSessions(Number(e.target.value))}
                    className="w-16 px-1.5 py-1 text-xs font-mono text-right bg-white border border-slate-300 rounded-xs"
                  />
                </td>
                <td colSpan={2} className="py-1.5 px-2 border-r border-slate-200">
                  <select
                    value={newTherapistId || therapists[0]?.id || ''}
                    onChange={(e) => setNewTherapistId(e.target.value)}
                    className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded-xs"
                  >
                    {therapists.map((t) => (
                      <option key={t.id} value={t.id}>
                        PJ: {t.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td colSpan={4} className="py-1.5 px-3 border-r border-slate-200 text-[11px] text-slate-400">
                  Tambah klien langsung ke spreadsheet
                </td>
                <td className="py-1.5 px-2 text-center">
                  <button
                    onClick={handleAddClient}
                    disabled={!newName.trim() || busyKey === 'add_client' || therapists.length === 0}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-40 text-white text-[11px] font-medium rounded-xs"
                  >
                    <Plus className="w-3 h-3" />
                    Tambah
                  </button>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 text-white font-semibold text-xs">
                <td colSpan={3} className="py-2.5 px-3 border-r border-slate-700">
                  TOTAL ({monthLabel})
                </td>
                <td className="py-2.5 px-3 border-r border-slate-700 text-right font-mono tabular-nums">
                  {totalPaid}
                </td>
                <td className="py-2.5 px-3 border-r border-slate-700 text-right font-mono tabular-nums">
                  {formatRupiah(totalFee)}
                </td>
                <td className="py-2.5 px-3 border-r border-slate-700 text-center text-slate-300">
                  —
                </td>
                <td className="py-2.5 px-3 border-r border-slate-700 text-right font-mono tabular-nums">
                  {totalAttended}
                </td>
                <td className="py-2.5 px-3 border-r border-slate-700 text-right font-mono tabular-nums">
                  {totalPaid - totalAttended}
                </td>
                <td className="py-2.5 px-3 border-r border-slate-700 text-right font-mono text-slate-300">
                  —
                </td>
                <td className="py-2.5 px-3 border-r border-slate-700 text-right font-mono tabular-nums">
                  {totalPaid > 0 ? Math.round((totalAttended / totalPaid) * 1000) / 10 : 0}%
                </td>
                <td className="py-2.5 px-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
