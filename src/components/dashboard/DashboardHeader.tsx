import { Activity, Bell, Wifi, WifiOff, Cloud, MonitorSpeaker, LogOut } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MachineManagementDialog } from './MachineManagementDialog';
import { Machine } from '@/lib/weldTypes';

export type DataSource = 'simulated' | 'aws';

interface DashboardHeaderProps {
  activeAlerts: number;
  dataSource: DataSource;
  onDataSourceChange: (source: DataSource) => void;
  awsConnected?: boolean;
  awsError?: string | null;
  selectedMachine: string;
  onMachineChange: (machineId: string) => void;
  machines: Machine[];
  onAddMachine: (id: string, name: string) => Promise<boolean> | boolean | void;
  onRemoveMachine: (id: string) => Promise<boolean> | boolean | void;
  onRetireMachine: (id: string) => Promise<boolean> | boolean | void;
  onReactivateMachine: (id: string) => Promise<boolean> | boolean | void;
  onLogout?: () => void;
}

export function DashboardHeader({
  activeAlerts,
  dataSource,
  onDataSourceChange,
  awsConnected,
  awsError,
  selectedMachine,
  onMachineChange,
  machines,
  onAddMachine,
  onRemoveMachine,
  onRetireMachine,
  onReactivateMachine,
  onLogout,
}: DashboardHeaderProps) {
  const isAWS = dataSource === 'aws';
  const activeMachines = machines.filter((machine) => machine.status === 'active');

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
          <Activity className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">ArcMetric</h1>
          <p className="text-xs text-muted-foreground">Real-time Weld Monitoring System</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <MonitorSpeaker className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedMachine} onValueChange={onMachineChange}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="Select machine" />
            </SelectTrigger>
            <SelectContent>
              {activeMachines.map((machine) => (
                <SelectItem key={machine.id} value={machine.id} className="text-xs">
                  <span className="font-mono-data">{machine.id}</span>
                  <span className="ml-1.5 text-muted-foreground">— {machine.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <MachineManagementDialog
          machines={machines}
          onAdd={onAddMachine}
          onRemove={onRemoveMachine}
          onRetire={onRetireMachine}
          onReactivate={onReactivateMachine}
        />

        <div className="flex items-center gap-2">
          <Label htmlFor="data-source" className="text-xs text-muted-foreground">
            {isAWS ? (
              <span className="flex items-center gap-1">
                <Cloud className="h-3.5 w-3.5" /> AWS
              </span>
            ) : (
              'Sim'
            )}
          </Label>
          <Switch
            id="data-source"
            checked={isAWS}
            onCheckedChange={(checked) => onDataSourceChange(checked ? 'aws' : 'simulated')}
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isAWS ? (
            awsConnected ? (
              <>
                <Wifi className="h-4 w-4 status-ok" />
                <Badge variant="outline" className="border-status-ok/30 bg-status-ok/5 text-xs status-ok">
                  Connected
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

        {onLogout && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onLogout}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </header>
  );
}
