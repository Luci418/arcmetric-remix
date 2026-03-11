import { useState, useEffect, useCallback, useRef } from 'react';
import { WeldDataPoint, WeldAlert, WeldSession, WPS_SPECS, getMetricStatus } from '@/lib/weldTypes';

const API_BASE = 'https://a39km4t04h.execute-api.us-east-1.amazonaws.com';
const POLL_INTERVAL = 3000;
const HISTORY_LENGTH = 60;

// Available ESP32 machines (seeded from Kaggle folders)
export const AVAILABLE_MACHINES = [
  'ESP32-WM-001',
  'ESP32-WM-002',
  'ESP32-WM-003',
  'ESP32-WM-004',
  'ESP32-WM-005',
  'ESP32-WM-006',
  'ESP32-WM-007',
  'ESP32-WM-008',
  'ESP32-WM-009',
  'ESP32-WM-010',
  'ESP32-WM-011',
  'ESP32-WM-012',
  'ESP32-WM-013',
];

export function useAWSData(machineId: string = 'ESP32-WM-010') {
  const [history, setHistory] = useState<WeldDataPoint[]>([]);
  const [alerts, setAlerts] = useState<WeldAlert[]>([]);
  const [sessions, setSessions] = useState<WeldSession[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alertIdCounter = useRef(0);

  const latestPoint: WeldDataPoint = history.length > 0
    ? history[history.length - 1]
    : { timestamp: Date.now(), current: 0, voltage: 0, gasflow: 0, wirefeed: 0 };

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
          id: `aws-alert-${alertIdCounter.current}`,
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

  // Reset state when machine changes
  useEffect(() => {
    setHistory([]);
    setAlerts([]);
    setConnected(false);
    setError(null);
  }, [machineId]);

  // Fetch weld data points — no time filter for seeded historical data
  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/weld-data?machineId=${encodeURIComponent(machineId)}&limit=${HISTORY_LENGTH}`
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const items: Array<{
          timestamp: number;
          current: number;
          voltage: number;
          gasflow?: number;
          wirefeed?: number;
        }> = await res.json();

        if (!active) return;

        const points: WeldDataPoint[] = items.map((item) => ({
          timestamp: item.timestamp,
          current: item.current,
          voltage: item.voltage,
          gasflow: item.gasflow ?? 0,
          wirefeed: item.wirefeed ?? 0,
        }));

        if (points.length > 0) {
          setHistory(points.slice(-HISTORY_LENGTH));
          checkAlerts(points[points.length - 1]);
          setConnected(true);
          setError(null);
        } else {
          setConnected(true);
          setError('No data for this machine');
        }
      } catch (err) {
        if (!active) return;
        setConnected(false);
        setError(err instanceof Error ? err.message : 'Connection failed');
      }
    };

    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [machineId, checkAlerts]);

  // Fetch sessions once
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch(`${API_BASE}/sessions`);
        if (!res.ok) return;
        const items = await res.json();
        const mapped: WeldSession[] = items.map((s: any) => ({
          id: s.id || s.sessionId || 'unknown',
          operator: 'Kaggle Dataset',
          machineId: s.machineId || 'unknown',
          wpsRef: 'WPS-GMAW-1012',
          startTime: new Date(s.startTime),
          endTime: s.endTime ? new Date(s.endTime) : undefined,
          status: 'completed' as const,
          avgCurrent: s.avgCurrent || 0,
          avgVoltage: s.avgVoltage || 0,
          avgGasflow: 0,
          qualityScore: 0,
        }));
        setSessions(mapped);
      } catch {
        // silently fail
      }
    };
    fetchSessions();
  }, []);

  const acknowledgeAlert = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
    );
  }, []);

  return { latestPoint, history, alerts, sessions, acknowledgeAlert, connected, error };
}
