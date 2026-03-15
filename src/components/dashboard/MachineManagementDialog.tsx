import { useState } from 'react';
import { Settings2, Plus, Trash2, Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Machine } from '@/lib/weldTypes';

interface MachineManagementDialogProps {
  machines: Machine[];
  onAdd: (id: string, name: string) => Promise<boolean> | boolean | void;
  onRemove: (id: string) => Promise<boolean> | boolean | void;
  onRetire: (id: string) => Promise<boolean> | boolean | void;
  onReactivate: (id: string) => Promise<boolean> | boolean | void;
}

export function MachineManagementDialog({
  machines,
  onAdd,
  onRemove,
  onRetire,
  onReactivate,
}: MachineManagementDialogProps) {
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [open, setOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const runAction = async (actionKey: string, action: () => Promise<boolean> | boolean | void) => {
    setBusyAction(actionKey);
    try {
      const result = await action();
      return result !== false;
    } finally {
      setBusyAction(null);
    }
  };

  const handleAdd = async () => {
    const id = newId.trim();
    const name = newName.trim();
    if (!id || !name) return;
    if (machines.some((machine) => machine.id === id)) return;

    const ok = await runAction('add', () => onAdd(id, name));
    if (!ok) return;

    setNewId('');
    setNewName('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Settings2 className="h-3.5 w-3.5" />
          Machines
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Machine Management</DialogTitle>
          <DialogDescription>Add, retire, or remove welding machines from your fleet.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Machine ID (e.g. ESP32-WM-014)"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            className="flex-1 text-xs"
            disabled={Boolean(busyAction)}
          />
          <Input
            placeholder="Name (e.g. Bay 6 – MIG)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 text-xs"
            disabled={Boolean(busyAction)}
          />
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!newId.trim() || !newName.trim() || Boolean(busyAction)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="max-h-[300px] divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {machines.map((machine) => (
            <div
              key={machine.id}
              className={cn('flex items-center justify-between px-4 py-3', machine.status === 'retired' && 'opacity-50')}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono-data text-xs font-medium text-foreground">{machine.id}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px]',
                      machine.status === 'active'
                        ? 'border-status-ok/30 bg-status-ok/5 status-ok'
                        : 'border-muted-foreground/30 text-muted-foreground'
                    )}
                  >
                    {machine.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{machine.name}</p>
              </div>
              <div className="flex items-center gap-1">
                {machine.status === 'active' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-status-warning"
                    onClick={() => runAction(`retire-${machine.id}`, () => onRetire(machine.id))}
                    title="Retire"
                    disabled={Boolean(busyAction)}
                  >
                    <PowerOff className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-status-ok"
                    onClick={() => runAction(`reactivate-${machine.id}`, () => onReactivate(machine.id))}
                    title="Reactivate"
                    disabled={Boolean(busyAction)}
                  >
                    <Power className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-status-critical"
                  onClick={() => runAction(`remove-${machine.id}`, () => onRemove(machine.id))}
                  title="Remove permanently"
                  disabled={Boolean(busyAction)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
