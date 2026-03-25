import { AlertTriangle, CheckCircle2, XCircle, BellOff, ArrowUp, ArrowDown, Cpu } from 'lucide-react';
import { WeldAlert } from '@/lib/weldTypes';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface AlertPanelProps {
  alerts: WeldAlert[];
  onAcknowledge: (id: string) => void;
  onMachineSwitch?: (machineId: string) => void;
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

function isAboveLimit(alert: WeldAlert): boolean {
  return alert.value > alert.threshold;
}

export function AlertPanel({ alerts, onAcknowledge, onMachineSwitch }: AlertPanelProps) {
  const active = alerts.filter((a) => !a.acknowledged);
  const dismissed = alerts.filter((a) => a.acknowledged);

  const handleDismissAll = () => {
    active.forEach((a) => onAcknowledge(a.id));
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Alerts</h3>
          {active.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-status-critical px-1.5 text-[10px] font-bold text-white">
              {active.length}
            </span>
          )}
        </div>
        {active.length > 1 && (
          <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-[11px] text-muted-foreground" onClick={handleDismissAll}>
            <BellOff className="h-3 w-3" />
            Dismiss All
          </Button>
        )}
      </div>

      <ScrollArea className="h-[280px]">
        {alerts.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
            <CheckCircle2 className="mr-2 h-4 w-4 status-ok" />
            All parameters within spec
          </div>
        ) : (
          <div className="divide-y divide-border">
            {active.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  'flex items-start gap-3 px-5 py-3 bg-muted/40',
                  alert.machineId && onMachineSwitch && 'cursor-pointer hover:bg-muted/60'
                )}
                onClick={() => {
                  if (alert.machineId && onMachineSwitch) {
                    onMachineSwitch(alert.machineId);
                  }
                }}
              >
                <div className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                  alert.severity === 'critical' ? 'bg-status-critical/15' : 'bg-status-warning/15'
                )}>
                  {alert.severity === 'critical' ? (
                    <XCircle className="h-3.5 w-3.5 status-critical" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 status-warning" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium text-foreground">{alert.metric}</p>
                    {isAboveLimit(alert) ? (
                      <ArrowUp className="h-3 w-3 status-critical" />
                    ) : (
                      <ArrowDown className="h-3 w-3 status-critical" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {alert.value.toFixed(1)} — limit {alert.threshold} · {timeAgo(alert.timestamp)}
                  </p>
                  {alert.machineId && (
                    <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground/70">
                      <Cpu className="h-2.5 w-2.5" />
                      {alert.machineId}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 shrink-0 px-2 text-[11px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAcknowledge(alert.id);
                  }}
                >
                  Dismiss
                </Button>
              </div>
            ))}

            {dismissed.length > 0 && (
              <>
                <div className="px-5 py-2 bg-muted/20">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Dismissed</span>
                </div>
                {dismissed.slice(0, 10).map((alert) => (
                  <div key={alert.id} className="flex items-start gap-3 px-5 py-2.5 opacity-50">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted">
                      <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-muted-foreground">{alert.metric} — {alert.value.toFixed(1)}</p>
                      <p className="text-[10px] text-muted-foreground/60">
                        {alert.machineId && `${alert.machineId} · `}{timeAgo(alert.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}