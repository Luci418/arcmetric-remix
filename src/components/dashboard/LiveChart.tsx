import { useMemo, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts';
import { WeldDataPoint, WPSSpecSet, TimeRange, MetricKey } from '@/lib/weldTypes';
import {
  aggregateData,
  formatXTick,
  formatTooltipTimestamp,
  computeYDomain,
  getTimeRangeLabel,
  getSmartTickCount,
  ChartPoint,
} from '@/lib/chartUtils';

interface LiveChartProps {
  data: WeldDataPoint[];
  activeMetric: MetricKey;
  specs: WPSSpecSet;
  timeRange: TimeRange;
}

const METRIC_COLORS: Record<MetricKey, { stroke: string; fill: string }> = {
  current: { stroke: 'hsl(220, 70%, 50%)', fill: 'hsl(220, 70%, 50%)' },
  voltage: { stroke: 'hsl(262, 60%, 55%)', fill: 'hsl(262, 60%, 55%)' },
  gasflow: { stroke: 'hsl(152, 60%, 42%)', fill: 'hsl(152, 60%, 42%)' },
  wirefeed: { stroke: 'hsl(38, 92%, 50%)', fill: 'hsl(38, 92%, 50%)' },
  temperature: { stroke: 'hsl(0, 72%, 55%)', fill: 'hsl(0, 72%, 55%)' },
};

// Custom tooltip component for Google Analytics-style display
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as ChartPoint & { _unit: string; _label: string };
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md">
      <p className="mb-1 text-[11px] text-muted-foreground font-mono">
        {formatTooltipTimestamp(label)}
      </p>
      <p className="text-sm font-semibold text-foreground">
        {point.value} {point._unit}
      </p>
      {point.count > 1 && (
        <p className="text-[10px] text-muted-foreground">
          Range: {point.min}–{point.max} ({point.count} samples)
        </p>
      )}
    </div>
  );
}

export function LiveChart({ data, activeMetric, specs, timeRange }: LiveChartProps) {
  const spec = specs[activeMetric];
  const color = METRIC_COLORS[activeMetric];

  // Aggregate data based on time range (memoized)
  const chartData = useMemo(() => {
    const points = aggregateData(data, activeMetric, timeRange);
    // Attach unit/label for tooltip (avoids prop drilling)
    return points.map((p) => ({ ...p, _unit: spec.unit, _label: spec.label }));
  }, [data, activeMetric, timeRange, spec.unit, spec.label]);

  // Y domain with WPS bounds + padding
  const yDomain = useMemo(
    () => computeYDomain(chartData, spec.wpsMin, spec.wpsMax),
    [chartData, spec.wpsMin, spec.wpsMax],
  );

  // X domain: only use actual data extent (no stretching)
  const xDomain = useMemo<[number, number]>(() => {
    if (chartData.length === 0) return [Date.now() - 60000, Date.now()];
    return [chartData[0].ts, chartData[chartData.length - 1].ts];
  }, [chartData]);

  // Smart tick formatting
  const tickFormatter = useCallback(
    (ts: number) => formatXTick(ts, timeRange),
    [timeRange],
  );

  const smartTickCount = getSmartTickCount(chartData.length);
  const rangeLabel = getTimeRangeLabel(timeRange, chartData.length);

  // Empty state
  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{spec.label}</h3>
            <p className="text-xs text-muted-foreground">{rangeLabel}</p>
          </div>
        </div>
        <div className="flex h-[220px] items-center justify-center">
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">
              No data available for selected timeframe
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Data will appear when telemetry is received
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      {/* Header */}
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
            <span className="inline-block h-2 w-6 rounded bg-status-ok/20 border border-status-ok/30" />
            WPS Range
          </span>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${activeMetric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color.fill} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color.fill} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(220, 15%, 92%)"
            vertical={false}
          />

          {/* WPS compliance band (shaded green region) */}
          {spec.wpsMax > 0 && (
            <ReferenceArea
              y1={spec.wpsMin}
              y2={spec.wpsMax}
              fill="hsl(152, 60%, 42%)"
              fillOpacity={0.08}
              stroke="hsl(152, 60%, 42%)"
              strokeOpacity={0.2}
              strokeDasharray="4 4"
            />
          )}

          <XAxis
            dataKey="ts"
            type="number"
            domain={xDomain}
            scale="time"
            tickFormatter={tickFormatter}
            tickCount={smartTickCount}
            tick={{ fontSize: 10, fill: 'hsl(220, 10%, 50%)' }}
            axisLine={{ stroke: 'hsl(220, 15%, 90%)' }}
            tickLine={false}
            allowDuplicatedCategory={false}
          />

          <YAxis
            domain={yDomain}
            tick={{ fontSize: 10, fill: 'hsl(220, 10%, 50%)' }}
            axisLine={false}
            tickLine={false}
            width={45}
          />

          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: 'hsl(220, 15%, 80%)', strokeDasharray: '4 4' }}
            isAnimationActive={false}
          />

          <Area
            type="monotone"
            dataKey="value"
            stroke={color.stroke}
            strokeWidth={1.5}
            fill={`url(#grad-${activeMetric})`}
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
