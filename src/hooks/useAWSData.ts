import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  WeldDataPoint,
  WeldAlert,
  WeldSession,
  WeldSessionStatus,
  Machine,
  WPSSpecSet,
  MetricKey,
  MetricStatus,
  getMetricStatus,
} from '@/lib/weldTypes';
import {
  fetchWeldData,
  fetchSessions as fetchSessionsApi,
  createSession as createSessionApi,
  updateSession as updateSessionApi,
  fetchMachines as fetchMachinesApi,
  createMachine as createMachineApi,
  updateMachine as updateMachineApi,
  deleteMachine as deleteMachineApi,
} from '@/lib/awsApi';

const POLL_INTERVAL = 3000;
const METADATA_REFRESH_INTERVAL = 10000;
const HISTORY_LENGTH = 3600;

const METRIC_KEYS: MetricKey[] = ['current', 'voltage', 'gasflow', 'wirefeed'];

const EMPTY_POINT: WeldDataPoint = {
  timestamp: Date.now(),
  current: 0,
  voltage: 0,
  gasflow: 0,
  wirefeed: 0,
};

function getDefaultStatuses(): Record<MetricKey, MetricStatus> {
  return {
    current: 'ok',
    voltage: 'ok',
    gasflow: 'ok',
    wirefeed: 'ok',
  };
}

function toTimestamp(value: unknown): number {
  if (typeof value === 'number') return value;

  if (typeof value === 'string') {
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) return numeric;

    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }

  if (value instanceof Date) return value.getTime();

  return Date.now();
}

function toDate(value: unknown): Date {
  return new Date(toTimestamp(value));
}

function parseSessionStatus(rawStatus: unknown, endTime: unknown): WeldSessionStatus {
  if (rawStatus === 'active' || rawStatus === 'completed' || rawStatus === 'failed') {
    return rawStatus;
  }

  return endTime ? 'completed' : 'active';
}

function mapSession(item: Record<string, any>): WeldSession {
  const startTime = toDate(item.startTime);
  const endTimeRaw = item.endTime ?? item.endedAt;

  return {
    id: String(item.id ?? item.sessionId ?? `WS-${startTime.getTime()}`),
    operator: String(item.operator ?? item.createdBy ?? 'Unknown Operator'),
    machineId: String(item.machineId ?? item.machine ?? 'unknown-machine'),
    wpsRef: String(item.wpsRef ?? item.processType ?? 'WPS-UNSPECIFIED'),
    startTime,
    endTime: endTimeRaw ? toDate(endTimeRaw) : undefined,
    status: parseSessionStatus(item.status, endTimeRaw),
    avgCurrent: Number(item.avgCurrent ?? 0),
    avgVoltage: Number(item.avgVoltage ?? 0),
    avgGasflow: Number(item.avgGasflow ?? 0),
    qualityScore: Number(item.qualityScore ?? 0),
  };
}

function mapMachine(item: Record<string, any>): Machine {
  const status = item.status === 'retired' ? 'retired' : 'active';

  return {
    id: String(item.id ?? item.machineId ?? item.machine ?? ''),
    name: String(item.name ?? item.label ?? item.displayName ?? `Station ${item.id ?? item.machineId ?? ''}`),
    status,
    addedAt: toDate(item.addedAt ?? item.createdAt ?? Date.now()),
  };
}

function mergeMachineCatalog(explicitMachines: Machine[], sessions: WeldSession[]): Machine[] {
  const machineMap = new Map<string, Machine>();

  explicitMachines.forEach((machine) => {
    machineMap.set(machine.id, machine);
  });

  sessions.forEach((session) => {
    if (machineMap.has(session.machineId)) return;

    machineMap.set(session.machineId, {
      id: session.machineId,
      name: `Station ${session.machineId.split('-').pop() ?? session.machineId}`,
      status: 'active',
      addedAt: session.startTime,
    });
  });

  return Array.from(machineMap.values()).sort((a, b) => a.id.localeCompare(b.id));
}

function serializeSession(session: WeldSession) {
  return {
    id: session.id,
    sessionId: session.id,
    operator: session.operator,
    machineId: session.machineId,
    wpsRef: session.wpsRef,
    status: session.status,
    startTime: session.startTime.getTime(),
    endTime: session.endTime?.getTime(),
    avgCurrent: session.avgCurrent,
    avgVoltage: session.avgVoltage,
    avgGasflow: session.avgGasflow,
    qualityScore: session.qualityScore,
  };
}

