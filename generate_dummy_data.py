"""
Dummy Sensor Data Generator
============================
Generates realistic environmental sensor data based on actual datasheets for 5 sensors
producing 12 measurement channels. Outputs to CSV.

All values, precision, noise, and distributions are derived from the actual sensor
datasheets in sensor_schematics/.

Sensors & Channels:
  1.  BH1750FVI   -> Light Intensity (lx)          [integer, 1 lx resolution, 1-65535]
  2.  BME688      -> Temperature (C)                [2 decimals, accuracy +/-0.5C]
  3.  BME688      -> Humidity (%RH)                 [2 decimals, accuracy +/-3% RH]
  4.  BME688      -> Barometric Pressure (Pa)       [integer Pa, accuracy +/-60 Pa]
  5.  BME688      -> Gas Resistance (Ohm)           [integer Ohm, typ 50k-200k clean air]
  6.  BME688      -> IAQ Index                      [2 decimals, 0-500 per UBA]
  7.  MiCS-6814   -> CO (ppm)                       [2 decimals, 1-1000 ppm]
  8.  MiCS-6814   -> NO2 (ppm)                      [4 decimals, 0.05-10 ppm]
  9.  MiCS-6814   -> NH3 (ppm)                      [2 decimals, 1-300 ppm]
  10. ZMOD4410    -> TVOC (ppb)                     [1 decimal, 0-5000 ppb]
  11. ZMOD4410    -> eCO2 (ppm)                     [integer, 400-5000 ppm]
  12. SEN5x       -> PM2.5 (ug/m3)                  [1 decimal, 0-1000 ug/m3]

Usage:
  python generate_dummy_data.py [--hours 24] [--frequency 1] [--output sensor_data.csv]
"""

import argparse
import csv
import math
import random
import sys
from datetime import datetime, timedelta


# ============================================================================
# Sensor channel definitions from datasheets
# ============================================================================

SENSOR_CHANNELS = {
    1:  {"name": "Light_Intensity",     "sensor": "BH1750FVI",  "unit": "lx",     "min": 0,     "max": 65535,  "precision": 0},
    2:  {"name": "Temperature",         "sensor": "BME688",     "unit": "C",      "min": -40,   "max": 85,     "precision": 2},
    3:  {"name": "Humidity",            "sensor": "BME688",     "unit": "%RH",    "min": 0,     "max": 100,    "precision": 2},
    4:  {"name": "Barometric_Pressure", "sensor": "BME688",     "unit": "Pa",     "min": 30000, "max": 110000, "precision": 0},
    5:  {"name": "Gas_Resistance",      "sensor": "BME688",     "unit": "Ohm",    "min": 1000,  "max": 500000, "precision": 0},
    6:  {"name": "IAQ_Index",           "sensor": "BME688",     "unit": "index",  "min": 0,     "max": 500,    "precision": 2},
    7:  {"name": "CO",                  "sensor": "MiCS-6814",  "unit": "ppm",    "min": 0,     "max": 1000,   "precision": 2},
    8:  {"name": "NO2",                 "sensor": "MiCS-6814",  "unit": "ppm",    "min": 0,     "max": 10,     "precision": 4},
    9:  {"name": "NH3",                 "sensor": "MiCS-6814",  "unit": "ppm",    "min": 0,     "max": 300,    "precision": 2},
    10: {"name": "TVOC",               "sensor": "ZMOD4410",   "unit": "ppb",    "min": 0,     "max": 5000,   "precision": 1},
    11: {"name": "eCO2",               "sensor": "ZMOD4410",   "unit": "ppm",    "min": 400,   "max": 5000,   "precision": 0},
    12: {"name": "PM2_5",              "sensor": "SEN5x",      "unit": "ug/m3",  "min": 0,     "max": 1000,   "precision": 1},
}


