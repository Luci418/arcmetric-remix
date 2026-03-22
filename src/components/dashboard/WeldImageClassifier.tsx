import { useState, useRef } from 'react';
import { Camera, Upload, Loader2, CheckCircle2, XCircle, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ClassificationResult {
  label: 'good' | 'bad';
  confidence: number;
  details?: string;
}

interface WeldImageClassifierProps {
  sessionId?: string;
  onClassify?: (imageFile: File) => Promise<ClassificationResult>;
}

export function WeldImageClassifier({ sessionId, onClassify }: WeldImageClassifierProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith('image/')) handleFile(f);
  };

  const handleClassify = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      if (onClassify) {
        const res = await onClassify(file);
        setResult(res);
      } else {
        setError('Classification backend not connected. Enable Lovable Cloud or configure your AWS endpoint.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Classification failed');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPreview(null);
    setFile(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Camera className="h-4 w-4 text-primary" />
          Weld Quality Inspector
          {sessionId && (
            <Badge variant="outline" className="ml-auto font-mono text-[10px]">
              {sessionId}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!preview ? (
          <div
            className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 transition-colors hover:border-primary/40 hover:bg-muted/50"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground text-center">
              Drag & drop a weld image or use the buttons below
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => inputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" />
                Upload
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={() => {
                  if (inputRef.current) {
                    inputRef.current.setAttribute('capture', 'environment');
                    inputRef.current.click();
                    inputRef.current.removeAttribute('capture');
                  }
                }}
              >
                <Camera className="h-3.5 w-3.5" />
                Camera
              </Button>
            </div>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleInputChange} />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-lg border border-border">
              <img src={preview} alt="Weld capture" className="w-full max-h-48 object-cover" />
            </div>
            {result && (
              <div
                className={`flex items-center gap-3 rounded-lg p-3 ${
                  result.label === 'good'
                    ? 'border border-status-ok/30 bg-status-ok/5'
                    : 'border border-status-critical/30 bg-status-critical/5'
                }`}
              >
                {result.label === 'good' ? (
                  <CheckCircle2 className="h-5 w-5 text-status-ok shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-status-critical shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {result.label === 'good' ? 'Good Weld' : 'Bad Weld'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Confidence: {(result.confidence * 100).toFixed(1)}%
                    {result.details && ` — ${result.details}`}
                  </p>
                </div>
              </div>
            )}
            {error && <p className="text-xs text-status-critical">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" className="gap-1.5 text-xs flex-1" onClick={handleClassify} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Classifying…
                  </>
                ) : (
                  'Classify Weld'
                )}
              </Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={reset}>
                Clear
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}