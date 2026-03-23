export interface WeldMetric {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  wpsMin: number;
  wpsMax: number;
  key: 'current' | 'voltage' | 'gasflow' | 'wirefeed' | 'temperature';
}

export interface WeldDataPoint {
  timestamp: number;
  current: number;
  voltage: number;
  gasflow: number;
  wirefeed: number;
  temperature: number;
  vibration: number; // 0 = stable, 1 = vibration detected
  sessionId?: string;
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

export type WeldSessionStatus = 'active' | 'completed' | 'failed';

export interface WeldSession {
  id: string;
  operator: string;
  machineId: string;
  wpsRef: string;
  startTime: Date;
  endTime?: Date;
  status: WeldSessionStatus;
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

export type MetricKey = 'current' | 'voltage' | 'gasflow' | 'wirefeed' | 'temperature';

export interface MetricSpec {
  min: number;
  max: number;
  wpsMin: number;
  wpsMax: number;
  unit: string;
  label: string;
}

export type WPSSpecSet = Record<MetricKey, MetricSpec>;

export interface WeldProcessPreset {
  id: string;
  name: string;
  process: string;
  material: string;
  thickness: string;
  shieldingGas: string;
  specs: WPSSpecSet;
}

// Real industry weld process presets
export const WELD_PROCESS_PRESETS: WeldProcessPreset[] = [
  {
    id: 'gmaw-mild-steel',
    name: 'GMAW – Mild Steel',
    process: 'GMAW (MIG)',
    material: 'Mild Steel (A36)',
    thickness: '3–12 mm',
    shieldingGas: '75% Ar / 25% CO₂',
    specs: {
      current: { min: 0, max: 400, wpsMin: 150, wpsMax: 280, unit: 'A', label: 'Welding Current' },
      voltage: { min: 0, max: 50, wpsMin: 18, wpsMax: 32, unit: 'V', label: 'Arc Voltage' },
      gasflow: { min: 0, max: 30, wpsMin: 12, wpsMax: 22, unit: 'L/min', label: 'Gas Flow Rate' },
      wirefeed: { min: 0, max: 20, wpsMin: 5, wpsMax: 14, unit: 'm/min', label: 'Wire Feed Speed' },
      temperature: { min: -10, max: 150, wpsMin: 15, wpsMax: 80, unit: '°C', label: 'Temperature' },
    },
  },
  {
    id: 'gmaw-stainless',
    name: 'GMAW – Stainless Steel',
    process: 'GMAW (MIG)',
    material: '304 Stainless Steel',
    thickness: '2–8 mm',
    shieldingGas: '98% Ar / 2% CO₂',
    specs: {
      current: { min: 0, max: 350, wpsMin: 120, wpsMax: 240, unit: 'A', label: 'Welding Current' },
      voltage: { min: 0, max: 40, wpsMin: 17, wpsMax: 28, unit: 'V', label: 'Arc Voltage' },
      gasflow: { min: 0, max: 30, wpsMin: 14, wpsMax: 20, unit: 'L/min', label: 'Gas Flow Rate' },
      wirefeed: { min: 0, max: 18, wpsMin: 4, wpsMax: 12, unit: 'm/min', label: 'Wire Feed Speed' },
      temperature: { min: -10, max: 150, wpsMin: 15, wpsMax: 70, unit: '°C', label: 'Temperature' },
    },
  },
  {
    id: 'gtaw-stainless',
    name: 'GTAW – Stainless Steel',
    process: 'GTAW (TIG)',
    material: '316L Stainless Steel',
    thickness: '1.5–6 mm',
    shieldingGas: '100% Argon',
    specs: {
      current: { min: 0, max: 300, wpsMin: 50, wpsMax: 200, unit: 'A', label: 'Welding Current' },
      voltage: { min: 0, max: 30, wpsMin: 10, wpsMax: 18, unit: 'V', label: 'Arc Voltage' },
      gasflow: { min: 0, max: 25, wpsMin: 8, wpsMax: 15, unit: 'L/min', label: 'Gas Flow Rate' },
      wirefeed: { min: 0, max: 5, wpsMin: 0.5, wpsMax: 3, unit: 'm/min', label: 'Filler Feed Rate' },
    },
  },
  {
    id: 'gtaw-aluminum',
    name: 'GTAW – Aluminum',
    process: 'GTAW (TIG)',
    material: '6061-T6 Aluminum',
    thickness: '2–10 mm',
    shieldingGas: '100% Argon',
    specs: {
      current: { min: 0, max: 350, wpsMin: 80, wpsMax: 250, unit: 'A', label: 'Welding Current' },
      voltage: { min: 0, max: 30, wpsMin: 12, wpsMax: 20, unit: 'V', label: 'Arc Voltage' },
      gasflow: { min: 0, max: 30, wpsMin: 12, wpsMax: 20, unit: 'L/min', label: 'Gas Flow Rate' },
      wirefeed: { min: 0, max: 6, wpsMin: 0.5, wpsMax: 4, unit: 'm/min', label: 'Filler Feed Rate' },
    },
  },
  {
    id: 'smaw-carbon',
    name: 'SMAW – Carbon Steel',
    process: 'SMAW (Stick)',
    material: 'Carbon Steel (E7018)',
    thickness: '6–25 mm',
    shieldingGas: 'Flux-coated (N/A)',
    specs: {
      current: { min: 0, max: 350, wpsMin: 70, wpsMax: 250, unit: 'A', label: 'Welding Current' },
      voltage: { min: 0, max: 40, wpsMin: 20, wpsMax: 30, unit: 'V', label: 'Arc Voltage' },
      gasflow: { min: 0, max: 0, wpsMin: 0, wpsMax: 0, unit: 'L/min', label: 'Gas Flow Rate' },
      wirefeed: { min: 0, max: 0, wpsMin: 0, wpsMax: 0, unit: 'm/min', label: 'Electrode Consumption' },
    },
  },
  {
    id: 'smaw-low-alloy',
    name: 'SMAW – Low Alloy Steel',
    process: 'SMAW (Stick)',
    material: 'Low Alloy Steel (E8018-B2)',
    thickness: '8–30 mm',
    shieldingGas: 'Flux-coated (N/A)',
    specs: {
      current: { min: 0, max: 350, wpsMin: 90, wpsMax: 220, unit: 'A', label: 'Welding Current' },
      voltage: { min: 0, max: 40, wpsMin: 22, wpsMax: 28, unit: 'V', label: 'Arc Voltage' },
      gasflow: { min: 0, max: 0, wpsMin: 0, wpsMax: 0, unit: 'L/min', label: 'Gas Flow Rate' },
      wirefeed: { min: 0, max: 0, wpsMin: 0, wpsMax: 0, unit: 'm/min', label: 'Electrode Consumption' },
    },
  },
];

// Default WPS specs (GMAW Mild Steel)
export const WPS_SPECS: WPSSpecSet = WELD_PROCESS_PRESETS[0].specs;

export type TimeRange = 'live' | '1m' | '5m' | '15m' | '1h' | '6h' | 'custom';

export const TIME_RANGE_CONFIG: Record<Exclude<TimeRange, 'custom'>, { label: string; seconds: number }> = {
  live: { label: 'Live', seconds: 60 },
  '1m': { label: '1 min', seconds: 60 },
  '5m': { label: '5 min', seconds: 300 },
  '15m': { label: '15 min', seconds: 900 },
  '1h': { label: '1 hour', seconds: 3600 },
  '6h': { label: '6 hours', seconds: 21600 },
};

export interface Machine {
  id: string;
  name: string;
  status: 'active' | 'retired';
  addedAt: Date;
}