class SensorState:
    """Maintains persistent state for realistic autocorrelated sensor output."""

    def __init__(self, seed=42):
        self.rng = random.Random(seed)
        # Slow-varying environment state (brownian walk components)
        self.weather_pressure_offset = 0.0
        self.cloud_cover = 0.3          # 0=clear, 1=overcast
        self.wind_speed = 1.0           # m/s, affects PM and gas dispersion
        self.pollution_event = 0.0      # 0=none, >0 = ongoing event intensity
        self.pollution_decay = 0.0
        # Per-reading autocorrelation buffers
        self._prev_light = 0.0
        self._prev_temp = 22.0
        self._prev_hum = 50.0
        self._prev_pressure = 101325.0
        self._prev_gas_res = 80000.0
        self._prev_iaq = 25.0
        self._prev_co = 0.8
        self._prev_no2 = 0.03
        self._prev_nh3 = 5.0
        self._prev_tvoc = 80.0
        self._prev_eco2 = 450.0
        self._prev_pm25 = 8.0

    def _brownian_step(self, prev, target, alpha, noise_std):
        """Exponential moving average toward target + gaussian noise.
        alpha in [0,1]: 0=no movement, 1=instant snap to target."""
        noise = self.rng.gauss(0, noise_std)
        return prev * (1 - alpha) + target * alpha + noise

    def update_environment(self, t_hours):
        """Update slow-varying environmental state each timestep."""
        # Weather front: random walk on pressure offset (very slow)
        self.weather_pressure_offset += self.rng.gauss(0, 0.5)
        self.weather_pressure_offset *= 0.9995  # mean-revert slowly

        # Cloud cover: random walk clamped [0, 1]
        self.cloud_cover += self.rng.gauss(0, 0.005)
        self.cloud_cover = max(0.0, min(1.0, self.cloud_cover))

        # Wind: random walk [0.2, 8]
        self.wind_speed += self.rng.gauss(0, 0.02)
        self.wind_speed = max(0.2, min(8.0, self.wind_speed))

        # Pollution events: rare onset, exponential decay
        if self.pollution_event <= 0.01:
            # ~0.1% chance per reading of a pollution event starting
            if self.rng.random() < 0.001:
                self.pollution_event = self.rng.uniform(0.3, 1.0)
        else:
            # Decay with time constant ~30 min
            self.pollution_event *= 0.9997

    def generate_row(self, t_hours):
        """Generate one row of 12 correlated sensor values."""
        self.update_environment(t_hours)
        hour_of_day = t_hours % 24
        day_of_run = t_hours / 24.0

        # ====================================================================
        # 1. BH1750FVI - Light Intensity (lx)
        # Datasheet: 16-bit output, 1 lx H-resolution, range 1-65535 lx
        # Measurement accuracy ±20%, peak spectral response 560nm
        # Output is INTEGER lux (digital 16-bit ADC)
        # ====================================================================
        if 5.5 <= hour_of_day <= 20.5:
            # Sunrise/sunset transitions + daytime bell curve
            if hour_of_day < 7:
                # Dawn ramp: 0 -> ~500 lx
                dawn_frac = (hour_of_day - 5.5) / 1.5
                target_light = 500 * dawn_frac ** 2
            elif hour_of_day > 19:
                # Dusk ramp: ~500 -> 0 lx
                dusk_frac = (20.5 - hour_of_day) / 1.5
                target_light = 500 * dusk_frac ** 2
            else:
                # Daytime: sinusoidal, peaks ~13:00 at 30k-50k lx
                phase = (hour_of_day - 7) / 12.0
                target_light = 2000 + 40000 * math.sin(phase * math.pi)
            # Cloud attenuation (clouds reduce light by 50-90%)
            cloud_factor = 1.0 - 0.75 * self.cloud_cover
            target_light *= cloud_factor
        else:
            # Nighttime: 0-5 lx (moonlight, ambient)
            target_light = self.rng.uniform(0, 5)

        # BH1750 quantizes to 1 lx (16-bit ADC). Apply ±20% accuracy variation
        accuracy_factor = 1.0 + self.rng.gauss(0, 0.06)  # ~±20% at 3σ
        target_light *= accuracy_factor
        # Smooth transitions (sensor has 120ms integration time in H-res mode)
        self._prev_light = self._brownian_step(self._prev_light, target_light, 0.3, 1.0)
        # Integer output (digital sensor)
        light = int(round(max(0, min(65535, self._prev_light))))

        # ====================================================================
        # 2. BME688 - Temperature (°C)
        # Datasheet: range -40 to +85°C, accuracy ±0.5°C (0-65°C)
        # Resolution: 0.01°C (readTemperature()/100, 2 decimal places)
        # Output from sample: 26.92, 26.94 (2 decimal places)
        # ====================================================================
        # Realistic diurnal cycle: min ~5am, max ~15:00
        temp_diurnal = 6.0 * math.sin((hour_of_day - 5) / 24.0 * 2 * math.pi)
        # Multi-day weather drift
        temp_weather = 3.0 * math.sin(day_of_run * 0.4) + 1.5 * math.sin(day_of_run * 1.1 + 0.5)
        temp_target = 22.0 + temp_diurnal + temp_weather
        # BME688 accuracy: ±0.5°C at 3σ => σ ≈ 0.17°C
        self._prev_temp = self._brownian_step(self._prev_temp, temp_target, 0.02, 0.05)
        temperature = round(max(-40, min(85, self._prev_temp)), 2)

        # ====================================================================
        # 3. BME688 - Humidity (%RH)
        # Datasheet: range 0-100 %RH, accuracy ±3% RH (20-80% RH, 25°C)
        # Resolution: 0.01% RH (readHumidity()/1000, 2 decimal places)
        # Output from sample: 47.07, 46.95
        # Anti-correlated with temperature (Clausius-Clapeyron)
        # ====================================================================
        # Base humidity inversely related to temperature
        hum_target = 60.0 - 1.2 * (temperature - 22.0)
        # Night is more humid
        hum_diurnal = 8.0 * math.sin((hour_of_day - 15) / 24.0 * 2 * math.pi)
        hum_target += hum_diurnal
        # Weather influence
        hum_target += 5.0 * self.cloud_cover
        # BME688 accuracy: ±3% RH at 3σ => σ ≈ 1.0%
        self._prev_hum = self._brownian_step(self._prev_hum, hum_target, 0.02, 0.3)
        humidity = round(max(0, min(100, self._prev_hum)), 2)

        # ====================================================================
        # 4. BME688 - Barometric Pressure (Pa)
        # Datasheet: range 300-1100 hPa (30000-110000 Pa), accuracy ±0.6 hPa (±60 Pa)
        # Output from sample: 101653.00, 101663.00 (integer Pa from readPressure())
        # ====================================================================
        # Base sea-level pressure + weather front
        pres_target = 101325.0 + self.weather_pressure_offset * 30.0
        # Slow sinusoidal weather front (±1500 Pa over days)
        pres_target += 1500.0 * math.sin(t_hours / 72.0)
        pres_target += 500.0 * math.sin(t_hours / 168.0 + 1.2)
        # BME688 accuracy: ±60 Pa at 3σ => σ ≈ 20 Pa
        self._prev_pressure = self._brownian_step(self._prev_pressure, pres_target, 0.01, 8.0)
        # Integer Pa output (as shown in BME688 sample output)
        pressure = int(round(max(30000, min(110000, self._prev_pressure))))

        # ====================================================================
        # 6. BME688 - IAQ Index (0-500)
        # Datasheet: UBA standard. 0-50=good, 51-100=average, 101-150=little bad,
        # 151-200=bad, 201-300=worse, 301-500=very bad
        # Output from sample: 25.00 (2 decimal places)
        # Driven by gas composition, independent source for correlating others
        # ====================================================================
        # Baseline IAQ ~25 (good air)
        iaq_base = 25.0
        # Morning rush (8am): cooking, traffic
        iaq_morning = 30.0 * math.exp(-0.5 * ((hour_of_day - 8) / 1.5) ** 2)
        # Evening activity (7pm): cooking, heating
        iaq_evening = 40.0 * math.exp(-0.5 * ((hour_of_day - 19) / 2.0) ** 2)
        # Pollution event contribution
        iaq_pollution = self.pollution_event * 150.0
        # Wind disperses pollutants
        wind_factor = max(0.3, 1.0 - 0.08 * self.wind_speed)
        iaq_target = (iaq_base + iaq_morning + iaq_evening + iaq_pollution) * wind_factor
        # Slow autocorrelation (IAQ changes slowly, ~30s time constant)
        self._prev_iaq = self._brownian_step(self._prev_iaq, iaq_target, 0.015, 1.5)
        iaq = round(max(0, min(500, self._prev_iaq)), 2)

        # ====================================================================
        # 5. BME688 - Gas Resistance (Ohm)
        # Datasheet: Heating layer at 320°C for 100ms, read resistance
        # Output from sample: 51100.00, 52750.00, 56700.00 (integer Ohm)
        # Higher resistance = cleaner air. Clean air: ~50k-200k Ohm
        # Inversely related to IAQ. Affected by humidity.
        # ====================================================================
        # Clean air baseline ~80kOhm, decreases with pollution
        gas_base = 120000.0 - 500.0 * iaq
        # Humidity reduces resistance (MOx sensor characteristic)
        hum_factor = 1.0 - 0.004 * (humidity - 40.0)
        gas_target = gas_base * max(0.3, hum_factor)
        gas_target = max(5000, gas_target)
        # Noise: ~5% of reading (MOx sensors have noticeable variance)
        self._prev_gas_res = self._brownian_step(
            self._prev_gas_res, gas_target, 0.03, gas_target * 0.015
        )
        # Integer Ohm output (as shown in BME688 sample)
        gas_resistance = int(round(max(1000, min(500000, self._prev_gas_res))))

        # ====================================================================
        # 7. MiCS-6814 RED sensor - CO (ppm)
        # Datasheet: 1-1000 ppm detection range
        # Sensitivity factor S60: 1.2-50 (Rs at 60ppm / Rs in air)
        # R0 (baseline resistance): 100k-1500k Ohm
        # Ambient CO: typically 0.5-5 ppm outdoors
        # ====================================================================
        # Correlated with IAQ
        co_base = 0.5 + 0.04 * iaq
        # Traffic peaks
        co_traffic = 1.5 * math.exp(-0.5 * ((hour_of_day - 8) / 2.0) ** 2)
        co_traffic += 2.5 * math.exp(-0.5 * ((hour_of_day - 18) / 2.5) ** 2)
        co_pollution = self.pollution_event * 30.0
        co_target = (co_base + co_traffic + co_pollution) * wind_factor
        # MiCS-6814 has slow response; resistance-based measurement has ~10% noise
        self._prev_co = self._brownian_step(self._prev_co, co_target, 0.03, 0.15)
        co = round(max(0, min(1000, self._prev_co)), 2)

        # ====================================================================
        # 8. MiCS-6814 OX sensor - NO2 (ppm)
        # Datasheet: 0.05-10 ppm detection range
        # R0 (baseline resistance): 0.8k-20k Ohm
        # Sensitivity factor: ≥2 at 0.25 ppm NO2
        # Ambient NO2: typically 0.01-0.05 ppm outdoors
        # ====================================================================
        no2_base = 0.015 + 0.0004 * iaq
        no2_traffic = 0.025 * math.exp(-0.5 * ((hour_of_day - 8) / 1.5) ** 2)
        no2_traffic += 0.040 * math.exp(-0.5 * ((hour_of_day - 18) / 2.0) ** 2)
        no2_pollution = self.pollution_event * 2.0
        no2_target = (no2_base + no2_traffic + no2_pollution) * wind_factor
        self._prev_no2 = self._brownian_step(self._prev_no2, no2_target, 0.02, 0.003)
        no2 = round(max(0, min(10, self._prev_no2)), 4)

        # ====================================================================
        # 9. MiCS-6814 NH3 sensor - NH3 (ppm)
        # Datasheet: 1-300 ppm detection range
        # R0 (baseline resistance): 10k-1500k Ohm
        # Sensitivity factor: 1.5-15 at 1 ppm NH3
        # Ambient NH3: typically 1-25 ppb outdoors (0.001-0.025 ppm)
        # Note: sensor floor is ~1 ppm; below that is noise
        # ====================================================================
        nh3_base = 2.0 + 0.02 * iaq
        # Agricultural/industrial sources: slow drift
        nh3_drift = 1.5 * math.sin(t_hours / 48.0 + 0.8)
        nh3_pollution = self.pollution_event * 15.0
        nh3_target = max(1.0, (nh3_base + nh3_drift + nh3_pollution) * wind_factor)
        # NH3 sensor has significant noise at low concentrations
        self._prev_nh3 = self._brownian_step(self._prev_nh3, nh3_target, 0.02, 0.4)
        nh3 = round(max(1.0, min(300, self._prev_nh3)), 2)

        # ====================================================================
        # 10. ZMOD4410 - TVOC (ppb)
        # Datasheet: Absolute TVOC measurement, AI-based algorithmic output
        # Range: 0-5000+ ppb. Clean indoor: <300 ppb, moderate: 300-1000,
        # poor: >1000 ppb (PBAQ standard)
        # Warm-up time: ~5 min for stable readings
        # ====================================================================
        tvoc_base = 50.0 + 2.5 * iaq
        # Indoor activity: cooking/cleaning peaks
        tvoc_morning = 60.0 * math.exp(-0.5 * ((hour_of_day - 7.5) / 1.5) ** 2)
        tvoc_evening = 100.0 * math.exp(-0.5 * ((hour_of_day - 19) / 2.0) ** 2)
        tvoc_pollution = self.pollution_event * 800.0
        tvoc_target = tvoc_base + tvoc_morning + tvoc_evening + tvoc_pollution
        # ZMOD4410 has algorithmic smoothing built in
        self._prev_tvoc = self._brownian_step(self._prev_tvoc, tvoc_target, 0.02, 8.0)
        tvoc = round(max(0, min(5000, self._prev_tvoc)), 1)

        # ====================================================================
        # 11. ZMOD4410 - eCO2 (ppm)
        # Datasheet: Estimated CO2 correlation from TVOC
        # Range: 400-5000 ppm. Outdoor baseline ~420 ppm.
        # Indoor: 400-1000 good, 1000-2000 moderate, >2000 poor
        # Integer output from algorithm
        # ====================================================================
        # eCO2 derived from TVOC via ZMOD4410's algorithm
        eco2_target = 420.0 + 0.6 * tvoc + 2.0 * iaq
        # Indoor occupancy effect
        eco2_occupancy = 100.0 * math.exp(-0.5 * ((hour_of_day - 14) / 4.0) ** 2)
        eco2_target += eco2_occupancy
        self._prev_eco2 = self._brownian_step(self._prev_eco2, eco2_target, 0.015, 5.0)
        # Integer ppm output
        eco2 = int(round(max(400, min(5000, self._prev_eco2))))

        # ====================================================================
        # 12. SEN5x - PM2.5 (ug/m3)
        # Datasheet: Laser scattering, sampling interval 1±0.03s
        # Range: 0-1000 ug/m3, accuracy ±5 ug/m3 (0-100) or ±10% (100-1000)
        # Resolution: 0.1 ug/m3
        # WHO guideline: <15 ug/m3 annual, <45 ug/m3 24h mean
        # ====================================================================
        pm_base = 8.0 + 0.15 * iaq
        # Traffic/activity peaks
        pm_morning = 6.0 * math.exp(-0.5 * ((hour_of_day - 8) / 2.0) ** 2)
        pm_evening = 10.0 * math.exp(-0.5 * ((hour_of_day - 19) / 2.5) ** 2)
        # Wind disperses PM, but also can kick up dust
        pm_wind = 0.0
        if self.wind_speed > 4.0:
            pm_wind = (self.wind_speed - 4.0) * 3.0  # dust resuspension
        pm_pollution = self.pollution_event * 80.0
        pm_target = (pm_base + pm_morning + pm_evening + pm_pollution + pm_wind) * max(0.5, wind_factor)
        # SEN5x accuracy: ±5 ug/m3 at low concentrations
        self._prev_pm25 = self._brownian_step(self._prev_pm25, pm_target, 0.04, 0.8)
        pm25 = round(max(0, min(1000, self._prev_pm25)), 1)

        return [light, temperature, humidity, pressure, gas_resistance, iaq,
                co, no2, nh3, tvoc, eco2, pm25]


