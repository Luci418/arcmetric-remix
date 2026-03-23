import { useState, useEffect, useCallback, useRef } from 'react';
import {
  WeldDataPoint,
  WeldAlert,
  WeldSession,
  WPSSpecSet,
  MetricKey,
  MetricStatus,
  getMetricStatus,
} from '@/lib/weldTypes';

const HISTORY_LENGTH = 3600; // 1 hour at 1s intervals
const UPDATE_INTERVAL = 1000;
const INITIAL_POINTS = 300; // 5 min warm history

const METRIC_KEYS: MetricKey[] = ['current', 'voltage', 'gasflow', 'wirefeed', 'temperature'];

const EMPTY_POINT: WeldDataPoint = {
  timestamp: Date.now(),
  current: 0,
  voltage: 0,
  gasflow: 0,
  wirefeed: 0,
  temperature: 0,
  vibration: 0,
};

function randomWalk(current: number, min: number, max: number, volatility: number = 0.02): number {
  const range = max - min;
  const delta = (Math.random() - 0.5) * range * volatility;
  return Math.max(min, Math.min(max, current + delta));
}

function generateInitialHistory(): WeldDataPoint[] {
  const points: WeldDataPoint[] = [];
  let current = 210;
  let voltage = 25;
  let gasflow = 17;
  let wirefeed = 9;
  const now = Date.now();

  for (let i = INITIAL_POINTS; i >= 0; i--) {
    current = randomWalk(current, 140, 290, 0.03);
    voltage = randomWalk(voltage, 16, 34, 0.02);
    gasflow = randomWalk(gasflow, 10, 24, 0.015);
    wirefeed = randomWalk(wirefeed, 4, 15, 0.02);

    points.push({
      timestamp: now - i * UPDATE_INTERVAL,
      current: Math.round(current * 10) / 10,
      voltage: Math.round(voltage * 10) / 10,
      gasflow: Math.round(gasflow * 10) / 10,
      wirefeed: Math.round(wirefeed * 10) / 10,
    });
  }

  return points;
}

function getDefaultStatuses(): Record<MetricKey, MetricStatus> {
  return {
    current: 'ok',
    voltage: 'ok',
    gasflow: 'ok',
    wirefeed: 'ok',
  };
}

export function useSimulatedData(specs: WPSSpecSet, hasActiveSession: boolean) {
  const [history, setHistory] = useState<WeldDataPoint[]>(() => (hasActiveSession ? generateInitialHistory() : []));
  const [alerts, setAlerts] = useState<WeldAlert[]>([]);
  const [sessions] = useState<WeldSession[]>([]);
  const alertIdCounter = useRef(0);
  const previousStatuses = useRef<Record<MetricKey, MetricStatus>>(getDefaultStatuses());

  const latestPoint = history.length > 0 ? history[history.length - 1] : EMPTY_POINT;

  const checkAlerts = useCallback(
    (point: WeldDataPoint) => {
      const newAlerts: WeldAlert[] = [];

      METRIC_KEYS.forEach((key) => {
        const spec = specs[key];
        if (spec.max === 0) {
          previousStatuses.current[key] = 'ok';
          return;
        }

        const value = point[key];
        const status = getMetricStatus(value, spec.wpsMin, spec.wpsMax);
        const previousStatus = previousStatuses.current[key];

        if (status === 'ok') {
          previousStatuses.current[key] = 'ok';
          return;
        }

        if (previousStatus !== status) {
          const midpoint = (spec.wpsMin + spec.wpsMax) / 2;
          const isAbove = value >= midpoint;
          alertIdCounter.current += 1;
          newAlerts.push({
            id: `alert-${alertIdCounter.current}`,
            timestamp: new Date(point.timestamp),
            severity: status,
            metric: spec.label,
            message: isAbove
              ? `${spec.label} above WPS limit (${spec.wpsMax}${spec.unit})`
              : `${spec.label} below WPS limit (${spec.wpsMin}${spec.unit})`,
            value,
            threshold: isAbove ? spec.wpsMax : spec.wpsMin,
            acknowledged: false,
          });
        }

        previousStatuses.current[key] = status;
      });

      if (newAlerts.length > 0) {
        setAlerts((prev) => [...newAlerts, ...prev].slice(0, 50));
      }
    },
    [specs]
  );

  useEffect(() => {
    previousStatuses.current = getDefaultStatuses();
    setAlerts([]);
  }, [specs]);

  useEffect(() => {
    if (hasActiveSession) {
      setHistory((prev) => (prev.length > 0 ? prev : generateInitialHistory()));
      return;
    }

    setHistory([]);
    setAlerts([]);
    previousStatuses.current = getDefaultStatuses();
  }, [hasActiveSession]);

  useEffect(() => {
    if (!hasActiveSession) return;

    const interval = setInterval(() => {
      setHistory((prev) => {
        const last = prev[prev.length - 1] ?? EMPTY_POINT;
        const newPoint: WeldDataPoint = {
          timestamp: Date.now(),
          current: Math.round(randomWalk(last.current || 210, 140, 290, 0.03) * 10) / 10,
          voltage: Math.round(randomWalk(last.voltage || 25, 16, 34, 0.02) * 10) / 10,
          gasflow: Math.round(randomWalk(last.gasflow || 17, 10, 24, 0.015) * 10) / 10,
          wirefeed: Math.round(randomWalk(last.wirefeed || 9, 4, 15, 0.02) * 10) / 10,
        };

        checkAlerts(newPoint);
        return [...prev.slice(-HISTORY_LENGTH + 1), newPoint];
      });
    }, UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [checkAlerts, hasActiveSession]);

  const acknowledgeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
  }, []);

  const addSession = useCallback(async () => true, []);

  return { latestPoint, history, alerts, sessions, acknowledgeAlert, addSession };
}
