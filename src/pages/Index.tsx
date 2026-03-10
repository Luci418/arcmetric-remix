import { useState } from 'react';
import { useSimulatedData } from '@/hooks/useSimulatedData';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { LiveChart } from '@/components/dashboard/LiveChart';
import { AlertPanel } from '@/components/dashboard/AlertPanel';
import { WeldSessionTable } from '@/components/dashboard/WeldSessionTable';
import { WPSCompliance } from '@/components/dashboard/WPSCompliance';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const METRIC_KEYS = ['current', 'voltage', 'gasflow', 'wirefeed'] as const;

const Index = () => {
  const { latestPoint, history, alerts, sessions, acknowledgeAlert } = useSimulatedData();
  const [activeChart, setActiveChart] = useState<typeof METRIC_KEYS[number]>('current');
  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader activeAlerts={unacknowledgedCount} />

      <main className="mx-auto max-w-7xl px-6 py-6">
        {/* Metric cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {METRIC_KEYS.map((key) => (
            <MetricCard key={key} metricKey={key} value={latestPoint[key]} />
          ))}
        </div>

        {/* Chart + side panels */}
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Tabs value={activeChart} onValueChange={(v) => setActiveChart(v as typeof METRIC_KEYS[number])}>
              <TabsList className="mb-3">
                <TabsTrigger value="current">Current</TabsTrigger>
                <TabsTrigger value="voltage">Voltage</TabsTrigger>
                <TabsTrigger value="gasflow">Gas Flow</TabsTrigger>
                <TabsTrigger value="wirefeed">Wire Feed</TabsTrigger>
              </TabsList>
            </Tabs>
            <LiveChart data={history} activeMetric={activeChart} />
          </div>

          <div className="flex flex-col gap-4">
            <WPSCompliance current={latestPoint} />
            <AlertPanel alerts={alerts} onAcknowledge={acknowledgeAlert} />
          </div>
        </div>

        {/* Sessions table */}
        <WeldSessionTable sessions={sessions} />
      </main>
    </div>
  );
};

export default Index;
