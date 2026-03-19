import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { WeldDataPoint, WPSSpecSet, TimeRange, TIME_RANGE_CONFIG } from '@/lib/weldTypes';

interface LiveChartProps {
  data: WeldDataPoint[];
  activeMetric: 'current' | 'voltage' | 'gasflow' | 'wirefeed';
  specs: WPSSpecSet;
  timeRange: TimeRange;
}

const METRIC_COLORS: Record<string, { stroke: string; fill: string }> = {
  current: { stroke: 'hsl(220, 70%, 50%)', fill: 'hsl(220, 70%, 50%)' },
  voltage: { stroke: 'hsl(262, 60%, 55%)', fill: 'hsl(262, 60%, 55%)' },
  gasflow: { stroke: 'hsl(152, 60%, 42%)', fill: 'hsl(152, 60%, 42%)' },
  wirefeed: { stroke: 'hsl(38, 92%, 50%)', fill: 'hsl(38, 92%, 50%)' },
};

function formatTimeTick(timestamp: number, timeRange: TimeRange): string {
  const date = new Date(timestamp);
  if (timeRange === '6h' || timeRange === '1h') {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return date.toLocaleTimeString('en-US', { minute: '2-digit', second: '2-digit', hour12: false });
}

function formatTooltipTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function LiveChart({ data, activeMetric, specs, timeRange }: LiveChartProps) {
  const spec = specs[activeMetric];
  const color = METRIC_COLORS[activeMetric];

  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ts: d.timestamp,
        value: d[activeMetric],
      })),
    [data, activeMetric]
  );

  const rangeLabel =
    timeRange === 'custom'
      ? 'Custom range'
      : timeRange === 'live'
        ? 'Last 60 s · Live'
        : `Last ${TIME_RANGE_CONFIG[timeRange].label}`;

  const tickCount = Math.min(8, Math.max(4, Math.floor(chartData.length / 10)));
  const tickInterval = Math.max(1, Math.floor(chartData.length / tickCount));

  // compute Y domain with padding
  const yMin = Math.min(spec.wpsMin, ...(chartData.length ? chartData.map((d) => d.value) : [spec.min]));
  const yMax = Math.max(spec.wpsMax, ...(chartData.length ? chartData.map((d) => d.value) : [spec.max]));
  const yPad = (yMax - yMin) * 0.1 || 5;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{spec.label}</h3>
          <p className="text-xs text-muted-foreground">{rangeLabel}</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: color.stroke }}
            />
            {timeRange === 'live' ? 'Live' : 'Data'}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-6 rounded-full bg-status-ok opacity-30" />
            WPS Range
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${activeMetric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color.fill} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color.fill} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 92%)" vertical={false} />
          <XAxis
            dataKey="ts"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            tickFormatter={(ts) => formatTimeTick(ts, timeRange)}
            tick={{ fontSize: 10, fill: 'hsl(220, 10%, 50%)' }}
            interval={tickInterval}
            axisLine={{ stroke: 'hsl(220, 15%, 90%)' }}
            tickLine={false}
          />
          <YAxis
            domain={[Math.floor(yMin - yPad), Math.ceil(yMax + yPad)]}
            tick={{ fontSize: 10, fill: 'hsl(220, 10%, 50%)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            labelFormatter={(ts) => formatTooltipTime(ts as number)}
            contentStyle={{
              background: 'hsl(0, 0%, 100%)',
              border: '1px solid hsl(220, 15%, 90%)',
              borderRadius: '8px',
              fontSize: '12px',
              fontFamily: 'JetBrains Mono, monospace',
            }}
            formatter={(val: number) => [`${val} ${spec.unit}`, spec.label]}
          />
          <ReferenceLine
            y={spec.wpsMin}
            stroke="hsl(152, 60%, 42%)"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
          />
          <ReferenceLine
            y={spec.wpsMax}
            stroke="hsl(152, 60%, 42%)"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color.stroke}
            strokeWidth={2}
            fill={`url(#grad-${activeMetric})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
