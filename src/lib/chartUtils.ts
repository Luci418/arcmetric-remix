/**
 * Chart data transformation utilities.
 *
 * Aggregation strategy (Google Analytics / YouTube Studio style):
 *   - live / 1m  → raw points (no aggregation)
 *   - 5m         → 5-second buckets
 *   - 15m        → 10-second buckets
 *   - 1h         → 1-minute buckets
 *   - 6h         → 5-minute buckets
 *   - custom      → auto-detect based on span
 */

import { WeldDataPoint, MetricKey, TimeRange } from './weldTypes';

export interface ChartPoint {
  ts: number;       // bucket timestamp (midpoint)
  value: number;    // aggregated value (mean)
  min: number;      // bucket min
  max: number;      // bucket max
  count: number;    // points in bucket
}

/** Bucket size in ms for each time range */
function getBucketMs(timeRange: TimeRange, spanMs?: number): number | null {
  switch (timeRange) {
    case 'live':
    case '1m':
      return null;          // raw data, no aggregation
    case '5m':
      return 5_000;         // 5 seconds
    case '15m':
      return 10_000;        // 10 seconds
    case '1h':
      return 60_000;        // 1 minute
    case '6h':
      return 300_000;       // 5 minutes
    case 'custom': {
      if (!spanMs || spanMs <= 120_000) return null;
      if (spanMs <= 600_000) return 5_000;
      if (spanMs <= 1_800_000) return 10_000;
      if (spanMs <= 7_200_000) return 60_000;
      return 300_000;
    }
    default:
      return null;
  }
}

/**
 * Aggregate raw weld data into chart-ready points.
 * When bucketMs is null, returns raw points without aggregation.
 */
export function aggregateData(
  data: WeldDataPoint[],
  metric: MetricKey,
  timeRange: TimeRange,
): ChartPoint[] {
  if (data.length === 0) return [];

  const spanMs = data.length > 1
    ? data[data.length - 1].timestamp - data[0].timestamp
    : 0;
  const bucketMs = getBucketMs(timeRange, spanMs);

  // No aggregation — return raw points
  if (!bucketMs) {
    return data.map((d) => {
      const v = d[metric];
      return { ts: d.timestamp, value: v, min: v, max: v, count: 1 };
    });
  }

  // Bucket aggregation
  const buckets = new Map<number, { sum: number; min: number; max: number; count: number; tsSum: number }>();

  for (const d of data) {
    const key = Math.floor(d.timestamp / bucketMs) * bucketMs;
    const v = d[metric];
    const existing = buckets.get(key);
    if (existing) {
      existing.sum += v;
      existing.min = Math.min(existing.min, v);
      existing.max = Math.max(existing.max, v);
      existing.count += 1;
      existing.tsSum += d.timestamp;
    } else {
      buckets.set(key, { sum: v, min: v, max: v, count: 1, tsSum: d.timestamp });
    }
  }

  const result: ChartPoint[] = [];
  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);
  for (const key of sortedKeys) {
    const b = buckets.get(key)!;
    result.push({
      ts: Math.round(b.tsSum / b.count), // midpoint timestamp
      value: Number((b.sum / b.count).toFixed(2)),
      min: b.min,
      max: b.max,
      count: b.count,
    });
  }
  return result;
}

/**
 * Compute smart tick count based on chart width and time range.
 * Avoids label overcrowding like Google Analytics.
 */
export function getSmartTickCount(dataLength: number, chartWidthPx: number = 600): number {
  const maxTicks = Math.floor(chartWidthPx / 80); // ~80px per tick minimum
  return Math.min(maxTicks, Math.max(3, dataLength));
}

/**
 * Format X-axis tick based on time range context.
 */
export function formatXTick(timestamp: number, timeRange: TimeRange): string {
  const d = new Date(timestamp);
  switch (timeRange) {
    case 'live':
    case '1m':
      // Show seconds: "12:34:05"
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    case '5m':
    case '15m':
      // Show minutes+seconds: "12:34:05"
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    case '1h':
      // Show hour+minute: "12:34"
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    case '6h':
      // Show hour+minute: "12:34"
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    case 'custom':
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    default:
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
}

/**
 * Format tooltip timestamp (always full precision).
 */
export function formatTooltipTimestamp(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Compute Y-axis domain with padding, including WPS bounds.
 */
export function computeYDomain(
  data: ChartPoint[],
  wpsMin: number,
  wpsMax: number,
): [number, number] {
  if (data.length === 0) {
    const pad = (wpsMax - wpsMin) * 0.15 || 5;
    return [Math.floor(wpsMin - pad), Math.ceil(wpsMax + pad)];
  }

  const dataMin = Math.min(...data.map((d) => d.min));
  const dataMax = Math.max(...data.map((d) => d.max));
  const yMin = Math.min(wpsMin, dataMin);
  const yMax = Math.max(wpsMax, dataMax);
  const pad = (yMax - yMin) * 0.1 || 5;
  return [Math.floor(yMin - pad), Math.ceil(yMax + pad)];
}

/**
 * Get display label for a time range.
 */
export function getTimeRangeLabel(timeRange: TimeRange, dataLength: number): string {
  switch (timeRange) {
    case 'live':
      return `Live · ${dataLength} points`;
    case '1m':
      return 'Last 1 minute';
    case '5m':
      return 'Last 5 minutes';
    case '15m':
      return 'Last 15 minutes';
    case '1h':
      return 'Last 1 hour';
    case '6h':
      return 'Last 6 hours';
    case 'custom':
      return 'Custom range';
    default:
      return '';
  }
}
