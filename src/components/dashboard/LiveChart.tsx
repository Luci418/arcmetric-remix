import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { WeldDataPoint, WPSSpecSet, TimeRange, TIME_RANGE_CONFIG } from '@/lib/weldTypes';

interface LiveChartProps {
  data: WeldDataPoint[];
  activeMetric: 'current' | 'voltage' | 'gasflow' | 'wirefeed';
  specs: WPSSpecSet;
  timeRange: TimeRange;
}

const METRIC_COLORS: Record<string, string> = {
  current: 'hsl(220, 70%, 50%)',
  voltage: 'hsl(262, 60%, 55%)',
  gasflow: 'hsl(152, 60%, 42%)',
  wirefeed: 'hsl(38, 92%, 50%)',
};

export function LiveChart({ data, activeMetric, specs, timeRange }: LiveChartProps) {
  const spec = specs[activeMetric];
  const color = METRIC_COLORS[activeMetric];

  const isLongRange = timeRange === '1h' || timeRange === '6h' || timeRange === 'custom';

  const chartData = useMemo(
    () =>
      data.map((d) => ({
        time: new Date(d.timestamp).toLocaleTimeString('en-US', {
          hour12: false,
          ...(isLongRange
            ? { hour: '2-digit' as const, minute: '2-digit' as const }
            : { minute: '2-digit' as const, second: '2-digit' as const }),
        }),
        value: d[activeMetric],
      })),
    [data, activeMetric, isLongRange]
  );

  const rangeLabel = timeRange === 'custom'
    ? 'Custom range'
    : timeRange === 'live'
      ? 'Last 60 seconds · Live'
      : `Last ${TIME_RANGE_CONFIG[timeRange].label}`;

  // Dynamic tick interval based on data points
  const tickInterval = Math.max(1, Math.floor(chartData.length / 8));

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{spec.label} Trend</h3>
          <p className="text-xs text-muted-foreground">{rangeLabel}</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            {timeRange === 'live' ? 'Live' : 'Data'}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-6 rounded-full bg-status-ok opacity-30" />
            WPS Range
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 92%)" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: 'hsl(220, 10%, 50%)' }}
            interval={tickInterval}
          />
          <YAxis
            domain={[spec.min, spec.max]}
            tick={{ fontSize: 10, fill: 'hsl(220, 10%, 50%)' }}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(0, 0%, 100%)',
              border: '1px solid hsl(220, 15%, 90%)',
              borderRadius: '8px',
              fontSize: '12px',
              fontFamily: 'JetBrains Mono, monospace',
            }}
            formatter={(val: number) => [`${val} ${spec.unit}`, spec.label]}
          />
          <ReferenceLine y={spec.wpsMin} stroke="hsl(152, 60%, 42%)" strokeDasharray="4 4" strokeOpacity={0.6} />
          <ReferenceLine y={spec.wpsMax} stroke="hsl(152, 60%, 42%)" strokeDasharray="4 4" strokeOpacity={0.6} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