export function useAWSData(machineId: string, specs: WPSSpecSet) {
  const [history, setHistory] = useState<WeldDataPoint[]>([]);
  const [alerts, setAlerts] = useState<WeldAlert[]>([]);
  const [sessions, setSessions] = useState<WeldSession[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alertIdCounter = useRef(0);
  const previousStatuses = useRef<Record<MetricKey, MetricStatus>>(getDefaultStatuses());

  const latestPoint: WeldDataPoint = history.length > 0 ? history[history.length - 1] : EMPTY_POINT;

  const activeSession = useMemo(
    () =>
      sessions
        .filter((session) => session.machineId === machineId && session.status === 'active')
        .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0],
    [machineId, sessions]
  );

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
          alertIdCounter.current += 1;
          newAlerts.push({
            id: `aws-alert-${alertIdCounter.current}`,
            timestamp: new Date(point.timestamp),
            severity: status,
            metric: spec.label,
            message:
              value > spec.wpsMax
                ? `${spec.label} above WPS limit (${spec.wpsMax}${spec.unit})`
                : `${spec.label} below WPS limit (${spec.wpsMin}${spec.unit})`,
            value,
            threshold: value > spec.wpsMax ? spec.wpsMax : spec.wpsMin,
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

  const loadMetadata = useCallback(async () => {
    try {
      const rawSessions = await fetchSessionsApi();
      const mappedSessions = Array.isArray(rawSessions)
        ? rawSessions.map((item) => mapSession(item)).sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
        : [];

      let mappedMachines: Machine[] = [];
      try {
        const rawMachines = await fetchMachinesApi();
        mappedMachines = Array.isArray(rawMachines) ? rawMachines.map((item) => mapMachine(item)) : [];
      } catch {
        mappedMachines = [];
      }

      setSessions(mappedSessions);
      setMachines(mergeMachineCatalog(mappedMachines, mappedSessions));
      setConnected(true);
      setError(null);
    } catch (err) {
      setConnected(false);
      setError(err instanceof Error ? err.message : 'Failed to fetch AWS metadata');
    }
  }, []);

  useEffect(() => {
    loadMetadata();
    const interval = setInterval(loadMetadata, METADATA_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loadMetadata]);

  useEffect(() => {
    previousStatuses.current = getDefaultStatuses();
    setAlerts([]);
  }, [machineId, activeSession?.id, specs]);

  useEffect(() => {
    let active = true;

    if (!machineId) {
      setHistory([]);
      return () => {
        active = false;
      };
    }

    if (!activeSession) {
      setHistory([]);
      setConnected(true);
      setError('No active session for selected machine');
      return () => {
        active = false;
      };
    }

    const fetchData = async () => {
      try {
        const items = await fetchWeldData(machineId, HISTORY_LENGTH, activeSession.id);
        if (!active) return;

        const points: WeldDataPoint[] = Array.isArray(items)
          ? items.map((item) => ({
              timestamp: toTimestamp(item.timestamp),
              current: Number(item.current ?? 0),
              voltage: Number(item.voltage ?? 0),
              gasflow: Number(item.gasflow ?? 0),
              wirefeed: Number(item.wirefeed ?? 0),
              sessionId: item.sessionId ? String(item.sessionId) : undefined,
            }))
          : [];

        setHistory(points.slice(-HISTORY_LENGTH));

        if (points.length > 0) {
          checkAlerts(points[points.length - 1]);
          setConnected(true);
          setError(null);
        } else {
          setConnected(true);
          setError('No telemetry in active session yet');
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
  }, [machineId, activeSession, checkAlerts]);

  const acknowledgeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
  }, []);

  const addSession = useCallback(async (session: WeldSession) => {
    try {
      const payload = serializeSession(session);
      const created = await createSessionApi(payload);
      const mapped = mapSession((created ?? payload) as Record<string, any>);

      setSessions((prev) => [mapped, ...prev.filter((existing) => existing.id !== mapped.id)]);
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session in AWS');
      return false;
    }
  }, []);

  const updateSessionStatus = useCallback(async (sessionId: string, status: WeldSessionStatus) => {
    try {
      const endTime = status === 'active' ? undefined : Date.now();
      const payload = { status, ...(endTime ? { endTime } : {}) };

      const updated = await updateSessionApi(sessionId, payload).catch(() => null);

      setSessions((prev) =>
        prev.map((session) => {
          if (session.id !== sessionId) return session;
          if (updated) return mapSession(updated as Record<string, any>);
          return {
            ...session,
            status,
            endTime: endTime ? new Date(endTime) : undefined,
          };
        })
      );

      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update session status in AWS');
      return false;
    }
  }, []);

  const addMachine = useCallback(async (id: string, name: string) => {
    try {
      const payload = {
        id,
        machineId: id,
        name,
        status: 'active',
        addedAt: Date.now(),
      };

      const created = await createMachineApi(payload).catch(() => payload);
      const mapped = mapMachine((created ?? payload) as Record<string, any>);

      setMachines((prev) => [mapped, ...prev.filter((machine) => machine.id !== mapped.id)]);
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add machine in AWS');
      return false;
    }
  }, []);

  const removeMachine = useCallback(async (id: string) => {
    try {
      await deleteMachineApi(id);
      setMachines((prev) => prev.filter((machine) => machine.id !== id));
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove machine in AWS');
      return false;
    }
  }, []);

  const retireMachine = useCallback(async (id: string) => {
    try {
      const payload = { status: 'retired' as const };
      await updateMachineApi(id, payload).catch(() => null);

      setMachines((prev) =>
        prev.map((machine) => (machine.id === id ? { ...machine, status: 'retired' as const } : machine))
      );
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retire machine in AWS');
      return false;
    }
  }, []);

  const reactivateMachine = useCallback(async (id: string) => {
    try {
      const payload = { status: 'active' as const };
      await updateMachineApi(id, payload).catch(() => null);

      setMachines((prev) =>
        prev.map((machine) => (machine.id === id ? { ...machine, status: 'active' as const } : machine))
      );
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reactivate machine in AWS');
      return false;
    }
  }, []);

  return {
    latestPoint,
    history,
    alerts,
    sessions,
    machines,
    activeSession,
    acknowledgeAlert,
    addSession,
    updateSessionStatus,
    addMachine,
    removeMachine,
    retireMachine,
    reactivateMachine,
    connected,
    error,
  };
}
