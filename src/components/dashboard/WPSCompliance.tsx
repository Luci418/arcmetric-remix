import { WeldDataPoint, WPSSpecSet, getMetricStatus, MetricKey, WELD_PROCESS_PRESETS } from '@/lib/weldTypes';
import { ShieldCheck, ShieldAlert, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WPSComplianceProps {
  current: WeldDataPoint;
  specs: WPSSpecSet;
  activePresetId: string;
}

const METRIC_KEYS: MetricKey[] = ['current', 'voltage', 'gasflow', 'wirefeed'];

export function WPSCompliance({ current, specs, activePresetId }: WPSComplianceProps) {
  const statuses = METRIC_KEYS.map((key) => {
    const spec = specs[key];
    const isNA = spec.max === 0;
    return {
      key,
      label: spec.label,
      status: isNA ? 'ok' as const : getMetricStatus(current[key], spec.wpsMin, spec.wpsMax),
      value: current[key],
      unit: spec.unit,
      wpsMin: spec.wpsMin,
      wpsMax: spec.wpsMax,
      isNA,
    };
  });

  const activeStatuses = statuses.filter((s) => !s.isNA);
  const allOk = activeStatuses.every((s) => s.status === 'ok');
  const hasCritical = activeStatuses.some((s) => s.status === 'critical');

  const preset = WELD_PROCESS_PRESETS.find((p) => p.id === activePresetId);
  const wpsLabel = preset ? preset.name : 'Custom WPS';

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        {allOk ? (
          <ShieldCheck className="h-5 w-5 status-ok" />
        ) : hasCritical ? (
          <ShieldAlert className="h-5 w-5 status-critical" />
        ) : (
          <Shield className="h-5 w-5 status-warning" />
        )}
        <div>
          <h3 className="text-sm font-semibold text-foreground">WPS Compliance</h3>
          <p className="text-xs text-muted-foreground">
            {allOk ? 'All parameters within WPS limits' : hasCritical ? 'Parameters out of specification' : 'Parameters near WPS limits'}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {statuses.map(({ key, label, status, value, unit, isNA }) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{label}</span>
            {isNA ? (
              <span className="text-[11px] text-muted-foreground italic">N/A</span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-mono-data text-xs text-foreground">
                  {value.toFixed(1)} {unit}
                </span>
                <span
                  className={cn(
                    'inline-block h-2 w-2 rounded-full',
                    status === 'ok' && 'bg-status-ok',
                    status === 'warning' && 'bg-status-warning',
                    status === 'critical' && 'bg-status-critical'
                  )}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg bg-muted px-3 py-2">
        <p className="font-mono-data text-[11px] text-muted-foreground">
          Active WPS: {wpsLabel}{preset ? ` · ${preset.process}` : ''}
        </p>
      </div>
    </div>
  );
}
