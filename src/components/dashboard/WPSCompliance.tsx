import { WeldDataPoint, WPS_SPECS, getMetricStatus } from '@/lib/weldTypes';
import { Shield, ShieldCheck, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WPSComplianceProps {
  current: WeldDataPoint;
}

export function WPSCompliance({ current }: WPSComplianceProps) {
  const metrics = Object.entries(WPS_SPECS) as Array<[keyof typeof WPS_SPECS, typeof WPS_SPECS[keyof typeof WPS_SPECS]]>;
  
  const statuses = metrics.map(([key, spec]) => ({
    key,
    label: spec.label,
    status: getMetricStatus(current[key], spec.wpsMin, spec.wpsMax),
    value: current[key],
    unit: spec.unit,
    wpsMin: spec.wpsMin,
    wpsMax: spec.wpsMax,
  }));

  const allOk = statuses.every((s) => s.status === 'ok');
  const hasCritical = statuses.some((s) => s.status === 'critical');

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
        {statuses.map(({ key, label, status, value, unit, wpsMin, wpsMax }) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{label}</span>
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
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg bg-muted px-3 py-2">
        <p className="font-mono-data text-[11px] text-muted-foreground">
          Active WPS: WPS-GMAW-1012 · ASME IX Qualified
        </p>
      </div>
    </div>
  );
}
