import { motion, AnimatePresence } from 'framer-motion';
import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VibrationIndicatorProps {
  /** 0 = stable, 1 = vibration detected */
  value: number;
  /** Recent history to compute frequency */
  recentHistory?: number[];
}

export function VibrationIndicator({ value, recentHistory = [] }: VibrationIndicatorProps) {
  const isActive = value === 1;
  const recentEvents = recentHistory.filter((v) => v === 1).length;
  const frequency = recentHistory.length > 0
    ? Math.round((recentEvents / recentHistory.length) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">Vibration Sensor</span>
        <span className="text-[10px] text-muted-foreground font-mono">SW420</span>
      </div>

      <div className="flex items-center gap-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={isActive ? 'active' : 'stable'}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full',
              isActive
                ? 'bg-destructive/15 text-destructive'
                : 'bg-status-ok/15 text-status-ok'
            )}
          >
            <Activity className={cn('h-6 w-6', isActive && 'animate-pulse')} />
          </motion.div>
        </AnimatePresence>

        <div>
          <p className={cn(
            'text-lg font-semibold',
            isActive ? 'text-destructive' : 'text-status-ok'
          )}>
            {isActive ? 'Vibration Detected' : 'Stable'}
          </p>
          <p className="text-xs text-muted-foreground">
            {frequency}% trigger rate (last {recentHistory.length}s)
          </p>
        </div>
      </div>
    </motion.div>
  );
}
