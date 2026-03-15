# ArcMetric — Cloud Simulator (AWS only)

This project now uses a **cloud-only simulation flow**:

**Simulation Lambda → AWS storage/API → Dashboard fetches telemetry/sessions/machines**

No local CLI seeding is required.

---

## 1) Continuous Simulator Lambda (`lambda_simulator.py`)

Deploy a Lambda on a schedule (EventBridge) to generate telemetry only for machines with active sessions.

```python
"""
ArcMetric Continuous Simulator Lambda
Flow: Lambda -> DynamoDB/API -> Dashboard

Environment variables:
  TABLE_NAME: WeldData
  SESSIONS_TABLE: WeldSessions
  MACHINES_TABLE: WeldMachines
  ACTIVE_PROCESSES: gmaw-mild-steel,gtaw-stainless,smaw-carbon
"""

import os
import json
import math
import random
from datetime import datetime, timedelta
from decimal import Decimal
import boto3

TABLE_NAME = os.environ.get("TABLE_NAME", "WeldData")
SESSIONS_TABLE = os.environ.get("SESSIONS_TABLE", "WeldSessions")
ACTIVE_PROCESSES = os.environ.get("ACTIVE_PROCESSES", "gmaw-mild-steel,gtaw-stainless,smaw-carbon").split(",")

WELD_PROCESSES = {
    "gmaw-mild-steel": {
        "params": {
            "current":  {"center": 215, "amplitude": 30, "noise": 8},
            "voltage":  {"center": 25,  "amplitude": 3,  "noise": 1},
            "gasflow":  {"center": 17,  "amplitude": 2,  "noise": 0.5},
            "wirefeed": {"center": 9.5, "amplitude": 2,  "noise": 0.5},
        }
    },
    "gtaw-stainless": {
        "params": {
            "current":  {"center": 125, "amplitude": 30, "noise": 5},
            "voltage":  {"center": 14,  "amplitude": 2,  "noise": 0.5},
            "gasflow":  {"center": 11,  "amplitude": 1.5,"noise": 0.3},
            "wirefeed": {"center": 1.8, "amplitude": 0.5,"noise": 0.2},
        }
    },
    "smaw-carbon": {
        "params": {
            "current":  {"center": 160, "amplitude": 35, "noise": 12},
            "voltage":  {"center": 25,  "amplitude": 2,  "noise": 1},
            "gasflow":  {"center": 0,   "amplitude": 0,  "noise": 0},
            "wirefeed": {"center": 0,   "amplitude": 0,  "noise": 0},
        }
    },
}

dynamodb = boto3.resource("dynamodb")
telemetry_table = dynamodb.Table(TABLE_NAME)
sessions_table = dynamodb.Table(SESSIONS_TABLE)


def gen_value(param, t):
    if param["center"] == 0:
        return Decimal("0")
    drift = param["amplitude"] * math.sin(t * 0.05) * 0.3
    noise = random.gauss(0, param["noise"])
    return Decimal(str(round(param["center"] + drift + noise, 1)))


def lambda_handler(event, context):
    now = datetime.utcnow()
    items_written = 0

    active_sessions = sessions_table.scan(
        FilterExpression="#s = :active",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":active": "active"},
    ).get("Items", [])

    if not active_sessions:
        return {"statusCode": 200, "body": json.dumps({"message": "No active sessions"})}

    with telemetry_table.batch_writer() as batch:
        for session in active_sessions:
            machine_id = session["machineId"]
            session_id = session.get("sessionId", session.get("id"))
            process_id = session.get("processType", "gmaw-mild-steel")
            process = WELD_PROCESSES.get(process_id, WELD_PROCESSES["gmaw-mild-steel"])

            for i in range(60):
                ts = now - timedelta(seconds=(59 - i))
                t = int(ts.timestamp())
                item = {
                    "machineId": machine_id,
                    "sessionId": session_id,
                    "timestamp": int(ts.timestamp() * 1000),
                }
                for metric, param in process["params"].items():
                    item[metric] = gen_value(param, t + i)

                batch.put_item(Item=item)
                items_written += 1

    return {
        "statusCode": 200,
        "body": json.dumps({
            "message": f"Generated {items_written} telemetry points",
            "activeSessions": len(active_sessions),
        }),
    }
```

---

## 2) API contract expected by dashboard

The frontend now syncs sessions/machines with AWS APIs and reads telemetry from AWS.

### Required endpoints

- `GET /weld-data?machineId=<id>&limit=3600&sessionId=<id>`
- `GET /sessions`
- `POST /sessions`
- `PATCH /sessions/:id`
- `GET /machines`
- `POST /machines`
- `PATCH /machines/:id`
- `DELETE /machines/:id`

### Session payload (example)

```json
{
  "id": "WS-2026-1042",
  "machineId": "ESP32-WM-001",
  "operator": "Mike Chen",
  "wpsRef": "gmaw-mild-steel",
  "status": "active",
  "startTime": 1773600000000
}
```

---

## 3) EventBridge schedule

Run simulator every minute:

```bash
aws events put-rule \
  --name arcmetric-simulator \
  --schedule-expression "rate(1 minute)" \
  --state ENABLED
```

---

## 4) Resulting flow

1. Operator creates session in dashboard (`POST /sessions`)
2. Lambda sees active session and generates telemetry for that session/machine
3. Dashboard fetches telemetry (`GET /weld-data`) + sessions/machines from AWS
4. Session status updates (complete/fail) stop telemetry generation for closed sessions
