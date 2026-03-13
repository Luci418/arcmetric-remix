import { useState, useEffect, useCallback, useRef } from 'react';
import { WeldDataPoint, WeldAlert, WeldSession, WPS_SPECS, getMetricStatus } from '@/lib/weldTypes';

const HISTORY_LENGTH = 3600; // 1 hour of data at 1s intervals
const UPDATE_INTERVAL = 1000;
const INITIAL_POINTS = 300; // Generate 5 min of initial history (fast startup)

function randomWalk(current: number, min: number, max: number, volatility: number = 0.02): number {
  const range = max - min;
  const delta = (Math.random() - 0.5) * range * volatility;
  return Math.max(min, Math.min(max, current + delta));
}

function generateInitialHistory(): WeldDataPoint[] {
  const points: WeldDataPoint[] = [];
  let current = 210, voltage = 25, gasflow = 17, wirefeed = 9;
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

export function useSimulatedData() {
  const [history, setHistory] = useState<WeldDataPoint[]>(generateInitialHistory);
  const [alerts, setAlerts] = useState<WeldAlert[]>([]);
  const [sessions, setSessions] = useState<WeldSession[]>([]);
  const alertIdCounter = useRef(0);

  const latestPoint = history[history.length - 1];

  const checkAlerts = useCallback((point: WeldDataPoint) => {
    const newAlerts: WeldAlert[] = [];
    const specs = WPS_SPECS;

    (Object.keys(specs) as Array<keyof typeof specs>).forEach((key) => {
      const spec = specs[key];
      const value = point[key];
      const status = getMetricStatus(value, spec.wpsMin, spec.wpsMax);

      if (status !== 'ok') {
        alertIdCounter.current += 1;
        newAlerts.push({
          id: `alert-${alertIdCounter.current}`,
          timestamp: new Date(point.timestamp),
          severity: status,
          metric: spec.label,
          message: value > spec.wpsMax
            ? `${spec.label} above WPS limit (${spec.wpsMax}${spec.unit})`
            : `${spec.label} below WPS limit (${spec.wpsMin}${spec.unit})`,
          value,
          threshold: value > spec.wpsMax ? spec.wpsMax : spec.wpsMin,
          acknowledged: false,
        });
      }
    });

    if (newAlerts.length > 0) {
      setAlerts((prev) => [...newAlerts, ...prev].slice(0, 50));
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setHistory((prev) => {
        const last = prev[prev.length - 1];
        const newPoint: WeldDataPoint = {
          timestamp: Date.now(),
          current: Math.round(randomWalk(last.current, 140, 290, 0.03) * 10) / 10,
          voltage: Math.round(randomWalk(last.voltage, 16, 34, 0.02) * 10) / 10,
          gasflow: Math.round(randomWalk(last.gasflow, 10, 24, 0.015) * 10) / 10,
          wirefeed: Math.round(randomWalk(last.wirefeed, 4, 15, 0.02) * 10) / 10,
        };
        checkAlerts(newPoint);
        return [...prev.slice(-HISTORY_LENGTH), newPoint];
      });
    }, UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [checkAlerts]);

  const acknowledgeAlert = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
    );
  }, []);

  const addSession = useCallback((session: WeldSession) => {
    setSessions((prev) => [session, ...prev]);
  }, []);

  return { latestPoint, history, alerts, sessions, acknowledgeAlert, addSession };
}
