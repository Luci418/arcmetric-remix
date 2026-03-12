# ArcMetric — Simulation Scripts

Two scripts for generating realistic weld telemetry data per weld process type.

## 1. Python CLI — Bulk Seeder (`seed_weld_data.py`)

Run locally to push historical sessions to your AWS API/DynamoDB.

```python
#!/usr/bin/env python3
"""
ArcMetric Bulk Data Seeder
Generates realistic weld sessions for each process type and pushes to DynamoDB.

Usage:
  pip install boto3
  python seed_weld_data.py --table WeldData --region us-east-1
"""

import argparse
import random
import time
import math
import uuid
from datetime import datetime, timedelta
import boto3

# ── Weld Process Definitions ──────────────────────────────────────────────

WELD_PROCESSES = {
    "gmaw-mild-steel": {
        "name": "GMAW – Mild Steel",
        "wpsRef": "WPS-GMAW-1012",
        "machines": ["ESP32-WM-001", "ESP32-WM-002", "ESP32-WM-003"],
        "operators": ["Mike Chen", "Sarah Kim", "James Patel"],
        "params": {
            "current":  {"center": 215, "amplitude": 30, "noise": 8,  "wpsMin": 150, "wpsMax": 280},
            "voltage":  {"center": 25,  "amplitude": 3,  "noise": 1,  "wpsMin": 18,  "wpsMax": 32},
            "gasflow":  {"center": 17,  "amplitude": 2,  "noise": 0.5,"wpsMin": 12,  "wpsMax": 22},
            "wirefeed": {"center": 9.5, "amplitude": 2,  "noise": 0.5,"wpsMin": 5,   "wpsMax": 14},
        }
    },
    "gmaw-stainless": {
        "name": "GMAW – Stainless Steel",
        "wpsRef": "WPS-GMAW-1015",
        "machines": ["ESP32-WM-004", "ESP32-WM-005"],
        "operators": ["Lisa Wang", "Tom Rivera"],
        "params": {
            "current":  {"center": 180, "amplitude": 25, "noise": 6,  "wpsMin": 120, "wpsMax": 240},
            "voltage":  {"center": 22,  "amplitude": 2,  "noise": 0.8,"wpsMin": 17,  "wpsMax": 28},
            "gasflow":  {"center": 17,  "amplitude": 1.5,"noise": 0.4,"wpsMin": 14,  "wpsMax": 20},
            "wirefeed": {"center": 8,   "amplitude": 2,  "noise": 0.5,"wpsMin": 4,   "wpsMax": 12},
        }
    },
    "gtaw-stainless": {
        "name": "GTAW – Stainless Steel",
        "wpsRef": "WPS-GTAW-2001",
        "machines": ["ESP32-WM-006", "ESP32-WM-007"],
        "operators": ["Anna Kowalski", "Dev Sharma"],
        "params": {
            "current":  {"center": 125, "amplitude": 30, "noise": 5,  "wpsMin": 50,  "wpsMax": 200},
            "voltage":  {"center": 14,  "amplitude": 2,  "noise": 0.5,"wpsMin": 10,  "wpsMax": 18},
            "gasflow":  {"center": 11,  "amplitude": 1.5,"noise": 0.3,"wpsMin": 8,   "wpsMax": 15},
            "wirefeed": {"center": 1.8, "amplitude": 0.5,"noise": 0.2,"wpsMin": 0.5, "wpsMax": 3},
        }
    },
    "gtaw-aluminum": {
        "name": "GTAW – Aluminum",
        "wpsRef": "WPS-GTAW-2005",
        "machines": ["ESP32-WM-008", "ESP32-WM-009"],
        "operators": ["Carlos Mendez", "Yuki Tanaka"],
        "params": {
            "current":  {"center": 165, "amplitude": 40, "noise": 10, "wpsMin": 80,  "wpsMax": 250},
            "voltage":  {"center": 16,  "amplitude": 2,  "noise": 0.6,"wpsMin": 12,  "wpsMax": 20},
            "gasflow":  {"center": 16,  "amplitude": 2,  "noise": 0.4,"wpsMin": 12,  "wpsMax": 20},
            "wirefeed": {"center": 2.2, "amplitude": 0.8,"noise": 0.2,"wpsMin": 0.5, "wpsMax": 4},
        }
    },
    "smaw-carbon": {
        "name": "SMAW – Carbon Steel",
        "wpsRef": "WPS-SMAW-3001",
        "machines": ["ESP32-WM-010", "ESP32-WM-011"],
        "operators": ["Brian O'Neill", "Maria Santos"],
        "params": {
            "current":  {"center": 160, "amplitude": 35, "noise": 12, "wpsMin": 70,  "wpsMax": 250},
            "voltage":  {"center": 25,  "amplitude": 2,  "noise": 1,  "wpsMin": 20,  "wpsMax": 30},
            "gasflow":  {"center": 0,   "amplitude": 0,  "noise": 0,  "wpsMin": 0,   "wpsMax": 0},
            "wirefeed": {"center": 0,   "amplitude": 0,  "noise": 0,  "wpsMin": 0,   "wpsMax": 0},
        }
    },
    "smaw-low-alloy": {
        "name": "SMAW – Low Alloy Steel",
        "wpsRef": "WPS-SMAW-3005",
        "machines": ["ESP32-WM-012", "ESP32-WM-013"],
        "operators": ["Raj Patel", "Emily Zhang"],
        "params": {
            "current":  {"center": 155, "amplitude": 25, "noise": 8,  "wpsMin": 90,  "wpsMax": 220},
            "voltage":  {"center": 25,  "amplitude": 1.5,"noise": 0.8,"wpsMin": 22,  "wpsMax": 28},
            "gasflow":  {"center": 0,   "amplitude": 0,  "noise": 0,  "wpsMin": 0,   "wpsMax": 0},
            "wirefeed": {"center": 0,   "amplitude": 0,  "noise": 0,  "wpsMin": 0,   "wpsMax": 0},
        }
    },
}


def generate_value(param, t, session_quality):
    """Generate a realistic weld parameter value with sinusoidal drift + noise."""
    if param["center"] == 0:
        return 0.0

    # Sinusoidal drift (simulates arc behavior)
    drift = param["amplitude"] * math.sin(t * 0.05) * 0.3
    # Random walk noise
    noise = random.gauss(0, param["noise"])
    # Quality factor — bad sessions have wider variance
    quality_mult = 1.0 + (1.0 - session_quality) * 2.0

    value = param["center"] + drift + noise * quality_mult
    return round(value, 1)


def generate_session(process_id, process, start_time, duration_seconds):
    """Generate a full weld session with time-series data points."""
    session_id = f"WS-{start_time.strftime('%Y')}-{random.randint(1000, 9999)}"
    machine_id = random.choice(process["machines"])
    operator = random.choice(process["operators"])

    # 85% chance of good quality, 10% marginal, 5% failure
    roll = random.random()
    if roll < 0.05:
        session_quality = random.uniform(0.2, 0.4)  # Failed
        status = "failed"
    elif roll < 0.15:
        session_quality = random.uniform(0.5, 0.7)  # Marginal
        status = "completed"
    else:
        session_quality = random.uniform(0.8, 1.0)  # Good
        status = "completed"

    data_points = []
    sums = {"current": 0, "voltage": 0, "gasflow": 0, "wirefeed": 0}
    count = 0

    for i in range(0, duration_seconds):
        ts = start_time + timedelta(seconds=i)
        point = {
            "machineId": machine_id,
            "timestamp": int(ts.timestamp() * 1000),
            "sessionId": session_id,
        }
        for metric, param in process["params"].items():
            val = generate_value(param, i, session_quality)
            point[metric] = val
            sums[metric] += val
        count += 1
        data_points.append(point)

    # Compute quality score based on how many points were in-spec
    in_spec = 0
    for dp in data_points:
        all_ok = True
        for metric, param in process["params"].items():
            if param["wpsMin"] == 0 and param["wpsMax"] == 0:
                continue
            if dp[metric] < param["wpsMin"] or dp[metric] > param["wpsMax"]:
                all_ok = False
                break
        if all_ok:
            in_spec += 1

    quality_score = round((in_spec / count) * 100) if count > 0 else 0

    session_meta = {
        "sessionId": session_id,
        "machineId": machine_id,
        "operator": operator,
        "wpsRef": process["wpsRef"],
        "processType": process_id,
        "startTime": int(start_time.timestamp() * 1000),
        "endTime": int((start_time + timedelta(seconds=duration_seconds)).timestamp() * 1000),
        "status": status,
        "avgCurrent": round(sums["current"] / count, 1),
        "avgVoltage": round(sums["voltage"] / count, 1),
        "avgGasflow": round(sums["gasflow"] / count, 1),
        "qualityScore": quality_score,
    }

    return session_meta, data_points


def main():
    parser = argparse.ArgumentParser(description="ArcMetric Bulk Data Seeder")
    parser.add_argument("--table", default="WeldData", help="DynamoDB table name")
    parser.add_argument("--region", default="us-east-1", help="AWS region")
    parser.add_argument("--sessions-per-process", type=int, default=5,
                        help="Number of sessions to generate per weld process")
    parser.add_argument("--duration-min", type=int, default=120,
                        help="Min session duration in seconds")
    parser.add_argument("--duration-max", type=int, default=600,
                        help="Max session duration in seconds")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print stats without writing to DynamoDB")
    args = parser.parse_args()

    dynamodb = boto3.resource("dynamodb", region_name=args.region)
    table = dynamodb.Table(args.table)

    now = datetime.utcnow()
    total_points = 0
    total_sessions = 0

    for proc_id, proc in WELD_PROCESSES.items():
        print(f"\n{'='*60}")
        print(f"Process: {proc['name']} ({proc_id})")
        print(f"{'='*60}")

        for s in range(args.sessions_per_process):
            # Stagger sessions over the past 24 hours
            offset_hours = random.uniform(0, 24)
            start_time = now - timedelta(hours=offset_hours)
            duration = random.randint(args.duration_min, args.duration_max)

            session_meta, data_points = generate_session(proc_id, proc, start_time, duration)

            print(f"  Session {session_meta['sessionId']}: "
                  f"{session_meta['machineId']} | "
                  f"{session_meta['operator']} | "
                  f"{duration}s | "
                  f"Quality: {session_meta['qualityScore']}% | "
                  f"Status: {session_meta['status']} | "
                  f"{len(data_points)} points")

            if not args.dry_run:
                # Batch write data points
                with table.batch_writer() as batch:
                    for dp in data_points:
                        batch.put_item(Item={
                            k: (str(v) if isinstance(v, float) else v)
                            for k, v in dp.items()
                        })

                print(f"    ✓ Written {len(data_points)} data points to DynamoDB")

            total_points += len(data_points)
            total_sessions += 1

    print(f"\n{'='*60}")
    print(f"TOTAL: {total_sessions} sessions, {total_points} data points")
    if args.dry_run:
        print("(DRY RUN — nothing written)")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
```

