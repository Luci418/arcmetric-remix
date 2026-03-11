import { Activity, Bell, Wifi, WifiOff, Cloud } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export type DataSource = 'simulated' | 'aws';

interface DashboardHeaderProps {
  activeAlerts: number;
  dataSource: DataSource;
  onDataSourceChange: (source: DataSource) => void;
  awsConnected?: boolean;
  awsError?: string | null;
}

export function DashboardHeader({
  activeAlerts,
  dataSource,
  onDataSourceChange,
  awsConnected,
  awsError,
}: DashboardHeaderProps) {
  const isAWS = dataSource === 'aws';

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
          <Activity className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">ArcMetric</h1>
          <p className="text-xs text-muted-foreground">Real-time Weld Monitoring System</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Data source toggle */}
        <div className="flex items-center gap-2">
          <Label htmlFor="data-source" className="text-xs text-muted-foreground">
            {isAWS ? (
              <span className="flex items-center gap-1">
                <Cloud className="h-3.5 w-3.5" /> AWS Live
              </span>
            ) : (
              'Simulated'
            )}
          </Label>
          <Switch
            id="data-source"
            checked={isAWS}
            onCheckedChange={(checked) =>
              onDataSourceChange(checked ? 'aws' : 'simulated')
            }
          />
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isAWS ? (
            awsConnected ? (
              <>
                <Wifi className="h-4 w-4 status-ok" />
                <Badge variant="outline" className="border-status-ok/30 bg-status-ok/5 text-xs status-ok">
                  AWS Connected
                </Badge>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-status-critical" />
                <Badge variant="outline" className="border-status-critical/30 bg-status-critical/5 text-xs text-status-critical">
                  {awsError || 'Disconnected'}
                </Badge>
              </>
            )
          ) : (
            <>
              <Wifi className="h-4 w-4 status-ok" />
              <span className="font-mono-data text-xs">Simulated</span>
              <Badge variant="outline" className="border-status-ok/30 bg-status-ok/5 text-xs status-ok">
                Active
              </Badge>
            </>
          )}
        </div>

        <div className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {activeAlerts > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-status-critical text-[10px] font-bold text-primary-foreground">
              {activeAlerts}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
