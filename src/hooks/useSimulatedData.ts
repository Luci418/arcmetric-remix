import { useState, useEffect, useCallback, useRef } from 'react';
import { WeldDataPoint, WeldAlert, WeldSession, WPS_SPECS, getMetricStatus } from '@/lib/weldTypes';

const HISTORY_LENGTH = 60;
const UPDATE_INTERVAL = 1000;

function randomWalk(current: number, min: number, max: number, volatility: number = 0.02): number {
  const range = max - min;
  const delta = (Math.random() - 0.5) * range * volatility;
  return Math.max(min, Math.min(max, current + delta));
}

function generateInitialHistory(): WeldDataPoint[] {
  const points: WeldDataPoint[] = [];
  let current = 210, voltage = 25, gasflow = 17, wirefeed = 9;
  const now = Date.now();

  for (let i = HISTORY_LENGTH; i >= 0; i--) {
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

const MOCK_SESSIONS: WeldSession[] = [
  {
    id: 'WS-2026-0847',
    operator: 'Mike Chen',
    machineId: 'ESP32-WM-001',
    wpsRef: 'WPS-GMAW-1012',
    startTime: new Date(Date.now() - 45 * 60000),
    status: 'active',
    avgCurrent: 215,
    avgVoltage: 24.8,
    avgGasflow: 17.2,
    qualityScore: 94,
  },
  {
    id: 'WS-2026-0846',
    operator: 'Sarah Kim',
    machineId: 'ESP32-WM-003',
    wpsRef: 'WPS-GMAW-1015',
    startTime: new Date(Date.now() - 120 * 60000),
    endTime: new Date(Date.now() - 85 * 60000),
    status: 'completed',
    avgCurrent: 198,
    avgVoltage: 22.1,
    avgGasflow: 16.8,
    qualityScore: 97,
  },
  {
    id: 'WS-2026-0845',
    operator: 'James Patel',
    machineId: 'ESP32-WM-002',
    wpsRef: 'WPS-FCAW-2003',
    startTime: new Date(Date.now() - 180 * 60000),
    endTime: new Date(Date.now() - 155 * 60000),
    status: 'failed',
    avgCurrent: 305,
    avgVoltage: 34.2,
    avgGasflow: 11.5,
    qualityScore: 42,
  },
  {
    id: 'WS-2026-0844',
    operator: 'Mike Chen',
    machineId: 'ESP32-WM-001',
    wpsRef: 'WPS-GMAW-1012',
    startTime: new Date(Date.now() - 240 * 60000),
    endTime: new Date(Date.now() - 200 * 60000),
    status: 'completed',
    avgCurrent: 220,
    avgVoltage: 25.5,
    avgGasflow: 18.0,
    qualityScore: 91,
  },
];

export function useSimulatedData() {
  const [history, setHistory] = useState<WeldDataPoint[]>(generateInitialHistory);
  const [alerts, setAlerts] = useState<WeldAlert[]>([]);
  const [sessions] = useState<WeldSession[]>(MOCK_SESSIONS);
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

  return { latestPoint, history, alerts, sessions, acknowledgeAlert };
}