---

## 2. AWS Lambda — Continuous Simulator

Deploy this as a Lambda triggered by **CloudWatch Events** every 1 second (or every minute with burst).

### Lambda Code (`lambda_simulator.py`)

```python
"""
ArcMetric Continuous Simulator Lambda
Triggered by CloudWatch Events Rule (rate: 1 minute).
Generates 60 data points (1/sec) for each active simulated machine.

Environment Variables:
  TABLE_NAME: DynamoDB table name (default: WeldData)
  ACTIVE_PROCESSES: Comma-separated process IDs to simulate
                    (default: gmaw-mild-steel,gtaw-stainless)
"""

import os
import json
import math
import random
import time
from datetime import datetime, timedelta
import boto3
from decimal import Decimal

TABLE_NAME = os.environ.get("TABLE_NAME", "WeldData")
ACTIVE_PROCESSES = os.environ.get("ACTIVE_PROCESSES", "gmaw-mild-steel,gtaw-stainless").split(",")

# Same process definitions as CLI (abbreviated — copy from above)
WELD_PROCESSES = {
    "gmaw-mild-steel": {
        "machines": ["ESP32-WM-001"],
        "params": {
            "current":  {"center": 215, "amplitude": 30, "noise": 8},
            "voltage":  {"center": 25,  "amplitude": 3,  "noise": 1},
            "gasflow":  {"center": 17,  "amplitude": 2,  "noise": 0.5},
            "wirefeed": {"center": 9.5, "amplitude": 2,  "noise": 0.5},
        }
    },
    "gtaw-stainless": {
        "machines": ["ESP32-WM-006"],
        "params": {
            "current":  {"center": 125, "amplitude": 30, "noise": 5},
            "voltage":  {"center": 14,  "amplitude": 2,  "noise": 0.5},
            "gasflow":  {"center": 11,  "amplitude": 1.5,"noise": 0.3},
            "wirefeed": {"center": 1.8, "amplitude": 0.5,"noise": 0.2},
        }
    },
    "smaw-carbon": {
        "machines": ["ESP32-WM-010"],
        "params": {
            "current":  {"center": 160, "amplitude": 35, "noise": 12},
            "voltage":  {"center": 25,  "amplitude": 2,  "noise": 1},
            "gasflow":  {"center": 0,   "amplitude": 0,  "noise": 0},
            "wirefeed": {"center": 0,   "amplitude": 0,  "noise": 0},
        }
    },
}

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)


def gen_value(param, t):
    if param["center"] == 0:
        return Decimal("0")
    drift = param["amplitude"] * math.sin(t * 0.05) * 0.3
    noise = random.gauss(0, param["noise"])
    return Decimal(str(round(param["center"] + drift + noise, 1)))


def lambda_handler(event, context):
    now = datetime.utcnow()
    items_written = 0

    for proc_id in ACTIVE_PROCESSES:
        proc_id = proc_id.strip()
        if proc_id not in WELD_PROCESSES:
            continue

        proc = WELD_PROCESSES[proc_id]
        machine_id = proc["machines"][0]

        with table.batch_writer() as batch:
            for i in range(60):
                ts = now - timedelta(seconds=(59 - i))
                t = int(ts.timestamp())
                item = {
                    "machineId": machine_id,
                    "timestamp": int(ts.timestamp() * 1000),
                }
                for metric, param in proc["params"].items():
                    item[metric] = gen_value(param, t + i)

                batch.put_item(Item=item)
                items_written += 1

    return {
        "statusCode": 200,
        "body": json.dumps({
            "message": f"Generated {items_written} data points",
            "processes": ACTIVE_PROCESSES,
        })
    }
```

