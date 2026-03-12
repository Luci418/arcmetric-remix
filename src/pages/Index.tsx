import { useState, useMemo } from 'react';
import { useSimulatedData } from '@/hooks/useSimulatedData';
import { useAWSData } from '@/hooks/useAWSData';
import { DashboardHeader, DataSource } from '@/components/dashboard/DashboardHeader';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { LiveChart } from '@/components/dashboard/LiveChart';
import { AlertPanel } from '@/components/dashboard/AlertPanel';
import { WeldSessionTable } from '@/components/dashboard/WeldSessionTable';
import { WPSCompliance } from '@/components/dashboard/WPSCompliance';
import { TimeRangeSelector } from '@/components/dashboard/TimeRangeSelector';
import { WPSSettingsDialog } from '@/components/dashboard/WPSSettingsDialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  WPSSpecSet,
  WPS_SPECS,
  TimeRange,
  TIME_RANGE_CONFIG,
  MetricKey,
} from '@/lib/weldTypes';

const METRIC_KEYS: MetricKey[] = ['current', 'voltage', 'gasflow', 'wirefeed'];

const Index = () => {
  const [dataSource, setDataSource] = useState<DataSource>('simulated');
  const [activeChart, setActiveChart] = useState<MetricKey>('current');
  const [selectedMachine, setSelectedMachine] = useState('ESP32-WM-001');
  const [timeRange, setTimeRange] = useState<TimeRange>('live');
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [activeSpecs, setActiveSpecs] = useState<WPSSpecSet>(WPS_SPECS);
  const [activePresetId, setActivePresetId] = useState('gmaw-mild-steel');

  const simulated = useSimulatedData();
  const aws = useAWSData(selectedMachine);

  const source = dataSource === 'aws' ? aws : simulated;
  const { latestPoint, history, alerts, sessions, acknowledgeAlert } = source;
  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;

  // Filter history based on time range
  const filteredHistory = useMemo(() => {
    if (timeRange === 'live') return history;

    const now = Date.now();
    if (timeRange === 'custom' && customStart && customEnd) {
      const startMs = customStart.getTime();
      const endMs = customEnd.getTime();
      return history.filter((p) => p.timestamp >= startMs && p.timestamp <= endMs);
    }

    const config = TIME_RANGE_CONFIG[timeRange];
    const cutoff = now - config.seconds * 1000;
    return history.filter((p) => p.timestamp >= cutoff);
  }, [history, timeRange, customStart, customEnd]);

  const handleCustomRange = (start: Date, end: Date) => {
    setCustomStart(start);
    setCustomEnd(end);
  };

  const handleApplyWPS = (specs: WPSSpecSet, presetId: string) => {
    setActiveSpecs(specs);
    setActivePresetId(presetId);
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        activeAlerts={unacknowledgedCount}
        dataSource={dataSource}
        onDataSourceChange={setDataSource}
        awsConnected={aws.connected}
        awsError={aws.error}
        selectedMachine={selectedMachine}
        onMachineChange={setSelectedMachine}
      />

      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {METRIC_KEYS.map((key) => (
            <MetricCard key={key} metricKey={key} value={latestPoint[key]} specs={activeSpecs} />
          ))}
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <Tabs value={activeChart} onValueChange={(v) => setActiveChart(v as MetricKey)}>
                <TabsList>
                  <TabsTrigger value="current">Current</TabsTrigger>
                  <TabsTrigger value="voltage">Voltage</TabsTrigger>
                  <TabsTrigger value="gasflow">Gas Flow</TabsTrigger>
                  <TabsTrigger value="wirefeed">Wire Feed</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex items-center gap-2">
                <TimeRangeSelector
                  value={timeRange}
                  onChange={setTimeRange}
                  customStart={customStart}
                  customEnd={customEnd}
                  onCustomRangeChange={handleCustomRange}
                />
                <WPSSettingsDialog
                  activeSpecs={activeSpecs}
                  activePresetId={activePresetId}
                  onApply={handleApplyWPS}
                />
              </div>
            </div>
            <LiveChart
              data={filteredHistory}
              activeMetric={activeChart}
              specs={activeSpecs}
              timeRange={timeRange}
            />
          </div>

          <div className="flex flex-col gap-4">
            <WPSCompliance
              current={latestPoint}
              specs={activeSpecs}
              activePresetId={activePresetId}
            />
            <AlertPanel alerts={alerts} onAcknowledge={acknowledgeAlert} />
          </div>
        </div>

        <WeldSessionTable sessions={sessions} />
      </main>
    </div>
  );
};

export default Index;