def generate_data(hours, frequency_hz, output_file):
    """Generate sensor data and write to CSV."""
    total_seconds = int(hours * 3600)
    interval = 1.0 / frequency_hz
    total_readings = int(total_seconds * frequency_hz)

    print(f"Generating {total_readings:,} readings over {hours}h at {frequency_hz} Hz...")
    print(f"  12 channels x {total_readings:,} = {12 * total_readings:,} total data points")
    print(f"  Output: {output_file}")

    start_time = datetime(2026, 3, 4, 0, 0, 0)
    state = SensorState(seed=42)

    # CSV header with sensor name, channel name, and unit
    header = ["timestamp", "reading_index"]
    for sid, info in SENSOR_CHANNELS.items():
        header.append(f"sensor_{sid}_{info['name']}({info['unit']})")

    written = 0
    with open(output_file, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)

        for i in range(total_readings):
            t_seconds = i * interval
            t_hours = t_seconds / 3600.0
            timestamp = start_time + timedelta(seconds=t_seconds)

            values = state.generate_row(t_hours)

            row = [
                timestamp.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3],  # ms precision
                i,
            ] + values

            writer.writerow(row)
            written += 1

            if written % 10000 == 0 or written == total_readings:
                pct = written / total_readings * 100
                sys.stdout.write(f"\r  Progress: {written:,}/{total_readings:,} ({pct:.1f}%)")
                sys.stdout.flush()

    print(f"\n\nDone! Wrote {written:,} rows to {output_file}")

    # Print summary
    print("\n--- Sensor Channel Summary ---")
    print(f"{'ID':>3} {'Sensor':<12} {'Channel':<22} {'Unit':<8} {'Precision':<10} {'Range'}")
    print("-" * 80)
    for sid, info in SENSOR_CHANNELS.items():
        prec = f"{info['precision']} dp" if info['precision'] > 0 else "integer"
        print(f"{sid:>3} {info['sensor']:<12} {info['name']:<22} {info['unit']:<8} {prec:<10} "
              f"{info['min']} - {info['max']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate realistic dummy sensor data based on actual datasheets "
                    "for 5 environmental sensors (12 channels)."
    )
    parser.add_argument(
        "--hours", type=float, default=24,
        help="Hours of data to generate (default: 24)"
    )
    parser.add_argument(
        "--frequency", type=float, default=1,
        help="Readings per second in Hz (default: 1). Use 60 for full 60Hz."
    )
    parser.add_argument(
        "--output", type=str, default="sensor_data.csv",
        help="Output CSV filename (default: sensor_data.csv)"
    )
    args = parser.parse_args()
    generate_data(args.hours, args.frequency, args.output)
