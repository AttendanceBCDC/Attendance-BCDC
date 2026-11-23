import React from 'react';
import { ArrowRight } from 'lucide-react';
import {
  formatRupiah,
  MONTH_OPTIONS_2026,
  SPECIALTY_CODES,
  TherapySpecialty,
} from '../../types/clinic';
import {
  AccrualSummary,
  ClientMonthlySppRecap,
  DiscrepancyItem,
  MonthlyTrendPoint,
  TherapistMonthlyRecap,
} from '../../utils/analytics';
import { AttendanceGrowthChart, TherapyDistributionDonut } from '../Charts';

export type SheetTabId = 'summary' | 'attendance' | 'therapists' | 'spp' | 'accrual' | 'gsheets';

interface SummarySheetProps {
  monthKey: string;
  onSelectMonth: (mk: string) => void;
  therapistRecaps: TherapistMonthlyRecap[];
  clientRecaps: ClientMonthlySppRecap[];
  discrepancies: DiscrepancyItem[];
  trends: MonthlyTrendPoint[];
  accrualSummary: AccrualSummary;
  onSwitchSheet: (tab: SheetTabId) => void;
}

export const SummarySheet: React.FC<SummarySheetProps> = ({
  monthKey,
  onSelectMonth,
  therapistRecaps,
  clientRecaps,
  discrepancies,
  trends,
  accrualSummary,
  onSwitchSheet,
}) => {
  const monthLabel = MONTH_OPTIONS_2026.find((m) => m.key === monthKey)?.label || monthKey;

  const totalSystemHours = Number(
    therapistRecaps.reduce((s, r) => s + r.systemHours, 0).toFixed(1)
  );
  const totalSystemSessions = therapistRecaps.reduce((s, r) => s + r.systemSessions, 0);

  const totalPaidSpp = clientRecaps.reduce((s, c) => s + c.paidSessions, 0);
  const totalAttended = clientRecaps.reduce((s, c) => s + c.attendedSessions, 0);
  const sppRate =
    totalPaidSpp > 0 ? Math.round((totalAttended / totalPaidSpp) * 1000) / 10 : 0;

  const openDiffCount = discrepancies.filter((d) => d.issueType !== 'matched').length;
  const netDiffHours = Number(
    therapistRecaps.reduce((s, r) => s + r.discrepancyHours, 0).toFixed(1)
  );

  const currentTrend = trends.find((t) => t.monthKey === monthKey);
  const momDelta = currentTrend?.momGrowthPct ?? null;

  const hoursBySpecialty = SPECIALTY_CODES.reduce((acc, code) => {
    acc[code] = Number(
      therapistRecaps
        .reduce((sum, r) => sum + (r.hoursByCode[code] || 0), 0)
        .toFixed(1)
    );
    return acc;
  }, {} as Record<TherapySpecialty, number>);

  return (
    <div className="space-y-4">
      {/* Spreadsheet-style Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white border border-slate-300 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-4">
          <div className="text-[11px] font-semibold text-slate-500">
            Total Jam Terapis ({monthLabel})
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">
              {totalSystemHours} jam
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              ({totalSystemSessions} sesi)
            </span>
          </div>
          <button
            onClick={() => onSwitchSheet('therapists')}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:underline"
          >
            Kelola &amp; Edit Terapis <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="p-4">
          <div className="text-[11px] font-semibold text-slate-500">
            Kehadiran vs Paket SPP
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">
              {sppRate}%
            </span>
            {momDelta !== null && (
              <span
                className={`text-xs font-mono font-semibold tabular-nums ${
                  momDelta >= 0 ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {momDelta >= 0 ? '+' : ''}
                {momDelta}% MoM
              </span>
            )}
          </div>
          <div className="mt-2 text-[11px] text-slate-500 tabular-nums">
            {totalAttended} hadir dari {totalPaidSpp} sesi dibayar
          </div>
        </div>

        <div className="p-4">
          <div className="text-[11px] font-semibold text-slate-500">
            Selisih Isian Terapis vs Sistem
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-xl font-bold font-mono tabular-nums ${
                openDiffCount > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {openDiffCount} selisih
            </span>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              ({netDiffHours > 0 ? '+' : ''}
              {netDiffHours}j)
            </span>
          </div>
          <button
            onClick={() => onSwitchSheet('therapists')}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:underline"
          >
            Buka Sheet Terapis &amp; Selisih <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="p-4">
          <div className="text-[11px] font-semibold text-slate-500">
            Pendapatan Accrual / Dimuka
          </div>
          <div className="mt-1 font-mono font-bold text-base text-slate-900 tabular-nums">
            {formatRupiah(accrualSummary.totalAccrualRevenue)}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-mono tabular-nums">
              Dimuka: {formatRupiah(accrualSummary.totalDeferredRevenue)}
            </span>
            <button
              onClick={() => onSwitchSheet('accrual')}
              className="font-medium text-blue-700 hover:underline"
            >
              Detail
            </button>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-white border border-slate-300 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold font-display text-slate-900">
              Pertumbuhan Tingkat Kehadiran (% per Bulan)
            </h3>
            <button
              onClick={() => onSwitchSheet('spp')}
              className="text-xs font-medium text-blue-700 hover:underline"
            >
              Sheet SPP &amp; Klien
            </button>
          </div>
          <AttendanceGrowthChart
            trends={trends}
            selectedMonthKey={monthKey}
            onSelectMonth={onSelectMonth}
          />
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-300 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold font-display text-slate-900">
              Porsi Jam per Jenis Terapi ({monthLabel})
            </h3>
            <button
              onClick={() => onSwitchSheet('attendance')}
              className="text-xs font-medium text-blue-700 hover:underline"
            >
              Sheet Absensi
            </button>
          </div>
          <TherapyDistributionDonut hoursByCode={hoursBySpecialty} />
        </div>
      </div>

      {/* Compact Spreadsheet Table: Rekap Jam & Klien per Terapis */}
      <div className="bg-white border border-slate-300 overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-800">
            Ringkasan Jam &amp; Klien per Terapis — {monthLabel}
          </span>
          <button
            onClick={() => onSwitchSheet('therapists')}
            className="text-xs font-medium text-blue-700 hover:underline"
          >
            Edit / Tambah / Hapus Terapis →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-300 text-[11px] font-semibold text-slate-600">
                <th className="py-2 px-3 border-r border-slate-200 w-10 text-center">No</th>
                <th className="py-2 px-3 border-r border-slate-200">Nama Terapis / Psikolog</th>
                <th className="py-2 px-3 border-r border-slate-200 text-center">Bidang</th>
                <th className="py-2 px-3 border-r border-slate-200 text-right">Klien Unik</th>
                <th className="py-2 px-3 border-r border-slate-200 text-right">Jam Sistem</th>
                <th className="py-2 px-3 border-r border-slate-200 text-right">Isian Terapis</th>
                <th className="py-2 px-3 border-r border-slate-200 text-right">Selisih</th>
                <th className="py-2 px-3 border-r border-slate-200 text-right">Weekday</th>
                <th className="py-2 px-3 text-right">Sabtu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {therapistRecaps.map((r, i) => {
                const hasDiff = Math.abs(r.discrepancyHours) > 0.01 || r.discrepancyCount > 0;
                return (
                  <tr key={r.therapist.id} className="hover:bg-blue-50/30">
                    <td className="py-2 px-3 border-r border-slate-200 text-center font-mono text-slate-500">
                      {i + 1}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-medium text-slate-900">
                      {r.therapist.name}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-center font-mono font-semibold text-slate-700">
                      {r.therapist.specialty}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-right font-mono tabular-nums text-blue-700 font-semibold">
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
                        hasDiff ? 'text-amber-700 bg-amber-50/60' : 'text-emerald-700'
                      }`}
                    >
                      {hasDiff
                        ? `${r.discrepancyHours > 0 ? '+' : ''}${r.discrepancyHours}`
                        : '0'}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-right font-mono tabular-nums text-slate-600">
                      {r.weekdayHours}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                      {r.saturdayHours}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
