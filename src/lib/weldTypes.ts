export interface WeldMetric {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  wpsMin: number;
  wpsMax: number;
  key: 'current' | 'voltage' | 'gasflow' | 'wirefeed';
}

export interface WeldDataPoint {
  timestamp: number;
  current: number;
  voltage: number;
  gasflow: number;
  wirefeed: number;
}

export interface WeldAlert {
  id: string;
  timestamp: Date;
  severity: 'warning' | 'critical';
  metric: string;
  message: string;
  value: number;
  threshold: number;
  acknowledged: boolean;
}

export interface WeldSession {
  id: string;
  operator: string;
  machineId: string;
  wpsRef: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'failed';
  avgCurrent: number;
  avgVoltage: number;
  avgGasflow: number;
  qualityScore: number;
}

export type MetricStatus = 'ok' | 'warning' | 'critical';

export function getMetricStatus(value: number, wpsMin: number, wpsMax: number): MetricStatus {
  if (value < wpsMin || value > wpsMax) return 'critical';
  const range = wpsMax - wpsMin;
  const warningBuffer = range * 0.15;
  if (value < wpsMin + warningBuffer || value > wpsMax - warningBuffer) return 'warning';
  return 'ok';
}

export const WPS_SPECS = {
  current: { min: 0, max: 400, wpsMin: 150, wpsMax: 280, unit: 'A', label: 'Welding Current' },
  voltage: { min: 0, max: 50, wpsMin: 18, wpsMax: 32, unit: 'V', label: 'Arc Voltage' },
  gasflow: { min: 0, max: 30, wpsMin: 12, wpsMax: 22, unit: 'L/min', label: 'Gas Flow Rate' },
  wirefeed: { min: 0, max: 20, wpsMin: 5, wpsMax: 14, unit: 'm/min', label: 'Wire Feed Speed' },
};
