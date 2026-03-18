import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSimulatedData } from '@/hooks/useSimulatedData';
import { useAWSData } from '@/hooks/useAWSData';
import { DashboardHeader, DataSource } from '@/components/dashboard/DashboardHeader';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { LiveChart } from '@/components/dashboard/LiveChart';
import { AlertPanel } from '@/components/dashboard/AlertPanel';
import { ActiveSessionCard } from '@/components/dashboard/ActiveSessionCard';
import { SessionHistoryTable } from '@/components/dashboard/SessionHistoryTable';
import { WPSInfoBar } from '@/components/dashboard/WPSInfoBar';
import { TimeRangeSelector } from '@/components/dashboard/TimeRangeSelector';
import { WPSSettingsDialog } from '@/components/dashboard/WPSSettingsDialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  WPSSpecSet,
  WPS_SPECS,
  WeldSession,
  TimeRange,
  TIME_RANGE_CONFIG,
  MetricKey,
} from '@/lib/weldTypes';

const METRIC_KEYS: MetricKey[] = ['current', 'voltage', 'gasflow', 'wirefeed'];

const Index = () => {
  const [dataSource, setDataSource] = useState<DataSource>('aws');
  const [activeChart, setActiveChart] = useState<MetricKey>('current');
  const [selectedMachine, setSelectedMachine] = useState('ESP32-WM-001');
  const [timeRange, setTimeRange] = useState<TimeRange>('live');
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [activeSpecs, setActiveSpecs] = useState<WPSSpecSet>(WPS_SPECS);
  const [activePresetId, setActivePresetId] = useState('gmaw-mild-steel');

  const aws = useAWSData(selectedMachine, activeSpecs);

  const {
    machines,
    sessions: awsSessions,
    addSession,
    updateSessionStatus,
    addMachine,
    removeMachine,
    retireMachine,
    reactivateMachine,
  } = aws;

  useEffect(() => {
    const activeMachines = machines.filter((machine) => machine.status === 'active');
    if (activeMachines.length === 0) return;

    const selectedStillActive = activeMachines.some((machine) => machine.id === selectedMachine);
    if (!selectedStillActive) {
      setSelectedMachine(activeMachines[0].id);
    }
  }, [machines, selectedMachine]);

  const activeSessionForMachine = useMemo(
    () =>
      awsSessions
        .filter((session) => session.machineId === selectedMachine && session.status === 'active')
        .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0],
    [awsSessions, selectedMachine]
  );

  const simulated = useSimulatedData(activeSpecs, Boolean(activeSessionForMachine));

  const source = dataSource === 'aws' ? aws : simulated;
  const { latestPoint, history, alerts, acknowledgeAlert } = source;

  const referenceTimestamp = history.length > 0 ? history[history.length - 1].timestamp : Date.now();

  const sessions = useMemo(() => {
    return awsSessions
      .map((session) => {
        if (session.machineId !== selectedMachine) return session;

        const startMs = session.startTime.getTime();
        const endMs = session.endTime ? session.endTime.getTime() : referenceTimestamp;
        const points = history.filter((point) => point.timestamp >= startMs && point.timestamp <= endMs);

        if (points.length === 0) return session;

        const avgCurrent = Number((points.reduce((sum, point) => sum + point.current, 0) / points.length).toFixed(1));
        const avgVoltage = Number((points.reduce((sum, point) => sum + point.voltage, 0) / points.length).toFixed(1));
        const avgGasflow = Number((points.reduce((sum, point) => sum + point.gasflow, 0) / points.length).toFixed(1));

        const inSpecCount = points.reduce((count, point) => {
          const inSpec = METRIC_KEYS.every((metricKey) => {
            const spec = activeSpecs[metricKey];
            if (spec.max === 0) return true;
            const value = point[metricKey];
            return value >= spec.wpsMin && value <= spec.wpsMax;
          });

          return count + (inSpec ? 1 : 0);
        }, 0);

        const qualityScore = Math.round((inSpecCount / points.length) * 100);

        return {
          ...session,
          avgCurrent,
          avgVoltage,
          avgGasflow,
          qualityScore,
        };
      })
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }, [awsSessions, selectedMachine, history, activeSpecs, referenceTimestamp]);

  const unacknowledgedCount = alerts.filter((alert) => !alert.acknowledged).length;

  const handleCreateSession = useCallback(
    async (session: WeldSession) => {
      const created = await addSession(session);
      if (created) {
        setSelectedMachine(session.machineId);
      }
      return created;
    },
    [addSession]
  );

  const handleEndSession = useCallback(
    (sessionId: string) => updateSessionStatus(sessionId, 'completed'),
    [updateSessionStatus]
  );

  const filteredHistory = useMemo(() => {
    if (timeRange === 'live') return history.slice(-60);

    if (timeRange === 'custom' && customStart && customEnd) {
      const startMs = customStart.getTime();
      const endMs = customEnd.getTime();
      return history.filter((point) => point.timestamp >= startMs && point.timestamp <= endMs);
    }

    const config = TIME_RANGE_CONFIG[timeRange];
    const cutoff = referenceTimestamp - config.seconds * 1000;
    return history.filter((point) => point.timestamp >= cutoff && point.timestamp <= referenceTimestamp);
  }, [history, timeRange, customStart, customEnd, referenceTimestamp]);

  const handleCustomRange = (start: Date, end: Date) => {
    setCustomStart(start);
    setCustomEnd(end);
  };

  const handleApplyWPS = (specs: WPSSpecSet, presetId: string) => {
    setActiveSpecs(specs);
    setActivePresetId(presetId);
  };

  const selectedMachineObj = machines.find((m) => m.id === selectedMachine);

  const enrichedActiveSession = activeSessionForMachine
    ? sessions.find((s) => s.id === activeSessionForMachine.id) ?? activeSessionForMachine
    : undefined;

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
        machines={machines}
        onAddMachine={addMachine}
        onRemoveMachine={removeMachine}
        onRetireMachine={retireMachine}
        onReactivateMachine={reactivateMachine}
      />

      <main className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {METRIC_KEYS.map((key) => (
            <MetricCard key={key} metricKey={key} value={latestPoint[key]} specs={activeSpecs} />
          ))}
        </div>

        {/* Chart + Alerts */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <Tabs value={activeChart} onValueChange={(value) => setActiveChart(value as MetricKey)}>
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
            <WPSInfoBar
              current={latestPoint}
              specs={activeSpecs}
              activePresetId={activePresetId}
            />
            <div className="mt-3">
              <LiveChart
                data={filteredHistory}
                activeMetric={activeChart}
                specs={activeSpecs}
                timeRange={timeRange}
              />
            </div>
          </div>

          <AlertPanel alerts={alerts} onAcknowledge={acknowledgeAlert} />
        </div>

        {/* Active Session — below chart */}
        <ActiveSessionCard
          session={enrichedActiveSession}
          machine={selectedMachineObj}
          machines={machines}
          allSessions={awsSessions}
          onEndSession={handleEndSession}
          onCreateSession={handleCreateSession}
        />

        {/* Session History */}
        <SessionHistoryTable sessions={sessions} />
      </main>
    </div>
  );
};

export default Index;
