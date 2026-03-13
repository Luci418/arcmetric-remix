import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WeldSession, Machine, WELD_PROCESS_PRESETS } from '@/lib/weldTypes';

interface CreateSessionDialogProps {
  machines: Machine[];
  onCreateSession: (session: WeldSession) => void;
}

export function CreateSessionDialog({ machines, onCreateSession }: CreateSessionDialogProps) {
  const [open, setOpen] = useState(false);
  const [operator, setOperator] = useState('');
  const [machineId, setMachineId] = useState('');
  const [wpsRef, setWpsRef] = useState('');
  const [status, setStatus] = useState<'active' | 'completed' | 'failed'>('active');

  const activeMachines = machines.filter((m) => m.status === 'active');

  const handleCreate = () => {
    if (!operator.trim() || !machineId || !wpsRef) return;

    const now = new Date();
    const session: WeldSession = {
      id: `WS-${now.getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
      operator: operator.trim(),
      machineId,
      wpsRef,
      startTime: now,
      endTime: status !== 'active' ? new Date(now.getTime() + 30 * 60000) : undefined,
      status,
      avgCurrent: 0,
      avgVoltage: 0,
      avgGasflow: 0,
      qualityScore: status === 'active' ? 0 : status === 'completed' ? 85 + Math.floor(Math.random() * 15) : 30 + Math.floor(Math.random() * 30),
    };

    onCreateSession(session);
    setOperator('');
    setMachineId('');
    setWpsRef('');
    setStatus('active');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" />
          New Session
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Weld Session</DialogTitle>
          <DialogDescription>Define a new welding session with operator and machine details.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="operator" className="text-xs">Operator Name</Label>
            <Input
              id="operator"
              placeholder="e.g. Mike Chen"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Machine</Label>
            <Select value={machineId} onValueChange={setMachineId}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select machine" />
              </SelectTrigger>
              <SelectContent>
                {activeMachines.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.id} — {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">WPS Reference</Label>
            <Select value={wpsRef} onValueChange={setWpsRef}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select WPS preset" />
              </SelectTrigger>
              <SelectContent>
                {WELD_PROCESS_PRESETS.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id} className="text-xs">
                    {preset.name} ({preset.process})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Initial Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as 'active' | 'completed' | 'failed')}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active" className="text-xs">Active</SelectItem>
                <SelectItem value="completed" className="text-xs">Completed</SelectItem>
                <SelectItem value="failed" className="text-xs">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!operator.trim() || !machineId || !wpsRef}>
            Create Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
