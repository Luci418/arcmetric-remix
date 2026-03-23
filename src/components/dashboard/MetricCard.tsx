import { motion } from 'framer-motion';
import { WPSSpecSet, getMetricStatus, MetricStatus, MetricKey } from '@/lib/weldTypes';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  metricKey: MetricKey;
  value: number;
  specs: WPSSpecSet;
}

const statusConfig: Record<MetricStatus, { bg: string; text: string; label: string }> = {
  ok: { bg: 'bg-status-ok\/10', text: 'status-ok', label: 'Normal' },
  warning: { bg: 'bg-status-warning\/10', text: 'status-warning', label: 'Warning' },
  critical: { bg: 'bg-status-critical\/10', text: 'status-critical', label: 'Critical' },
};

const metricColors: Record<string, { bg: string; text: string; accent: string }> = {
  current: { bg: 'bg-metric-current\/10', text: 'text-metric-current', accent: 'bg-metric-current' },
  voltage: { bg: 'bg-metric-voltage\/10', text: 'text-metric-voltage', accent: 'bg-metric-voltage' },
  gasflow: { bg: 'bg-metric-gasflow\/10', text: 'text-metric-gasflow', accent: 'bg-metric-gasflow' },
  wirefeed: { bg: 'bg-metric-wirefeed\/10', text: 'text-metric-wirefeed', accent: 'bg-metric-wirefeed' },
  temperature: { bg: 'bg-metric-temperature\/10', text: 'text-metric-temperature', accent: 'bg-metric-temperature' },
};

export function MetricCard({ metricKey, value, specs }: MetricCardProps) {
  const spec = specs[metricKey];
  const status = getMetricStatus(value, spec.wpsMin, spec.wpsMax);
  const sConfig = statusConfig[status];
  const mColor = metricColors[metricKey];

  // Skip rendering range bar for N/A metrics (max === 0)
  const isNA = spec.max === 0;

  const rangePercent = isNA ? 0 : ((value - spec.min) / (spec.max - spec.min)) * 100;
  const wpsMinPercent = isNA ? 0 : ((spec.wpsMin - spec.min) / (spec.max - spec.min)) * 100;
  const wpsMaxPercent = isNA ? 0 : ((spec.wpsMax - spec.min) / (spec.max - spec.min)) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-5 shadow-sm"
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{spec.label}</span>
        {isNA ? (
          <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-muted-foreground bg-muted">N/A</span>
        ) : (
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', sConfig.bg, sConfig.text)}>
            {sConfig.label}
          </span>
        )}
      </div>

      <div className="mb-4 flex items-baseline gap-1.5">
        <motion.span
          key={value}
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 1 }}
          className={cn('font-mono-data text-3xl font-bold', isNA ? 'text-muted-foreground' : mColor.text)}
        >
          {isNA ? '—' : value.toFixed(1)}
        </motion.span>
        <span className="text-sm text-muted-foreground">{spec.unit}</span>
      </div>

      {!isNA && (
        <>
          <div className="relative h-2 w-full rounded-full bg-muted">
            <div
              className={cn('absolute top-0 h-full rounded-full opacity-30', mColor.accent)}
              style={{ left: `${wpsMinPercent}%`, width: `${wpsMaxPercent - wpsMinPercent}%` }}
            />
            <motion.div
              className={cn('absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card shadow-md', mColor.accent)}
              animate={{ left: `${Math.min(100, Math.max(0, rangePercent))}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground font-mono-data">
            <span>{spec.wpsMin}{spec.unit}</span>
            <span>WPS Range</span>
            <span>{spec.wpsMax}{spec.unit}</span>
          </div>
        </>
      )}
    </motion.div>
  );
}
