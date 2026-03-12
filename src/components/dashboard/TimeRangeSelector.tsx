import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimeRange, TIME_RANGE_CONFIG } from '@/lib/weldTypes';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  customStart?: Date;
  customEnd?: Date;
  onCustomRangeChange?: (start: Date, end: Date) => void;
}

const QUICK_RANGES: TimeRange[] = ['live', '1m', '5m', '15m', '1h', '6h'];

export function TimeRangeSelector({
  value,
  onChange,
  customStart,
  customEnd,
  onCustomRangeChange,
}: TimeRangeSelectorProps) {
  const [startDate, setStartDate] = useState<Date | undefined>(customStart);
  const [endDate, setEndDate] = useState<Date | undefined>(customEnd);
  const [startTime, setStartTime] = useState(customStart ? format(customStart, 'HH:mm') : '00:00');
  const [endTime, setEndTime] = useState(customEnd ? format(customEnd, 'HH:mm') : '23:59');

  const applyCustomRange = () => {
    if (!startDate || !endDate) return;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const start = new Date(startDate);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(endDate);
    end.setHours(eh, em, 59, 999);
    onCustomRangeChange?.(start, end);
    onChange('custom');
  };

  return (
    <div className="flex items-center gap-1.5">
      {/* Quick range buttons */}
      <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
        {QUICK_RANGES.map((range) => (
          <button
            key={range}
            onClick={() => onChange(range)}
            className={cn(
              'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
              value === range
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {TIME_RANGE_CONFIG[range].label}
          </button>
        ))}
      </div>

      {/* Custom range picker */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors',
              value === 'custom'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            <Clock className="h-3 w-3" />
            {value === 'custom' && customStart && customEnd
              ? `${format(customStart, 'MMM d HH:mm')} – ${format(customEnd, 'HH:mm')}`
              : 'Custom'}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4" align="end">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-foreground">Custom Time Range</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn('w-full justify-start text-left text-xs', !startDate && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {startDate ? format(startDate, 'MMM d, yyyy') : 'Pick date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn('w-full justify-start text-left text-xs', !endDate && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {endDate ? format(endDate, 'MMM d, yyyy') : 'Pick date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <Button
              size="sm"
              className="w-full text-xs"
              onClick={applyCustomRange}
              disabled={!startDate || !endDate}
            >
              Apply Range
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
