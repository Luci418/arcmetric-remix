import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { WeldAlert } from '@/lib/weldTypes';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface AlertPanelProps {
  alerts: WeldAlert[];
  onAcknowledge: (id: string) => void;
}

export function AlertPanel({ alerts, onAcknowledge }: AlertPanelProps) {
  const unacknowledged = alerts.filter((a) => !a.acknowledged);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Active Alerts</h3>
          {unacknowledged.length > 0 && (
            <span className="rounded-full bg-status-critical\/10 px-2 py-0.5 text-[11px] font-semibold status-critical">
              {unacknowledged.length}
            </span>
          )}
        </div>
      </div>

      <ScrollArea className="h-[280px]">
        {alerts.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
            <CheckCircle2 className="mr-2 h-4 w-4 status-ok" />
            All parameters within spec
          </div>
        ) : (
          <div className="divide-y divide-border">
            {alerts.slice(0, 15).map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  'flex items-start gap-3 px-5 py-3 transition-colors',
                  !alert.acknowledged && 'bg-muted/50'
                )}
              >
                {alert.severity === 'critical' ? (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 status-critical" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 status-warning" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground">{alert.message}</p>
                  <p className="font-mono-data text-[11px] text-muted-foreground">
                    {alert.timestamp.toLocaleTimeString()} · Value: {alert.value.toFixed(1)} · Limit: {alert.threshold}
                  </p>
                </div>
                {!alert.acknowledged && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 shrink-0 px-2 text-[11px]"
                    onClick={() => onAcknowledge(alert.id)}
                  >
                    Ack
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
