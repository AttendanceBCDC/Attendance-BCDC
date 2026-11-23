import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { formatRupiah, MONTH_OPTIONS_2026, PaymentStatus } from '../../types/clinic';
import { AccrualSummary } from '../../utils/analytics';
import { upsertSppPackage } from '../../services/clinicService';

interface AccrualSheetProps {
  ownerId: string;
  monthKey: string;
  accrualSummary: AccrualSummary;
}

export const AccrualSheet: React.FC<AccrualSheetProps> = ({
  ownerId,
  monthKey,
  accrualSummary,
}) => {
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const monthLabel = MONTH_OPTIONS_2026.find((m) => m.key === monthKey)?.label || monthKey;

  const filteredItems = useMemo(() => {
    if (!search.trim()) return accrualSummary.items;
    const q = search.trim().toLowerCase();
    return accrualSummary.items.filter((i) =>
      i.clientRecap.client.name.toLowerCase().includes(q)
    );
  }, [accrualSummary.items, search]);

  const handleStatusChange = async (
    clientId: string,
    existingPkgId: string | null,
    paidSessions: number,
    packageName: string,
    sppFee: number,
    nextStatus: PaymentStatus
  ) => {
    setSavingId(clientId);
    try {
      await upsertSppPackage(ownerId, existingPkgId, {
        clientId,
        monthKey,
        paidSessions,
        packageName,
        sppFee,
        paymentStatus: nextStatus,
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* 4 Accounting Summary Cells */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white border border-slate-300 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-4">
          <div className="text-[11px] font-semibold text-slate-500">
            Kas Diterima / SPP Masuk ({monthLabel})
          </div>
          <div className="mt-1 text-lg font-bold font-mono text-slate-900 tabular-nums">
            {formatRupiah(accrualSummary.totalCashReceived)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
            Dari total tagihan {formatRupiah(accrualSummary.totalSppFee)}
          </div>
        </div>

        <div className="p-4">
          <div className="text-[11px] font-semibold text-emerald-700">
            Pendapatan Accrual (Diakui)
          </div>
          <div className="mt-1 text-lg font-bold font-mono text-emerald-700 tabular-nums">
            {formatRupiah(accrualSummary.totalAccrualRevenue)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Sesi hadir + hangus × tarif/sesi
          </div>
        </div>

        <div className="p-4">
          <div className="text-[11px] font-semibold text-blue-700">
            Pendapatan Diterima di Muka
          </div>
          <div className="mt-1 text-lg font-bold font-mono text-blue-700 tabular-nums">
            {formatRupiah(accrualSummary.totalDeferredRevenue)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Saldo kas atas sisa sesi belum dijalankan
          </div>
        </div>

        <div className="p-4">
          <div className="text-[11px] font-semibold text-amber-700">
            Piutang / Sesi Belum Lunas
          </div>
          <div className="mt-1 text-lg font-bold font-mono text-amber-700 tabular-nums">
            {formatRupiah(accrualSummary.totalReceivableAmount)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Sesi terpakai melebihi kas diterima
          </div>
        </div>
      </div>

      {/* Formula Bar & Filter */}
      <div className="bg-white border border-slate-300 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter nama klien..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xs focus:outline-none focus:border-blue-600"
          />
        </div>
        <div className="text-[11px] font-mono text-slate-600">
          Rumus: Accrual = (Hadir + Hangus) × Tarif/Sesi · Diterima Dimuka = MAX(0, Kas − Accrual)
        </div>
      </div>

      {/* Main Accounting Spreadsheet */}
      <div className="bg-white border border-slate-300 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-[11px] font-semibold text-slate-700">
                <th className="py-2.5 px-3 border-r border-slate-200 w-10 text-center">No</th>
                <th className="py-2.5 px-3 border-r border-slate-200 min-w-[175px]">Nama Klien</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-right">Paket SPP</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-right">Tarif / Sesi</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-right">Tagihan SPP</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-center">Status Bayar</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-right bg-slate-50">
                  Kas Diterima
                </th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-right">
                  Sesi Diakui (Hadir+Hangus)
                </th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-right bg-emerald-50/70 text-emerald-900">
                  Pendapatan Accrual
                </th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-right bg-blue-50/70 text-blue-900">
                  Pendapatan Diterima Dimuka
                </th>
                <th className="py-2.5 px-3 text-right bg-amber-50/70 text-amber-900">
                  Piutang / Kurang Bayar
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredItems.map((item, idx) => {
                const cr = item.clientRecap;
                const pkg = cr.sppPackage;
                const currentStatus: PaymentStatus =
                  cr.paymentStatus === 'Cicilan'
                    ? 'Cicilan'
                    : cr.paymentStatus === 'Belum Bayar' || cr.paymentStatus === 'Belum Input'
                    ? 'Belum Bayar'
                    : 'Lunas';

                return (
                  <tr key={cr.client.id} className="hover:bg-slate-50/80">
                    <td className="py-2 px-3 border-r border-slate-200 text-center font-mono text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-medium text-slate-900">
                      {cr.client.name}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-right font-mono tabular-nums text-slate-700">
                      {cr.paidSessions} sesi
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-right font-mono tabular-nums text-slate-600">
                      {formatRupiah(item.ratePerSession)}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-right font-mono tabular-nums text-slate-800">
                      {formatRupiah(item.sppTotalFee)}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-200 text-center">
                      <select
                        disabled={savingId === cr.client.id}
                        value={currentStatus}
                        onChange={(e) =>
                          handleStatusChange(
                            cr.client.id,
                            pkg?.id || null,
                            cr.paidSessions,
                            pkg?.packageName || `Paket ${cr.paidSessions} Sesi`,
                            cr.sppFee,
                            e.target.value as PaymentStatus
                          )
                        }
                        className={`px-2 py-1 text-[11px] font-medium border rounded-xs cursor-pointer ${
                          currentStatus === 'Lunas'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : currentStatus === 'Cicilan'
                            ? 'bg-amber-50 border-amber-200 text-amber-800'
                            : 'bg-red-50 border-red-200 text-red-800'
                        }`}
                      >
                        <option value="Lunas">Lunas (100%)</option>
                        <option value="Cicilan">Cicilan (50%)</option>
                        <option value="Belum Bayar">Belum Bayar (0%)</option>
                      </select>
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-right font-mono tabular-nums font-medium text-slate-900 bg-slate-50/50">
                      {formatRupiah(item.cashReceived)}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-right font-mono tabular-nums text-slate-700">
                      {item.recognizedSessions} sesi
                      {cr.countsByCode.Hangus > 0 && (
                        <span className="text-[10px] text-slate-400 ml-1">
                          ({cr.attendedSessions}+{cr.countsByCode.Hangus}h)
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-right font-mono tabular-nums font-semibold text-emerald-800 bg-emerald-50/30">
                      {formatRupiah(item.accrualRevenue)}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-right font-mono tabular-nums font-semibold text-blue-800 bg-blue-50/30">
                      {item.deferredRevenue > 0 ? formatRupiah(item.deferredRevenue) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-amber-800 bg-amber-50/30">
                      {item.receivableAmount > 0 ? formatRupiah(item.receivableAmount) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 text-white font-semibold text-xs">
                <td colSpan={4} className="py-2.5 px-3 border-r border-slate-700">
                  TOTAL ({monthLabel})
                </td>
                <td className="py-2.5 px-3 border-r border-slate-700 text-right font-mono tabular-nums">
                  {formatRupiah(accrualSummary.totalSppFee)}
                </td>
                <td className="py-2.5 px-3 border-r border-slate-700 text-center text-[11px] text-slate-300">
                  —
                </td>
                <td className="py-2.5 px-3 border-r border-slate-700 text-right font-mono tabular-nums">
                  {formatRupiah(accrualSummary.totalCashReceived)}
                </td>
                <td className="py-2.5 px-3 border-r border-slate-700 text-right font-mono tabular-nums">
                  {accrualSummary.items.reduce((s, i) => s + i.recognizedSessions, 0)} sesi
                </td>
                <td className="py-2.5 px-3 border-r border-slate-700 text-right font-mono tabular-nums text-emerald-300">
                  {formatRupiah(accrualSummary.totalAccrualRevenue)}
                </td>
                <td className="py-2.5 px-3 border-r border-slate-700 text-right font-mono tabular-nums text-sky-300">
                  {formatRupiah(accrualSummary.totalDeferredRevenue)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-300">
                  {formatRupiah(accrualSummary.totalReceivableAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
