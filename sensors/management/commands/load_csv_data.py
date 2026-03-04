"""
Management command to load sensor_data.csv into the database.
Populates SensorReading, SensorAggregated1Sec, SensorAggregated1Min,
SensorAggregated1Hour, and Anomaly tables.
"""
import csv
import statistics
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from sensors.models import (
    SensorReading,
    SensorAggregated1Sec,
    SensorAggregated1Min,
    SensorAggregated1Hour,
    Anomaly,
)

# Maps CSV column index (0-based, offset from reading_index) to sensor_id
# CSV columns after timestamp and reading_index:
#   col 2 = sensor 1 (Light), col 3 = sensor 2 (Temp), ... col 13 = sensor 12 (PM2.5)
SENSOR_COUNT = 12


class Command(BaseCommand):
    help = 'Load sensor_data.csv into the database and compute aggregations'

    def add_arguments(self, parser):
        parser.add_argument(
            '--csv', type=str, default='sensor_data.csv',
            help='Path to CSV file (default: sensor_data.csv)'
        )
        parser.add_argument(
            '--clear', action='store_true',
            help='Clear all existing sensor data before loading'
        )

    def handle(self, *args, **options):
        csv_path = options['csv']

        if options['clear']:
            self.stdout.write('Clearing existing data...')
            SensorReading.objects.all().delete()
            SensorAggregated1Sec.objects.all().delete()
            SensorAggregated1Min.objects.all().delete()
            SensorAggregated1Hour.objects.all().delete()
            Anomaly.objects.all().delete()
            self.stdout.write(self.style.SUCCESS('All existing data cleared.'))

        # Phase 1: Load raw readings
        self.stdout.write(f'Loading CSV from {csv_path}...')
        readings = []
        row_count = 0

        with open(csv_path, 'r') as f:
            reader = csv.reader(f)
            header = next(reader)  # skip header
            self.stdout.write(f'CSV columns: {len(header)}')

            for row in reader:
                timestamp_str = row[0]
                # Parse ISO timestamp and make timezone-aware
                ts = parse_datetime(timestamp_str)
                if ts is None:
                    ts = datetime.fromisoformat(timestamp_str)
                if ts.tzinfo is None:
                    ts = timezone.make_aware(ts)

                # Columns 2..13 are sensor values (sensor_id 1..12)
                for sensor_id in range(1, SENSOR_COUNT + 1):
                    col_idx = sensor_id + 1  # offset: col 2 = sensor 1
                    value = float(row[col_idx])
                    readings.append(SensorReading(
                        sensor_id=sensor_id,
                        timestamp=ts,
                        value=value,
                    ))

                row_count += 1
                if row_count % 10000 == 0:
                    self.stdout.write(f'  Parsed {row_count:,} rows ({len(readings):,} readings)...')

        self.stdout.write(f'Parsed {row_count:,} CSV rows -> {len(readings):,} sensor readings')
        self.stdout.write('Bulk inserting raw readings...')

        batch_size = 5000
        for i in range(0, len(readings), batch_size):
            SensorReading.objects.bulk_create(readings[i:i + batch_size], batch_size=batch_size)
            if (i // batch_size) % 20 == 0:
                self.stdout.write(f'  Inserted {min(i + batch_size, len(readings)):,}/{len(readings):,}')

        self.stdout.write(self.style.SUCCESS(f'Inserted {len(readings):,} raw readings.'))

        # Phase 2: Build 1-second aggregations
        self.stdout.write('Building 1-second aggregations...')
        self._aggregate(SensorAggregated1Sec, 'second')

        # Phase 3: Build 1-minute aggregations
        self.stdout.write('Building 1-minute aggregations...')
        self._aggregate(SensorAggregated1Min, 'minute')

        # Phase 4: Build 1-hour aggregations
        self.stdout.write('Building 1-hour aggregations...')
        self._aggregate(SensorAggregated1Hour, 'hour')

        # Phase 5: Detect anomalies
        self.stdout.write('Detecting anomalies...')
        anomaly_count = self._detect_anomalies()
        self.stdout.write(self.style.SUCCESS(f'Detected {anomaly_count} anomalies.'))

        self.stdout.write(self.style.SUCCESS('\nData load complete!'))
        self.stdout.write(f'  Raw readings:     {SensorReading.objects.count():,}')
        self.stdout.write(f'  1-sec aggregates: {SensorAggregated1Sec.objects.count():,}')
        self.stdout.write(f'  1-min aggregates: {SensorAggregated1Min.objects.count():,}')
        self.stdout.write(f'  1-hour aggregates:{SensorAggregated1Hour.objects.count():,}')
        self.stdout.write(f'  Anomalies:        {Anomaly.objects.count():,}')

    def _aggregate(self, model_class, level):
        """Build aggregation from raw SensorReading data."""
        records = []

        for sensor_id in range(1, SENSOR_COUNT + 1):
            qs = SensorReading.objects.filter(sensor_id=sensor_id).order_by('timestamp')
            all_readings = list(qs.values_list('timestamp', 'value'))

            if not all_readings:
                continue

            # Group by truncated timestamp
            buckets = {}
            for ts, val in all_readings:
                if level == 'second':
                    key = ts.replace(microsecond=0)
                elif level == 'minute':
                    key = ts.replace(second=0, microsecond=0)
                elif level == 'hour':
                    key = ts.replace(minute=0, second=0, microsecond=0)

                if key not in buckets:
                    buckets[key] = []
                buckets[key].append(val)

            for ts_key, values in buckets.items():
                avg_val = sum(values) / len(values)
                std_val = statistics.stdev(values) if len(values) > 1 else 0.0
                records.append(model_class(
                    sensor_id=sensor_id,
                    timestamp=ts_key,
                    avg=avg_val,
                    min=min(values),
                    max=max(values),
                    std=std_val,
                    count=len(values),
                ))

            self.stdout.write(f'  Sensor {sensor_id}: {len(buckets)} {level} buckets')

        if records:
            model_class.objects.bulk_create(records, batch_size=5000, ignore_conflicts=True)
        self.stdout.write(self.style.SUCCESS(f'  Total: {len(records):,} {level} records'))

    def _detect_anomalies(self):
        """Detect anomalies using 3-sigma rule on 1-sec aggregated data."""
        # Sensor-specific normal ranges based on datasheets
        SENSOR_RANGES = {
            1: (0, 65535),       # Light (lx)
            2: (-10, 50),        # Temperature (C)
            3: (10, 95),         # Humidity (%RH)
            4: (95000, 108000),  # Pressure (Pa)
            5: (5000, 400000),   # Gas Resistance (Ohm)
            6: (0, 150),         # IAQ (0-500, >150 is bad)
            7: (0, 20),          # CO (ppm, >20 is concerning)
            8: (0, 1.0),         # NO2 (ppm, >1 is high)
            9: (1, 50),          # NH3 (ppm, >50 is high)
            10: (0, 500),        # TVOC (ppb, >500 is high)
            11: (400, 2000),     # eCO2 (ppm, >2000 is high)
            12: (0, 35),         # PM2.5 (ug/m3, >35 WHO guideline)
        }

        anomalies = []
        for sensor_id in range(1, SENSOR_COUNT + 1):
            data = list(SensorAggregated1Sec.objects.filter(
                sensor_id=sensor_id
            ).order_by('timestamp').values_list('timestamp', 'avg'))

            if len(data) < 60:
                continue

            values = [v for _, v in data]
            range_min, range_max = SENSOR_RANGES.get(sensor_id, (0, 100))

            # Sliding window anomaly detection (10-minute window = 600 points)
            window_size = 600
            for i in range(window_size, len(data)):
                window = values[i - window_size:i]
                mean = sum(window) / len(window)
                std = (sum((v - mean) ** 2 for v in window) / len(window)) ** 0.5

                ts, val = data[i]

                # Spike detection: >3 sigma
                if std > 0 and abs(val - mean) > 3 * std:
                    severity = 'high' if abs(val - mean) > 5 * std else 'medium'
                    anomalies.append(Anomaly(
                        sensor_id=sensor_id,
                        timestamp=ts,
                        anomaly_type='spike',
                        severity=severity,
                        value=val,
                        expected_range_min=mean - 3 * std,
                        expected_range_max=mean + 3 * std,
                        description=f'Value {val:.2f} is {abs(val - mean) / std:.1f} sigma from mean {mean:.2f}',
                    ))

                # Out-of-range detection
                if val < range_min or val > range_max:
                    anomalies.append(Anomaly(
                        sensor_id=sensor_id,
                        timestamp=ts,
                        anomaly_type='out_of_range',
                        severity='high' if val > range_max * 1.5 or val < range_min * 0.5 else 'medium',
                        value=val,
                        expected_range_min=range_min,
                        expected_range_max=range_max,
                        description=f'Value {val:.2f} outside expected range [{range_min}, {range_max}]',
                    ))

        if anomalies:
            Anomaly.objects.bulk_create(anomalies, batch_size=5000, ignore_conflicts=True)
        return len(anomalies)