### CloudWatch Events Rule

```bash
aws events put-rule \
  --name arcmetric-simulator \
  --schedule-expression "rate(1 minute)" \
  --state ENABLED

aws lambda add-permission \
  --function-name arcmetric-simulator \
  --statement-id cloudwatch-trigger \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:us-east-1:YOUR_ACCOUNT:rule/arcmetric-simulator

aws events put-targets \
  --rule arcmetric-simulator \
  --targets "Id"="1","Arn"="arn:aws:lambda:us-east-1:YOUR_ACCOUNT:function:arcmetric-simulator"
```

### Lambda Environment Variables

| Variable | Value |
|---|---|
| `TABLE_NAME` | `WeldData` |
| `ACTIVE_PROCESSES` | `gmaw-mild-steel,gtaw-stainless,smaw-carbon` |

### IAM Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["dynamodb:BatchWriteItem", "dynamodb:PutItem"],
    "Resource": "arn:aws:dynamodb:us-east-1:*:table/WeldData"
  }]
}
```

---

## Quick Start

```bash
# 1. Bulk seed (dry run first)
python seed_weld_data.py --dry-run --sessions-per-process 3

# 2. Bulk seed to DynamoDB
python seed_weld_data.py --sessions-per-process 5 --table WeldData

# 3. Deploy Lambda simulator
zip simulator.zip lambda_simulator.py
aws lambda create-function \
  --function-name arcmetric-simulator \
  --runtime python3.12 \
  --handler lambda_simulator.lambda_handler \
  --role arn:aws:iam::YOUR_ACCOUNT:role/arcmetric-lambda-role \
  --zip-file fileb://simulator.zip \
  --environment "Variables={TABLE_NAME=WeldData,ACTIVE_PROCESSES=gmaw-mild-steel,gtaw-stainless}"
```
