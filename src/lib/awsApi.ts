const API_BASE = import.meta.env.VITE_AWS_API_BASE ?? 'https://a39km4t04h.execute-api.us-east-1.amazonaws.com';

const DEFAULT_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
};

async function requestJson<T = any>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...DEFAULT_HEADERS,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

export function fetchWeldData(machineId: string, limit: number, sessionId?: string) {
  const params = new URLSearchParams({
    machineId,
    limit: String(limit),
  });

  if (sessionId) {
    params.set('sessionId', sessionId);
  }

  return requestJson<any[]>(`/weld-data?${params.toString()}`);
}

export function fetchSessions() {
  return requestJson<any[]>('/sessions');
}

export function createSession(payload: Record<string, any>) {
  return requestJson<any>('/sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateSession(sessionId: string, payload: Record<string, any>) {
  return requestJson<any>(`/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function fetchMachines() {
  return requestJson<any[]>('/machines');
}

export function createMachine(payload: Record<string, any>) {
  return requestJson<any>('/machines', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateMachine(machineId: string, payload: Record<string, any>) {
  return requestJson<any>(`/machines/${encodeURIComponent(machineId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteMachine(machineId: string) {
  return requestJson<any>(`/machines/${encodeURIComponent(machineId)}`, {
    method: 'DELETE',
  });
}

export { API_BASE };
