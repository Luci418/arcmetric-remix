# ArcMetric — Complete Developer Guide

> **Last updated:** 2026-03-24
>
> Real-time welding telemetry dashboard that monitors current, voltage, gas flow, and wire feed against WPS (Welding Procedure Specification) limits. Data flows from IoT sensors → AWS cloud → React dashboard.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Project Directory](#2-project-directory)
3. [AWS Backend Architecture](#3-aws-backend-architecture)
4. [DynamoDB Tables](#4-dynamodb-tables)
5. [Lambda Functions](#5-lambda-functions)
6. [API Gateway Contract](#6-api-gateway-contract)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Data Flow & Hooks](#8-data-flow--hooks)
9. [Type System](#9-type-system)
10. [Design System](#10-design-system)
11. [Local Development](#11-local-development)
12. [Deployment Checklist](#12-deployment-checklist)
13. [Current Status & Known Issues](#13-current-status--known-issues)
14. [Extending the Project](#14-extending-the-project)

---

## 1. System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        REACT DASHBOARD                          │
│  (Vite + TypeScript + Tailwind + shadcn/ui + Recharts)          │
│                                                                  │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌────────────────┐  │
│  │MetricCard│  │ LiveChart │  │AlertPanel │  │SessionHistory  │  │
│  └────┬─────┘  └─────┬────┘  └─────┬─────┘  └───────┬────────┘  │
│       │              │              │                │            │
│  ┌────┴──────────────┴──────────────┴────────────────┘            │
│  │  VibrationIndicator  │  WeldImageClassifier                   │
│  └──────────────────────┘                                        │
│                              │                                    │
│                    ┌─────────┴──────────┐                        │
│                    │  useAWSData hook   │  (polls every 3s)      │
│                    │  useSimulatedData  │  (local fallback)      │
│                    └─────────┬──────────┘                        │
│                              │                                    │
│                    ┌─────────┴──────────┐                        │
│                    │  src/lib/awsApi.ts │  (fetch wrapper)       │
│                    └─────────┬──────────┘                        │
└──────────────────────────────┼────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    AWS API GATEWAY (HTTP API v2)                  │
│           https://a39km4t04h.execute-api.us-east-1.amazonaws.com │
│                         $default stage                           │
│                                                                  │
│   Routes:                                                        │
│     GET    /weld-data       → Lambda: arcmetric-query            │
│     GET    /sessions        → Lambda: arcmetric-sessions         │
│     POST   /sessions        → Lambda: arcmetric-sessions         │
│     PATCH  /sessions/{id}   → Lambda: arcmetric-sessions         │
│     GET    /machines        → Lambda: arcmetric-machines         │
│     POST   /machines        → Lambda: arcmetric-machines         │
│     PATCH  /machines/{id}   → Lambda: arcmetric-machines         │
│     DELETE /machines/{id}   → Lambda: arcmetric-machines         │
└───────┬──────────────┬──────────────┬────────────────────────────┘
        │              │              │
        ▼              ▼              ▼
┌──────────────┐ ┌───────────┐ ┌────────────┐
│ArcmetricWeld │ │WeldSessions│ │WeldMachines│   ← DynamoDB Tables
│    Data      │ │ (sessions) │ │ (machines) │
│  (IoT Core)  │ └───────────┘ └────────────┘
└──────────────┘
        ▲
        │  IoT Core Rule writes
┌───────┴──────────────────────────────────────────────────────────┐
│                      AWS IoT CORE                                │
│                                                                  │
│  ESP32 → MQTT (esp32/pub) → IoT Rule → DynamoDB                │
│                                                                  │
│  Sensors:                                                        │
│    ACS712 (Current) → GPIO32                                    │
│    DC Voltage 0-25V → GPIO35                                    │
│    LM35 (Temperature) → GPIO34                                  │
│    SW420 (Vibration) → GPIO26                                   │
│                                                                  │
│  MQTT Payload:                                                   │
│  {                                                               │
│    "robot": "Robot 1",                                          │
│    "current": -0.66, "voltage": 7.73,                           │
│    "temperature": 7.63, "vibration": 1,                         │
│    "timestamp": "2026-03-24 05:12:28"                           │
│  }                                                               │
└──────────────────────────────────────────────────────────────────┘
```

### Data modes

| Mode | Source | Use case |
|------|--------|----------|
| **AWS** (default) | API Gateway → DynamoDB | Production / cloud simulation |
| **Simulated** | Local random walk in browser | Offline demo, no AWS needed |

Toggle via the switch in the dashboard header.

---

## 2. Project Directory

```
arcmetric/
├── docs/
│   ├── DEVELOPER_GUIDE.md          ← YOU ARE HERE
│   └── simulation-scripts.md       ← Lambda simulator code & EventBridge setup
│
├── public/
│   ├── favicon.ico
│   ├── placeholder.svg
│   └── robots.txt
│
├── src/
│   ├── main.tsx                    ← React entry point
│   ├── App.tsx                     ← Router: "/" → Index, "*" → NotFound
│   ├── index.css                   ← Design tokens (HSL), fonts, utility classes
│   │
│   ├── lib/
│   │   ├── awsApi.ts              ← HTTP client for all AWS API Gateway endpoints
│   │   ├── weldTypes.ts           ← All TypeScript interfaces, WPS presets, enums
│   │   └── utils.ts               ← cn() helper (tailwind-merge + clsx)
│   │
│   ├── hooks/
│   │   ├── useAWSData.ts          ← Primary data hook: polls AWS, manages state
│   │   ├── useSimulatedData.ts    ← Offline simulation hook (random walk)
│   │   ├── useMachines.ts         ← localStorage machine management (legacy)
│   │   └── use-mobile.tsx         ← Responsive breakpoint hook
│   │
│   ├── pages/
│   │   ├── Index.tsx              ← Main dashboard page (single-page app)
│   │   └── NotFound.tsx           ← 404 page
│   │
│   └── components/
│       ├── NavLink.tsx
│       ├── ui/                    ← shadcn/ui primitives (button, card, dialog, etc.)
│       └── dashboard/
│           ├── DashboardHeader.tsx         ← Title bar, machine selector, data source toggle
│           ├── MetricCard.tsx              ← Single metric display (current/voltage/gas/wire)
│           ├── LiveChart.tsx               ← Recharts time-series chart with WPS bands
│           ├── AlertPanel.tsx              ← Alert list with acknowledge button
│           ├── WeldSessionTable.tsx        ← Session table with status management
│           ├── CreateSessionDialog.tsx     ← Modal to create new weld sessions
│           ├── MachineManagementDialog.tsx ← Modal to add/retire/remove machines
│           ├── WPSCompliance.tsx           ← Real-time WPS compliance gauge
│           ├── WPSSettingsDialog.tsx       ← WPS preset selector + custom limits
│           └── TimeRangeSelector.tsx       ← Time range buttons (live/1m/5m/15m/1h/6h/custom)
│
├── index.html
├── package.json
├── tailwind.config.ts             ← Tailwind theme with semantic color tokens
├── vite.config.ts                 ← Vite config with @ path alias
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── vitest.config.ts
├── playwright.config.ts
└── components.json                ← shadcn/ui config
```

---

## 3. AWS Backend Architecture

### Region: `us-east-1`

### Services Used

| Service | Resource | Purpose |
|---------|----------|---------|
| **API Gateway** | `arcmetric-cv-api` (`a39km4t04h`) | HTTP API v2, `$default` stage, routes all dashboard traffic |
| **Lambda** | `arcmetric-weld-data` | Read telemetry from DynamoDB |
| **Lambda** | `arcmetric-sessions` | CRUD for weld sessions |
| **Lambda** | `arcmetric-machines` | CRUD for machine fleet |
| **Lambda** | `arcmetric-simulator` | Generates fake telemetry for active sessions |
| **EventBridge** | `arcmetric-simulator` rule | Triggers simulator Lambda every 1 minute |
| **DynamoDB** | `WeldData` | Time-series telemetry storage |
| **DynamoDB** | `WeldSessions` | Session metadata |
| **DynamoDB** | `WeldMachines` | Machine registry |
| **S3** | `arcmetric-cvdata` | Raw seed data (optional) |

---

## 4. DynamoDB Tables

### 4.1 `WeldData` — Telemetry

| Attribute | Type | Key |
|-----------|------|-----|
| `machineId` | String | **Partition Key** |
| `timestamp` | Number (epoch ms) | **Sort Key** |
| `sessionId` | String | — |
| `current` | Number | Amps |
| `voltage` | Number | Volts |
| `gasflow` | Number | L/min |
| `wirefeed` | Number | m/min |

**Access patterns:**
- Query by `machineId` + `timestamp` range (descending, limit N)
- Filter by `sessionId` (post-query or GSI)

### 4.2 `WeldSessions` — Session Metadata

| Attribute | Type | Key |
|-----------|------|-----|
| `id` | String | **Partition Key** |
| `machineId` | String | — |
| `operator` | String | — |
| `wpsRef` | String | Process preset ID (e.g. `gmaw-mild-steel`) |
| `status` | String | `active` / `completed` / `failed` |
| `startTime` | Number (epoch ms) | — |
| `endTime` | Number (epoch ms) | — (set when completed/failed) |

**No Sort Key.** Each session has a unique `id` like `WS-2026-1042`.

### 4.3 `WeldMachines` — Machine Registry

| Attribute | Type | Key |
|-----------|------|-----|
| `id` | String | **Partition Key** |
| `name` | String | Display name (e.g. "Station Alpha") |
| `status` | String | `active` / `retired` |
| `createdAt` | Number (epoch ms) | — |

**No Sort Key.** Machine IDs like `ESP32-WM-001`.

---

## 5. Lambda Functions

### 5.1 `arcmetric-weld-data` — Telemetry Reader

**Runtime:** Python 3.12  
**Trigger:** API Gateway `GET /weld-data`  
**Environment Variables:** `TABLE_NAME=WeldData`

**Query parameters:**
- `machineId` (required) — partition key
- `limit` (optional, default 3600) — max items
- `sessionId` (optional) — filter by session

```python
import os, json, boto3
from decimal import Decimal
from boto3.dynamodb.conditions import Key

TABLE_NAME = os.environ.get("TABLE_NAME", "WeldData")
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)

class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
}

def lambda_handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    params = event.get("queryStringParameters") or {}
    machine_id = params.get("machineId", "")
    limit = int(params.get("limit", "3600"))
    session_id = params.get("sessionId")

    if not machine_id:
        return {"statusCode": 400, "headers": CORS,
                "body": json.dumps({"error": "machineId required"})}

    response = table.query(
        KeyConditionExpression=Key("machineId").eq(machine_id),
        ScanIndexForward=False,
        Limit=limit,
    )
    items = response.get("Items", [])

    if session_id:
        items = [i for i in items if i.get("sessionId") == session_id]

    items.reverse()  # chronological order

    return {
        "statusCode": 200,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(items, cls=DecimalEncoder),
    }
```

---

### 5.2 `arcmetric-sessions` — Session CRUD

**Runtime:** Python 3.12  
**Trigger:** API Gateway `GET|POST /sessions`, `PATCH /sessions/{id}`  
**Environment Variables:** `TABLE_NAME=WeldSessions`

```python
import os, json, time, boto3
from decimal import Decimal

TABLE_NAME = os.environ.get("TABLE_NAME", "WeldSessions")
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)

class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
}

def lambda_handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    path = event.get("rawPath", "")

    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    # GET /sessions — list all
    if method == "GET" and path == "/sessions":
        result = table.scan()
        items = result.get("Items", [])
        return {
            "statusCode": 200,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(items, cls=DecimalEncoder),
        }

    # POST /sessions — create
    if method == "POST" and path == "/sessions":
        body = json.loads(event.get("body", "{}"))
        item = {
            "id":        body["id"],
            "sessionId": body.get("sessionId", body["id"]),
            "machineId": body["machineId"],
            "operator":  body.get("operator", "Unknown"),
            "wpsRef":    body.get("wpsRef", "WPS-UNSPECIFIED"),
            "status":    body.get("status", "active"),
            "startTime": body.get("startTime", int(time.time() * 1000)),
        }
        table.put_item(Item=item)
        return {
            "statusCode": 201,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(item, cls=DecimalEncoder),
        }

    # PATCH /sessions/{id} — update status
    if method == "PATCH" and "/sessions/" in path:
        session_id = path.split("/sessions/")[1]
        body = json.loads(event.get("body", "{}"))

        update_parts = []
        values = {}
        names = {}

        if "status" in body:
            update_parts.append("#s = :s")
            values[":s"] = body["status"]
            names["#s"] = "status"

        if "endTime" in body:
            update_parts.append("endTime = :e")
            values[":e"] = body["endTime"]

        if not update_parts:
            return {"statusCode": 400, "headers": CORS,
                    "body": json.dumps({"error": "Nothing to update"})}

        result = table.update_item(
            Key={"id": session_id},
            UpdateExpression="SET " + ", ".join(update_parts),
            ExpressionAttributeValues=values,
            ExpressionAttributeNames=names if names else None,
            ReturnValues="ALL_NEW",
        )
        return {
            "statusCode": 200,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(result.get("Attributes", {}), cls=DecimalEncoder),
        }

    return {"statusCode": 404, "headers": CORS,
            "body": json.dumps({"error": "Not found"})}
```

---

### 5.3 `arcmetric-machines` — Machine CRUD

**Runtime:** Python 3.12  
**Trigger:** API Gateway `GET|POST /machines`, `PATCH|DELETE /machines/{id}`  
**Environment Variables:** `TABLE_NAME=WeldMachines`

```python
import os, json, time, boto3
from decimal import Decimal

TABLE_NAME = os.environ.get("TABLE_NAME", "WeldMachines")
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)

class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
}

def lambda_handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    path = event.get("rawPath", "")

    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    # GET /machines — list all
    if method == "GET" and path == "/machines":
        result = table.scan()
        items = result.get("Items", [])
        return {
            "statusCode": 200,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(items, cls=DecimalEncoder),
        }

    # POST /machines — create
    if method == "POST" and path == "/machines":
        body = json.loads(event.get("body", "{}"))
        item = {
            "id":        body["id"],
            "name":      body.get("name", f"Station {body['id']}"),
            "status":    "active",
            "createdAt": int(time.time() * 1000),
        }
        table.put_item(Item=item)
        return {
            "statusCode": 201,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(item, cls=DecimalEncoder),
        }

    # PATCH /machines/{id} — update
    if method == "PATCH" and "/machines/" in path:
        machine_id = path.split("/machines/")[1]
        body = json.loads(event.get("body", "{}"))

        update_parts = []
        values = {}
        names = {}

        if "status" in body:
            update_parts.append("#s = :s")
            values[":s"] = body["status"]
            names["#s"] = "status"

        if "name" in body:
            update_parts.append("#n = :n")
            values[":n"] = body["name"]
            names["#n"] = "name"

        if not update_parts:
            return {"statusCode": 400, "headers": CORS,
                    "body": json.dumps({"error": "Nothing to update"})}

        result = table.update_item(
            Key={"id": machine_id},
            UpdateExpression="SET " + ", ".join(update_parts),
            ExpressionAttributeValues=values,
            ExpressionAttributeNames=names if names else None,
            ReturnValues="ALL_NEW",
        )
        return {
            "statusCode": 200,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(result.get("Attributes", {}), cls=DecimalEncoder),
        }

    # DELETE /machines/{id}
    if method == "DELETE" and "/machines/" in path:
        machine_id = path.split("/machines/")[1]
        table.delete_item(Key={"id": machine_id})
        return {"statusCode": 204, "headers": CORS, "body": ""}

    return {"statusCode": 404, "headers": CORS,
            "body": json.dumps({"error": "Not found"})}
```

---

### 5.4 `arcmetric-simulator` — Telemetry Generator

**Runtime:** Python 3.12  
**Trigger:** EventBridge rule `arcmetric-simulator`, `rate(1 minute)`  
**Environment Variables:** `TABLE_NAME=WeldData`, `SESSIONS_TABLE=WeldSessions`

See full code in [`docs/simulation-scripts.md`](./simulation-scripts.md).

**Behavior:**
1. Scans `WeldSessions` for sessions with `status = "active"`
2. For each active session, generates 60 data points (1 per second for the last minute)
3. Uses process-specific waveforms (GMAW/GTAW/SMAW) with sinusoidal drift + Gaussian noise
4. Writes to `WeldData` table via `batch_writer()`

---

## 6. API Gateway Contract

**Base URL:** `https://a39km4t04h.execute-api.us-east-1.amazonaws.com`

All endpoints return JSON with CORS headers (`Access-Control-Allow-Origin: *`).

### Telemetry

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/weld-data?machineId=X&limit=3600&sessionId=Y` | Query telemetry for a machine. `sessionId` optional filter. |

### Sessions

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `GET` | `/sessions` | — | List all sessions |
| `POST` | `/sessions` | `{ id, machineId, operator, wpsRef, status, startTime }` | Create session |
| `PATCH` | `/sessions/{id}` | `{ status, endTime? }` | Update session status |

### Machines

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `GET` | `/machines` | — | List all machines |
| `POST` | `/machines` | `{ id, name }` | Register machine |
| `PATCH` | `/machines/{id}` | `{ status?, name? }` | Update machine |
| `DELETE` | `/machines/{id}` | — | Remove machine |

### Frontend API client

All calls go through `src/lib/awsApi.ts` which wraps `fetch()` with:
- Base URL from `VITE_AWS_API_BASE` env var (fallback to hardcoded)
- `Content-Type: application/json` header
- Error handling (throws on non-2xx)
- JSON parsing with content-type check

---

## 7. Frontend Architecture

### Tech Stack

| Library | Version | Purpose |
|---------|---------|---------|
| React | 18.x | UI framework |
| Vite | 5.x | Build tool + dev server |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Utility-first styling |
| shadcn/ui | — | Component library (Radix + Tailwind) |
| Recharts | 2.x | Time-series charting |
| React Router | 6.x | Client-side routing |
| TanStack Query | 5.x | Query client (available, not heavily used yet) |
| date-fns | 3.x | Date formatting |
| Lucide React | — | Icon set |

### Routing

Single-page app with two routes:
- `/` → `Index.tsx` (main dashboard)
- `*` → `NotFound.tsx` (404)

### Component Hierarchy

```
App.tsx
└── Index.tsx (main page)
    ├── DashboardHeader
    │   ├── Machine selector (Select dropdown)
    │   ├── Data source toggle (Switch: AWS ↔ Simulated)
    │   ├── AWS connection status indicator
    │   └── MachineManagementDialog
    │       └── Add / Retire / Reactivate / Remove machines
    │
    ├── MetricCard × 4 (current, voltage, gasflow, wirefeed)
    │   └── Shows latest value, WPS range, status color
    │
    ├── Chart section
    │   ├── Metric tabs (Current | Voltage | Gas Flow | Wire Feed)
    │   ├── TimeRangeSelector (live/1m/5m/15m/1h/6h/custom)
    │   ├── WPSSettingsDialog (preset selector + custom limits)
    │   └── LiveChart (Recharts AreaChart with WPS reference bands)
    │
    ├── Sidebar (right column on lg+)
    │   ├── WPSCompliance (real-time in-spec gauge)
    │   └── AlertPanel (chronological alert list)
    │
    └── WeldSessionTable
        ├── CreateSessionDialog (modal form)
        └── Session rows with Complete/Fail actions
```

---

## 8. Data Flow & Hooks

### `useAWSData(machineId, specs)` — Primary Hook

**File:** `src/hooks/useAWSData.ts` (437 lines — candidate for refactoring)

**Polls two data streams in parallel:**

1. **Metadata** (every 10s): `GET /sessions` + `GET /machines`
2. **Telemetry** (every 3s): `GET /weld-data?machineId=X&sessionId=Y&limit=3600`

**State managed:**
- `history: WeldDataPoint[]` — up to 3600 points
- `alerts: WeldAlert[]` — capped at 50, generated client-side by comparing values to WPS limits
- `sessions: WeldSession[]` — all sessions from AWS
- `machines: Machine[]` — merged from API + session-implied machines
- `connected: boolean` — API reachability
- `error: string | null` — latest error message

**Key behaviors:**
- Clears history when machine or active session changes
- Auto-detects active session per machine (most recent with `status: "active"`)
- Alert generation uses state machine pattern (only fires on status *transition*)
- `mergeMachineCatalog()` ensures machines referenced in sessions are visible even if not in `/machines`

### `useSimulatedData(specs, hasActiveSession)` — Offline Fallback

**File:** `src/hooks/useSimulatedData.ts`

- Generates random-walk data points every 1s when `hasActiveSession` is true
- Uses same alert-checking logic as AWS hook
- No network calls — fully client-side

### Data source selection (in `Index.tsx`)

```typescript
const source = dataSource === 'aws' ? aws : simulated;
const { latestPoint, history, alerts, acknowledgeAlert } = source;
```

Sessions and machines **always** come from `useAWSData` regardless of data source toggle (the toggle only affects telemetry + alerts).

---

## 9. Type System

All types are in `src/lib/weldTypes.ts`:

| Type | Description |
|------|-------------|
| `WeldDataPoint` | `{ timestamp, current, voltage, gasflow, wirefeed, sessionId? }` |
| `WeldMetric` | Display config for a single metric |
| `WeldAlert` | Alert with severity, threshold, acknowledged flag |
| `WeldSession` | Session record with operator, machine, quality score |
| `WeldSessionStatus` | `'active' \| 'completed' \| 'failed'` |
| `Machine` | `{ id, name, status: 'active' \| 'retired', addedAt }` |
| `MetricKey` | `'current' \| 'voltage' \| 'gasflow' \| 'wirefeed'` |
| `MetricSpec` | WPS limits: `{ min, max, wpsMin, wpsMax, unit, label }` |
| `WPSSpecSet` | `Record<MetricKey, MetricSpec>` |
| `WeldProcessPreset` | Named preset with process/material/gas + full WPSSpecSet |
| `TimeRange` | `'live' \| '1m' \| '5m' \| '15m' \| '1h' \| '6h' \| 'custom'` |

### WPS Presets (6 built-in)

| ID | Process | Material |
|----|---------|----------|
| `gmaw-mild-steel` | GMAW (MIG) | Mild Steel (A36) |
| `gmaw-stainless` | GMAW (MIG) | 304 Stainless Steel |
| `gtaw-stainless` | GTAW (TIG) | 316L Stainless Steel |
| `gtaw-aluminum` | GTAW (TIG) | 6061-T6 Aluminum |
| `smaw-carbon` | SMAW (Stick) | Carbon Steel (E7018) |
| `smaw-low-alloy` | SMAW (Stick) | Low Alloy Steel (E8018-B2) |

---

## 10. Design System

### Color Tokens (HSL in `index.css`)

| Token | Purpose |
|-------|---------|
| `--background / --foreground` | Page background / text |
| `--primary` | Brand blue `220 70% 50%` |
| `--status-ok / warning / critical` | Green / amber / red for metric states |
| `--metric-current / voltage / gasflow / wirefeed` | Per-metric accent colors |

All colors are mapped in `tailwind.config.ts` as `status.ok`, `metric.current`, etc.

### Fonts

- **Body:** Inter (Google Fonts)
- **Data/Mono:** JetBrains Mono (Google Fonts)
- Utility class: `.font-mono-data`

### Component Library

Built on **shadcn/ui** (Radix primitives + Tailwind). Key components used:
- `Card`, `Badge`, `Button`, `Dialog`, `Select`, `Tabs`, `Switch`, `Table`, `ScrollArea`, `Slider`

---

## 11. Local Development

```bash
# Install dependencies
npm install

# Start dev server (port 5173)
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_AWS_API_BASE` | `https://a39km4t04h.execute-api.us-east-1.amazonaws.com` | API Gateway base URL |

Set in `.env.local` (not committed):
```
VITE_AWS_API_BASE=https://your-api-id.execute-api.us-east-1.amazonaws.com
```

---

## 12. Deployment Checklist

### AWS Backend

- [ ] Create DynamoDB tables: `WeldData` (PK: `machineId`, SK: `timestamp`), `WeldSessions` (PK: `id`), `WeldMachines` (PK: `id`)
- [ ] Deploy Lambda `arcmetric-weld-data` with env `TABLE_NAME=WeldData`
- [ ] Deploy Lambda `arcmetric-sessions` with env `TABLE_NAME=WeldSessions`
- [ ] Deploy Lambda `arcmetric-machines` with env `TABLE_NAME=WeldMachines`
- [ ] Deploy Lambda `arcmetric-simulator` with env `TABLE_NAME=WeldData`, `SESSIONS_TABLE=WeldSessions`
- [ ] Configure API Gateway routes (see section 6)
- [ ] Create EventBridge rule `arcmetric-simulator` → `rate(1 minute)` → simulator Lambda
- [ ] Ensure all Lambdas have DynamoDB read/write IAM permissions
- [ ] Seed initial machine: `POST /machines { "id": "ESP32-WM-001", "name": "Station Alpha" }`
- [ ] Create first session: `POST /sessions { "id": "WS-2026-0001", "machineId": "ESP32-WM-001", "operator": "Test", "wpsRef": "gmaw-mild-steel", "status": "active", "startTime": <epoch_ms> }`

### Frontend

- [ ] Set `VITE_AWS_API_BASE` if using different API
- [ ] `npm run build` → deploy `dist/` to hosting (Lovable publish, S3+CloudFront, etc.)

---

## 13. Current Status & Known Issues

### ✅ Working
- Dashboard UI with all components
- Simulated data mode (local random walk)
- AWS API client (`awsApi.ts`) with full CRUD
- `useAWSData` hook with polling, alert generation, session/machine management
- WPS preset selection and custom limits
- Time range filtering

### ⚠️ Partially Implemented / Needs AWS Setup
- **`/machines` endpoint**: Lambda + API Gateway route may not be deployed yet → machine management fails in AWS mode
- **`POST /sessions`** and **`PATCH /sessions/{id}`**: May need Lambda update to handle all fields (`operator`, `wpsRef`, `status`)
- **Simulator Lambda**: Needs EventBridge rule to run automatically
- **No authentication**: All endpoints are public (no API key or JWT)

### 🔮 Future Enhancements
- User authentication (Cognito or API keys)
- Real IoT device integration (ESP32 → MQTT → Lambda → DynamoDB)
- Historical reporting / export (CSV/PDF)
- Multi-dashboard views for different operators
- Dark mode
- Mobile-responsive improvements
- Refactor `useAWSData.ts` (437 lines) into smaller hooks

---

## 14. Extending the Project

### Adding a new metric

1. Add to `MetricKey` union in `weldTypes.ts`
2. Add to `WeldDataPoint` interface
3. Add spec to every entry in `WELD_PROCESS_PRESETS`
4. Add CSS token `--metric-newkey` in `index.css` and `tailwind.config.ts`
5. Add to `METRIC_KEYS` array in `Index.tsx` and `useAWSData.ts`
6. Update simulator Lambda to generate values

### Adding a new API endpoint

1. Add function to `src/lib/awsApi.ts`
2. Create/update Lambda handler
3. Add API Gateway route
4. Call from appropriate hook or component

### Connecting real IoT devices

Replace the simulator Lambda with actual device data:
1. Device → AWS IoT Core (MQTT)
2. IoT Rule → Lambda → DynamoDB `WeldData`
3. Dashboard polls same `/weld-data` endpoint — no frontend changes needed
