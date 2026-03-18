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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface CreateSessionDialogProps {
  machines: Machine[];
  sessions: WeldSession[];
  onCreateSession: (session: WeldSession) => Promise<boolean> | boolean | void;
}

export function CreateSessionDialog({ machines, sessions, onCreateSession }: CreateSessionDialogProps) {
  const [open, setOpen] = useState(false);
  const [operator, setOperator] = useState('');
  const [machineId, setMachineId] = useState('');
  const [wpsRef, setWpsRef] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeMachines = machines.filter((machine) => machine.status === 'active');

  // Check if selected machine already has an active session
  const machineHasActiveSession = machineId
    ? sessions.some((s) => s.machineId === machineId && s.status === 'active')
    : false;

  const handleCreate = async () => {
    if (!operator.trim() || !machineId || !wpsRef || isSubmitting || machineHasActiveSession) return;

    const now = new Date();
    const session: WeldSession = {
      id: `WS-${now.getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
      operator: operator.trim(),
      machineId,
      wpsRef,
      startTime: now,
      endTime: undefined,
      status: 'active',
      avgCurrent: 0,
      avgVoltage: 0,
      avgGasflow: 0,
      qualityScore: 0,
    };

    setIsSubmitting(true);
    try {
      const created = await onCreateSession(session);
      if (created === false) return;

      setOperator('');
      setMachineId('');
      setWpsRef('');
      setOpen(false);
    } finally {
      setIsSubmitting(false);
    }
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
              disabled={isSubmitting}
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Machine</Label>
            <Select value={machineId} onValueChange={setMachineId}>
              <SelectTrigger className="text-sm" disabled={isSubmitting}>
                <SelectValue placeholder="Select machine" />
              </SelectTrigger>
              <SelectContent>
                {activeMachines.map((machine) => {
                  const hasActive = sessions.some((s) => s.machineId === machine.id && s.status === 'active');
                  return (
                    <SelectItem key={machine.id} value={machine.id} className="text-xs">
                      {machine.id} — {machine.name}
                      {hasActive && <span className="ml-1.5 text-status-warning">(active session)</span>}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {machineHasActiveSession && (
            <Alert variant="destructive" className="py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                This machine already has an active session. Complete or fail it before starting a new one.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-1.5">
            <Label className="text-xs">WPS Reference</Label>
            <Select value={wpsRef} onValueChange={setWpsRef}>
              <SelectTrigger className="text-sm" disabled={isSubmitting}>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>Cancel</Button>
          <Button
            onClick={handleCreate}
            disabled={!operator.trim() || !machineId || !wpsRef || isSubmitting || machineHasActiveSession}
          >
            {isSubmitting ? 'Creating...' : 'Create Session'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
