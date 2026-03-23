/*
 * ArcMetric ESP32 Firmware
 * Sensors: ACS712 (Current), DC Voltage Module 0-25V, DS18B20 (Temperature), SW420 (Vibration)
 * Sends data to AWS API Gateway POST /weld-data
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ─── WiFi ───
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD  = "YOUR_WIFI_PASSWORD";

// ─── AWS ───
const char* API_ENDPOINT = "https://YOUR_API_GATEWAY_ID.execute-api.us-east-1.amazonaws.com/weld-data";
const char* MACHINE_ID   = "ESP32-WM-001";
const char* SESSION_ID   = "";  // Set dynamically or leave empty

// ─── Pin Configuration ───
#define PIN_CURRENT    34   // ACS712 analog out → GPIO34 (ADC1)
#define PIN_VOLTAGE    35   // DC voltage sensor → GPIO35 (ADC1)
#define PIN_TEMP       4    // DS18B20 data pin → GPIO4
#define PIN_VIBRATION  27   // SW420 digital out → GPIO27

// ─── Sensor Calibration ───
// ACS712-20A: sensitivity = 100mV/A, Vref = 2.5V at 0A
const float ACS712_SENSITIVITY = 0.100;  // V/A
const float ACS712_VREF        = 2.500;  // Voltage at 0A
const float ADC_VREF           = 3.3;
const int   ADC_RESOLUTION     = 4095;

// DC Voltage Sensor: ratio depends on resistor divider (typically 5:1 for 0-25V module)
const float VOLTAGE_DIVIDER_RATIO = 5.0;

// ─── Intervals ───
const unsigned long SEND_INTERVAL_MS = 1000;  // Send every 1 second

// ─── DS18B20 Setup ───
OneWire oneWire(PIN_TEMP);
DallasTemperature tempSensor(&oneWire);

unsigned long lastSendTime = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Pin modes
  pinMode(PIN_CURRENT, INPUT);
  pinMode(PIN_VOLTAGE, INPUT);
  pinMode(PIN_VIBRATION, INPUT);

  // DS18B20
  tempSensor.begin();

  // WiFi
  Serial.printf("Connecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\nConnected! IP: %s\n", WiFi.localIP().toString().c_str());
}

float readCurrent() {
  // Average multiple readings for stability
  long total = 0;
  const int samples = 50;
  for (int i = 0; i < samples; i++) {
    total += analogRead(PIN_CURRENT);
    delayMicroseconds(200);
  }
  float avgADC = (float)total / samples;
  float voltage = (avgADC / ADC_RESOLUTION) * ADC_VREF;
  float current = (voltage - ACS712_VREF) / ACS712_SENSITIVITY;
  return abs(current);  // Return absolute value
}

float readVoltage() {
  long total = 0;
  const int samples = 50;
  for (int i = 0; i < samples; i++) {
    total += analogRead(PIN_VOLTAGE);
    delayMicroseconds(200);
  }
  float avgADC = (float)total / samples;
  float voltage = (avgADC / ADC_RESOLUTION) * ADC_VREF;
  return voltage * VOLTAGE_DIVIDER_RATIO;
}

float readTemperature() {
  tempSensor.requestTemperatures();
  float tempC = tempSensor.getTempCByIndex(0);
  if (tempC == DEVICE_DISCONNECTED_C) {
    Serial.println("DS18B20 disconnected!");
    return -999.0;
  }
  return tempC;
}

int readVibration() {
  // SW420 outputs HIGH when vibration detected
  return digitalRead(PIN_VIBRATION);
}

void sendData(float current, float voltage, float temperature, int vibration) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, skipping send");
    return;
  }

  HTTPClient http;
  http.begin(API_ENDPOINT);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["machineId"]   = MACHINE_ID;
  doc["timestamp"]   = millis();  // Or use NTP for real timestamps
  doc["current"]     = round(current * 10.0) / 10.0;
  doc["voltage"]     = round(voltage * 10.0) / 10.0;
  doc["gasflow"]     = 0;  // Simulated on dashboard side
  doc["wirefeed"]    = 0;  // Not connected
  doc["temperature"] = round(temperature * 10.0) / 10.0;
  doc["vibration"]   = vibration;

  if (strlen(SESSION_ID) > 0) {
    doc["sessionId"] = SESSION_ID;
  }

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);
  if (httpCode > 0) {
    Serial.printf("POST → %d | I=%.1fA V=%.1fV T=%.1f°C Vib=%d\n",
                  httpCode, current, voltage, temperature, vibration);
  } else {
    Serial.printf("POST failed: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}

void loop() {
  unsigned long now = millis();

  if (now - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = now;

    float current     = readCurrent();
    float voltage     = readVoltage();
    float temperature = readTemperature();
    int   vibration   = readVibration();

    sendData(current, voltage, temperature, vibration);
  }
}
