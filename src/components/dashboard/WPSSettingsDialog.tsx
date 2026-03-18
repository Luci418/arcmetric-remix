import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WPSSpecSet, MetricKey, WELD_PROCESS_PRESETS, WeldProcessPreset } from '@/lib/weldTypes';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';

interface WPSSettingsDialogProps {
  activeSpecs: WPSSpecSet;
  activePresetId: string;
  onApply: (specs: WPSSpecSet, presetId: string) => void;
}

const METRIC_KEYS: MetricKey[] = ['current', 'voltage', 'gasflow', 'wirefeed'];

export function WPSSettingsDialog({ activeSpecs, activePresetId, onApply }: WPSSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState(activePresetId);
  const [specs, setSpecs] = useState<WPSSpecSet>({ ...activeSpecs });
  const [isCustom, setIsCustom] = useState(false);

  const selectedPreset = WELD_PROCESS_PRESETS.find((p) => p.id === selectedPresetId);

  const selectPreset = (preset: WeldProcessPreset) => {
    setSelectedPresetId(preset.id);
    setSpecs(JSON.parse(JSON.stringify(preset.specs)));
    setIsCustom(false);
  };

  const updateSpec = (key: MetricKey, field: 'wpsMin' | 'wpsMax', value: number) => {
    setSpecs((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
    setIsCustom(true);
  };

  const handleApply = () => {
    onApply(specs, isCustom ? 'custom' : selectedPresetId);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Settings2 className="h-3.5 w-3.5" />
          WPS Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            WPS Compliance Parameters
            {isCustom && (
              <Badge variant="secondary" className="text-[10px]">Custom</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Preset selector */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Weld Process Presets
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {WELD_PROCESS_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => selectPreset(preset)}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors',
                  selectedPresetId === preset.id && !isCustom
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                )}
              >
                <p className="text-xs font-semibold text-foreground">{preset.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {preset.material} · {preset.thickness}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Gas: {preset.shieldingGas}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Manual parameter editing */}
        <div className="space-y-3 mt-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            WPS Limits {isCustom ? '(Modified)' : ''}
          </Label>
          <div className="space-y-4">
            {METRIC_KEYS.map((key) => {
              const spec = specs[key];
              // Skip metrics with 0 max (e.g., gas/wire for SMAW)
              if (spec.max === 0) {
                return (
                  <div key={key} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                    <span className="text-xs text-muted-foreground">{spec.label}</span>
                    <span className="text-[11px] text-muted-foreground italic">N/A for this process</span>
                  </div>
                );
              }

              return (
                <div key={key} className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">{spec.label}</span>
                    <span className="font-mono-data text-[11px] text-muted-foreground">
                      {spec.wpsMin} – {spec.wpsMax} {spec.unit}
                    </span>
                  </div>
                  <Slider
                    min={spec.min}
                    max={spec.max}
                    step={spec.max <= 30 ? 0.5 : 1}
                    value={[spec.wpsMin, spec.wpsMax]}
                    onValueChange={([min, max]) => {
                      updateSpec(key, 'wpsMin', min);
                      updateSpec(key, 'wpsMax', max);
                    }}
                    className="py-1"
                  />
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Label className="text-[10px] text-muted-foreground">Min</Label>
                      <Input
                        type="number"
                        value={spec.wpsMin}
                        onChange={(e) => updateSpec(key, 'wpsMin', Number(e.target.value))}
                        className="h-7 w-20 text-xs font-mono-data"
                        step={spec.max <= 30 ? 0.5 : 1}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Label className="text-[10px] text-muted-foreground">Max</Label>
                      <Input
                        type="number"
                        value={spec.wpsMax}
                        onChange={(e) => updateSpec(key, 'wpsMax', Number(e.target.value))}
                        className="h-7 w-20 text-xs font-mono-data"
                        step={spec.max <= 30 ? 0.5 : 1}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground ml-auto">{spec.unit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="sm" onClick={handleApply}>Apply WPS</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
