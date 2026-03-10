import { Activity, Bell, Wifi } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DashboardHeaderProps {
  activeAlerts: number;
}

export function DashboardHeader({ activeAlerts }: DashboardHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
          <Activity className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">WeldWatch HMI</h1>
          <p className="text-xs text-muted-foreground">Real-time Weld Monitoring System</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wifi className="h-4 w-4 status-ok" />
          <span className="font-mono-data text-xs">ESP32-WM-001</span>
          <Badge variant="outline" className="border-status-ok/30 bg-status-ok/5 text-xs status-ok">
            Connected
          </Badge>
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
