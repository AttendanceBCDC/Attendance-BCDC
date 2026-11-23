import React, { useState } from 'react';
import { CODE_META_MAP, TherapySpecialty } from '../types/clinic';
import { MonthlyTrendPoint, TherapistMonthlyRecap } from '../utils/analytics';

interface AttendanceGrowthChartProps {
  trends: MonthlyTrendPoint[];
  selectedMonthKey: string;
  onSelectMonth: (monthKey: string) => void;
}

export const AttendanceGrowthChart: React.FC<AttendanceGrowthChartProps> = ({
  trends,
  selectedMonthKey,
  onSelectMonth,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (trends.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-sm text-slate-400">
        Belum ada data tren bulanan yang tercatat.
      </div>
    );
  }

  const width = 560;
  const height = 210;
  const padLeft = 44;
  const padRight = 24;
  const padTop = 24;
  const padBottom = 34;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const points = trends.map((t, i) => {
    const x =
      trends.length === 1
        ? padLeft + chartW / 2
        : padLeft + (i / (trends.length - 1)) * chartW;
    const clampedPct = Math.max(0, Math.min(115, t.attendanceRatePct));
    const y = padTop + chartH - (clampedPct / 115) * chartH;
    return { x, y, data: t };
  });

  const linePath = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padTop + chartH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padTop + chartH).toFixed(1)} Z`
      : '';

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : points.find((p) => p.data.monthKey === selectedMonthKey) || points[points.length - 1];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs text-slate-500">
            Bulan dipilih:{' '}
            <span className="font-medium text-slate-900">{activePoint.data.label}</span>
          </p>
          <div className="flex items-baseline gap-2.5 mt-0.5">
            <span className="text-2xl font-bold font-display text-slate-900 tabular-nums">
              {activePoint.data.attendanceRatePct}%
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              {activePoint.data.totalAttended} / {activePoint.data.totalPaidSpp} sesi SPP
            </span>
            {activePoint.data.momGrowthPct !== null && (
              <span
                className={`text-xs font-medium tabular-nums ${
                  activePoint.data.momGrowthPct >= 0 ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {activePoint.data.momGrowthPct >= 0 ? '+' : ''}
                {activePoint.data.momGrowthPct}% vs bln lalu
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-500">Total Jam Terapis</span>
          <p className="text-sm font-semibold font-mono text-slate-800 tabular-nums">
            {activePoint.data.totalTherapistHours} jam
          </p>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        <defs>
          <linearGradient id="attendanceAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1D4ED8" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {[0, 25, 50, 75, 100].map((tick) => {
          const y = padTop + chartH - (tick / 115) * chartH;
          return (
            <g key={tick}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke={tick === 100 ? '#cbd5e1' : '#f1f5f9'}
                strokeDasharray={tick === 100 ? '4 4' : undefined}
                strokeWidth="1"
              />
              <text
                x={padLeft - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-400 text-[10px] font-mono tabular-nums"
              >
                {tick}%
              </text>
            </g>
          );
        })}

        {points.length > 1 && <path d={areaPath} fill="url(#attendanceAreaGrad)" />}
        {points.length > 1 && (
          <path
            d={linePath}
            fill="none"
            stroke="#1D4ED8"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {points.map((p, idx) => {
          const isSelected = p.data.monthKey === selectedMonthKey;
          const isHovered = hoveredIdx === idx;
          return (
            <g
              key={p.data.monthKey}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() => onSelectMonth(p.data.monthKey)}
            >
              <circle cx={p.x} cy={p.y} r={16} fill="transparent" />
              <circle
                cx={p.x}
                cy={p.y}
                r={isSelected || isHovered ? 6 : 4.5}
                fill={isSelected ? '#1D4ED8' : '#FFFFFF'}
                stroke="#1D4ED8"
                strokeWidth="2.5"
              />
              <text
                x={p.x}
                y={p.y - 11}
                textAnchor="middle"
                className="fill-slate-700 text-[10px] font-semibold font-mono tabular-nums"
              >
                {p.data.attendanceRatePct}%
              </text>
              <text
                x={p.x}
                y={height - 10}
                textAnchor="middle"
                className={`text-[11px] font-medium ${
                  isSelected ? 'fill-blue-700 font-semibold' : 'fill-slate-500'
                }`}
              >
                {p.data.shortLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

interface TherapyDistributionDonutProps {
  hoursByCode: Record<TherapySpecialty, number>;
}

export const TherapyDistributionDonut: React.FC<TherapyDistributionDonutProps> = ({
  hoursByCode,
}) => {
  const specialties: TherapySpecialty[] = ['SI', 'TW', 'BT', 'OT', 'E', 'RM', 'FS'];
  const items = specialties
    .map((code) => ({
      code,
      meta: CODE_META_MAP[code],
      hours: hoursByCode[code] || 0,
    }))
    .filter((i) => i.hours > 0)
    .sort((a, b) => b.hours - a.hours);

  const totalHours = items.reduce((sum, i) => sum + i.hours, 0);

  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-40 h-40 shrink-0">
        <svg viewBox="0 0 150 150" className="w-full h-full -rotate-90">
          <circle
            cx="75"
            cy="75"
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="20"
          />
          {totalHours > 0 &&
            items.map((item) => {
              const fraction = item.hours / totalHours;
              const dash = fraction * circumference;
              const offset = -cumulative * circumference;
              cumulative += fraction;
              return (
                <circle
                  key={item.code}
                  cx="75"
                  cy="75"
                  r={radius}
                  fill="none"
                  stroke={item.meta.hex}
                  strokeWidth="20"
                  strokeDasharray={`${dash} ${circumference}`}
                  strokeDashoffset={offset}
                />
              );
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold font-display text-slate-900 tabular-nums">
            {Number(totalHours.toFixed(1))}
          </span>
          <span className="text-[11px] text-slate-500">Total Jam</span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-slate-400">Belum ada sesi terapi pada bulan ini.</p>
        ) : (
          items.map((item) => {
            const pct = totalHours > 0 ? Math.round((item.hours / totalHours) * 100) : 0;
            return (
              <div key={item.code} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: item.meta.hex }}
                  />
                  <span className="font-mono font-semibold text-slate-700 w-5 shrink-0">
                    {item.code}
                  </span>
                  <span className="text-slate-600 truncate">{item.meta.label}</span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 tabular-nums font-mono">
                  <span className="font-semibold text-slate-900">{item.hours}j</span>
                  <span className="text-slate-400 w-9 text-right">{pct}%</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

interface TherapistComparisonChartProps {
  recaps: TherapistMonthlyRecap[];
}

export const TherapistComparisonChart: React.FC<TherapistComparisonChartProps> = ({
  recaps,
}) => {
  const maxHours = Math.max(
    10,
    ...recaps.map((r) => Math.max(r.systemHours, r.claimedHours, r.therapist.monthlyTargetHours))
  );

  return (
    <div className="space-y-3.5">
      {recaps.map((r) => {
        const sysPct = Math.min(100, (r.systemHours / maxHours) * 100);
        const clmPct = Math.min(100, (r.claimedHours / maxHours) * 100);
        const hasDiff = Math.abs(r.discrepancyHours) > 0.01 || r.discrepancyCount > 0;
        return (
          <div key={r.therapist.id} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-slate-800 truncate">{r.therapist.name}</span>
                <span className="text-slate-400 shrink-0">·</span>
                <span className="text-slate-500 shrink-0 tabular-nums">
                  {r.uniqueClientsCount} klien
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
                <span className="text-slate-700">Sistem: {r.systemHours}j</span>
                <span className="text-slate-500">Isian: {r.claimedHours}j</span>
                {hasDiff && (
                  <span className="text-amber-700 font-semibold">
                    ({r.discrepancyHours > 0 ? '+' : ''}
                    {r.discrepancyHours}j)
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <div className="h-2 bg-slate-100 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-blue-700 rounded-sm transition-all duration-200"
                  style={{ width: `${sysPct}%` }}
                />
              </div>
              <div className="h-1.5 bg-slate-100 rounded-sm overflow-hidden">
                <div
                  className={`h-full rounded-sm transition-all duration-200 ${
                    hasDiff ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${clmPct}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-5 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-2 bg-blue-700 rounded-xs inline-block" />
          Jam Kenyataan Sistem
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-1.5 bg-emerald-500 rounded-xs inline-block" />
          Laporan Terapis (Cocok)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-1.5 bg-amber-500 rounded-xs inline-block" />
          Laporan Terapis (Ada Selisih)
        </span>
      </div>
    </div>
  );
};
