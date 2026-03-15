import { WeldSession, Machine } from '@/lib/weldTypes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CreateSessionDialog } from './CreateSessionDialog';

interface WeldSessionTableProps {
  sessions: WeldSession[];
  machines: Machine[];
  onCreateSession: (session: WeldSession) => Promise<boolean> | boolean | void;
  onUpdateSessionStatus: (sessionId: string, status: WeldSession['status']) => Promise<boolean> | boolean | void;
}

const statusStyles: Record<string, string> = {
  active: 'bg-status-ok/10 status-ok border-transparent',
  completed: 'bg-muted text-muted-foreground border-transparent',
  failed: 'bg-status-critical/10 status-critical border-transparent',
};

export function WeldSessionTable({
  sessions,
  machines,
  onCreateSession,
  onUpdateSessionStatus,
}: WeldSessionTableProps) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Weld Sessions</h3>
          <p className="text-xs text-muted-foreground">Operator-defined welding activity log</p>
        </div>
        <CreateSessionDialog machines={machines} onCreateSession={onCreateSession} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-5 py-2.5 font-medium">Session</th>
              <th className="px-5 py-2.5 font-medium">Operator</th>
              <th className="px-5 py-2.5 font-medium">Machine</th>
              <th className="px-5 py-2.5 font-medium">WPS</th>
              <th className="px-5 py-2.5 font-medium">Avg Current</th>
              <th className="px-5 py-2.5 font-medium">Quality</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
              <th className="px-5 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No sessions yet. Click "New Session" to create one.
                </td>
              </tr>
            ) : (
              sessions.map((session) => (
                <tr key={session.id} className="transition-colors hover:bg-muted/50">
                  <td className="px-5 py-3 font-mono-data text-xs font-medium text-foreground">{session.id}</td>
                  <td className="px-5 py-3 text-foreground">{session.operator}</td>
                  <td className="px-5 py-3 font-mono-data text-xs text-muted-foreground">{session.machineId}</td>
                  <td className="px-5 py-3 font-mono-data text-xs text-muted-foreground">{session.wpsRef}</td>
                  <td className="px-5 py-3 font-mono-data text-xs text-foreground">{session.avgCurrent}A</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            session.qualityScore >= 80
                              ? 'bg-status-ok'
                              : session.qualityScore >= 60
                                ? 'bg-status-warning'
                                : 'bg-status-critical'
                          )}
                          style={{ width: `${session.qualityScore}%` }}
                        />
                      </div>
                      <span className="font-mono-data text-xs text-muted-foreground">{session.qualityScore}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant="outline" className={cn('text-[11px] font-semibold capitalize', statusStyles[session.status])}>
                      {session.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    {session.status === 'active' ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px] text-status-ok"
                          onClick={() => onUpdateSessionStatus(session.id, 'completed')}
                        >
                          Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px] text-status-critical"
                          onClick={() => onUpdateSessionStatus(session.id, 'failed')}
                        >
                          Fail
                        </Button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
