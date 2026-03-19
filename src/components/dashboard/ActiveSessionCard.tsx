import { useState } from 'react';
import { Clock, StopCircle, User, Cpu, FileText, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WeldSession, Machine } from '@/lib/weldTypes';
import { CreateSessionDialog } from '@/components/dashboard/CreateSessionDialog';
import { toast } from 'sonner';

interface ActiveSessionCardProps {
  session: WeldSession | undefined;
  machine: Machine | undefined;
  machines: Machine[];
  allSessions: WeldSession[];
  onEndSession: (sessionId: string) => Promise<boolean> | boolean | void;
  onCreateSession: (session: WeldSession) => Promise<boolean> | boolean | void;
}

function formatDuration(startTime: Date): string {
  const now = Date.now();
  const diffMs = now - startTime.getTime();
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function ActiveSessionCard({ session, machine, machines, allSessions, onEndSession, onCreateSession }: ActiveSessionCardProps) {
  const [ending, setEnding] = useState(false);

  const handleEnd = async () => {
    if (!session || ending) return;
    setEnding(true);
    try {
      const result = await onEndSession(session.id);
      if (result === false) {
        toast.error('Failed to end session. Check AWS connection.');
      } else {
        toast.success(`Session ${session.id} completed.`);
      }
    } catch (err) {
      toast.error('Failed to end session. Check AWS connection.');
      console.error('End session error:', err);
    } finally {
      setEnding(false);
    }
  };

  if (!session) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No Active Session</p>
              <p className="text-xs">Start a new session to begin monitoring</p>
            </div>
          </div>
          <CreateSessionDialog
            machines={machines}
            sessions={allSessions}
            onCreateSession={onCreateSession}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-status-ok/30 bg-card shadow-sm">
      <div className="h-1 rounded-t-xl bg-status-ok" />

      <div className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-ok opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-status-ok" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Active Session</h3>
            <span className="font-mono-data text-xs text-muted-foreground">{session.id}</span>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 border-status-critical/30 px-3 text-[11px] font-semibold text-status-critical hover:bg-status-critical/10"
            onClick={handleEnd}
            disabled={ending}
          >
            <StopCircle className="h-3 w-3" />
            {ending ? 'Ending…' : 'End Session'}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium">{session.operator}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Cpu className="h-3.5 w-3.5" />
            <span className="font-mono-data text-foreground">{machine?.name ?? session.machineId}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            <span className="text-foreground">{session.wpsRef}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Timer className="h-3.5 w-3.5" />
            <span className="font-mono-data text-foreground">{formatDuration(session.startTime)}</span>
          </div>
        </div>

        {session.qualityScore > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Quality</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={
                  session.qualityScore >= 80
                    ? 'h-full rounded-full bg-status-ok transition-all'
                    : session.qualityScore >= 60
                      ? 'h-full rounded-full bg-status-warning transition-all'
                      : 'h-full rounded-full bg-status-critical transition-all'
                }
                style={{ width: `${session.qualityScore}%` }}
              />
            </div>
            <span className="font-mono-data text-[11px] text-muted-foreground">{session.qualityScore}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
