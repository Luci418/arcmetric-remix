import { useState, useCallback } from 'react';
import { Machine } from '@/lib/weldTypes';

const STORAGE_KEY = 'arcmetric-machines';

const DEFAULT_MACHINES: Machine[] = [
  { id: 'ESP32-WM-001', name: 'Bay 1 – MIG Station', status: 'active', addedAt: new Date('2025-11-01') },
  { id: 'ESP32-WM-002', name: 'Bay 2 – TIG Station', status: 'active', addedAt: new Date('2025-11-01') },
  { id: 'ESP32-WM-003', name: 'Bay 3 – MIG Station', status: 'active', addedAt: new Date('2025-11-15') },
  { id: 'ESP32-WM-004', name: 'Bay 4 – Stick Welder', status: 'active', addedAt: new Date('2025-12-01') },
  { id: 'ESP32-WM-005', name: 'Bay 5 – MIG Station', status: 'active', addedAt: new Date('2026-01-10') },
];

function loadMachines(): Machine[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((m: any) => ({ ...m, addedAt: new Date(m.addedAt) }));
    }
  } catch { /* use defaults */ }
  return DEFAULT_MACHINES;
}

function saveMachines(machines: Machine[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(machines));
}

export function useMachines() {
  const [machines, setMachines] = useState<Machine[]>(loadMachines);

  const addMachine = useCallback((id: string, name: string) => {
    setMachines((prev) => {
      const updated = [...prev, { id, name, status: 'active' as const, addedAt: new Date() }];
      saveMachines(updated);
      return updated;
    });
  }, []);

  const removeMachine = useCallback((id: string) => {
    setMachines((prev) => {
      const updated = prev.filter((m) => m.id !== id);
      saveMachines(updated);
      return updated;
    });
  }, []);

  const retireMachine = useCallback((id: string) => {
    setMachines((prev) => {
      const updated = prev.map((m) =>
        m.id === id ? { ...m, status: 'retired' as const } : m
      );
      saveMachines(updated);
      return updated;
    });
  }, []);

  const reactivateMachine = useCallback((id: string) => {
    setMachines((prev) => {
      const updated = prev.map((m) =>
        m.id === id ? { ...m, status: 'active' as const } : m
      );
      saveMachines(updated);
      return updated;
    });
  }, []);

  const activeMachines = machines.filter((m) => m.status === 'active');

  return { machines, activeMachines, addMachine, removeMachine, retireMachine, reactivateMachine };
}
