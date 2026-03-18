import { ShieldCheck, ShieldAlert, Shield, Settings2 } from 'lucide-react';
import { WeldDataPoint, WPSSpecSet, getMetricStatus, MetricKey, WELD_PROCESS_PRESETS } from '@/lib/weldTypes';
import { cn } from '@/lib/utils';

interface WPSInfoBarProps {
  current: WeldDataPoint;
  specs: WPSSpecSet;
  activePresetId: string;
}

const METRIC_KEYS: MetricKey[] = ['current', 'voltage', 'gasflow', 'wirefeed'];

export function WPSInfoBar({ current, specs, activePresetId }: WPSInfoBarProps) {
  const statuses = METRIC_KEYS.map((key) => {
    const spec = specs[key];
    const isNA = spec.max === 0;
    return {
      key,
      label: spec.label.split(' ').pop() ?? spec.label,
      status: isNA ? ('ok' as const) : getMetricStatus(current[key], spec.wpsMin, spec.wpsMax),
      isNA,
    };
  });

  const activeStatuses = statuses.filter((s) => !s.isNA);
  const allOk = activeStatuses.every((s) => s.status === 'ok');
  const hasCritical = activeStatuses.some((s) => s.status === 'critical');

  const preset = WELD_PROCESS_PRESETS.find((p) => p.id === activePresetId);
  const wpsLabel = preset ? preset.name : 'Custom WPS';

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-1.5 text-xs">
      {allOk ? (
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 status-ok" />
      ) : hasCritical ? (
        <ShieldAlert className="h-3.5 w-3.5 shrink-0 status-critical" />
      ) : (
        <Shield className="h-3.5 w-3.5 shrink-0 status-warning" />
      )}

      <span className="text-muted-foreground">
        <span className="font-medium text-foreground">{wpsLabel}</span>
        {preset && <span className="ml-1">· {preset.process}</span>}
      </span>

      <div className="ml-auto flex items-center gap-1.5">
        {statuses
          .filter((s) => !s.isNA)
          .map((s) => (
            <span
              key={s.key}
              className={cn(
                'inline-flex h-1.5 w-1.5 rounded-full',
                s.status === 'ok' && 'bg-status-ok',
                s.status === 'warning' && 'bg-status-warning',
                s.status === 'critical' && 'bg-status-critical'
              )}
              title={`${s.label}: ${s.status}`}
            />
          ))}
      </div>
    </div>
  );
}
