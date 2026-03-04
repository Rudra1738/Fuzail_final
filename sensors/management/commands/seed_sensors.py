import random
import math
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from sensors.models import SensorReading, SensorAggregated1Sec


class Command(BaseCommand):
    help = 'Seed database with historical sensor data for testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--hours',
            type=int,
            default=24,
            help='Number of hours of historical data to generate (default: 24)'
        )
        parser.add_argument(
            '--frequency',
            type=int,
            default=1,
            help='Data frequency in Hz (default: 1 for 1-second data)'
        )
        parser.add_argument(
            '--sensors',
            type=str,
            default='all',
            help='Comma-separated sensor IDs (e.g., "1,2,3") or "all" for all sensors (default: all)'
        )

    def handle(self, *args, **options):
        hours = options['hours']
        frequency = options['frequency']
        sensor_ids_option = options['sensors']

        # Parse sensor IDs
        if sensor_ids_option == 'all':
            sensor_ids = list(range(1, 13))
        else:
            try:
                sensor_ids = [int(x.strip()) for x in sensor_ids_option.split(',')]
                sensor_ids = [s for s in sensor_ids if 1 <= s <= 12]
            except ValueError:
                self.stdout.write(self.style.ERROR('Invalid sensor IDs format'))
                return

        if not sensor_ids:
            self.stdout.write(self.style.ERROR('No valid sensor IDs provided'))
            return

        self.stdout.write(self.style.SUCCESS(
            f'Generating {hours} hours of data at {frequency}Hz for sensors: {sensor_ids}'
        ))

        # Calculate time range
        end_time = timezone.now()
        start_time = end_time - timedelta(hours=hours)
        total_seconds = int((end_time - start_time).total_seconds())
        total_readings = total_seconds * frequency * len(sensor_ids)

        self.stdout.write(f'Time range: {start_time} to {end_time}')
        self.stdout.write(f'Total readings to generate: {total_readings:,}')

        # Initialize sensor characteristics
        sensors_config = {}
        for sensor_id in sensor_ids:
            sensors_config[sensor_id] = {
                'base_value': random.uniform(40, 60),
                'trend': random.uniform(-0.001, 0.001),
                'noise_amplitude': random.uniform(1, 3),
                'frequency_multiplier': random.uniform(0.5, 2.0)
            }

        # Generate data
        batch_size = 1000
        readings_batch = []
        readings_created = 0

        interval = timedelta(seconds=1.0 / frequency)
        current_time = start_time

        while current_time < end_time:
            iteration = int((current_time - start_time).total_seconds() * frequency)

            for sensor_id in sensor_ids:
                config = sensors_config[sensor_id]

                # Generate realistic value
                base = config['base_value']
                trend = config['trend'] * iteration
                noise = random.gauss(0, config['noise_amplitude'])
                sinusoidal = 5 * math.sin(
                    iteration * 0.01 * config['frequency_multiplier'] + sensor_id
                )

                value = base + trend + noise + sinusoidal

                # Occasional spikes (0.5% chance)
                if random.random() < 0.005:
                    value += random.choice([-15, 15])

                # Create reading
                readings_batch.append(
                    SensorReading(
                        sensor_id=sensor_id,
                        timestamp=current_time,
                        value=round(value, 2)
                    )
                )

            # Bulk insert when batch is full
            if len(readings_batch) >= batch_size:
                SensorReading.objects.bulk_create(readings_batch, batch_size=batch_size)
                readings_created += len(readings_batch)
                readings_batch = []

                # Progress update
                progress = (readings_created / total_readings) * 100
                self.stdout.write(
                    f'\rProgress: {progress:.1f}% ({readings_created:,}/{total_readings:,} readings)',
                    ending=''
                )
                self.stdout.flush()

            current_time += interval

        # Insert remaining readings
        if readings_batch:
            SensorReading.objects.bulk_create(readings_batch, batch_size=batch_size)
            readings_created += len(readings_batch)

        self.stdout.write('')  # New line after progress
        self.stdout.write(self.style.SUCCESS(
            f'\n[OK] Successfully created {readings_created:,} sensor readings'
        ))

        # Now generate aggregated data if frequency is high
        if frequency > 1:
            self.stdout.write(self.style.SUCCESS(
                '\nGenerating 1-second aggregations...'
            ))
            self.generate_aggregations(start_time, end_time, sensor_ids)

    def generate_aggregations(self, start_time, end_time, sensor_ids):
        """Generate 1-second aggregations from the seeded raw data"""
        from django.db.models import Avg, Min, Max, StdDev, Count

        aggregations_batch = []
        batch_size = 100
        created_count = 0

        # Round start_time to the nearest second
        current_time = start_time.replace(microsecond=0)
        end_time_rounded = end_time.replace(microsecond=0)

        while current_time < end_time_rounded:
            next_time = current_time + timedelta(seconds=1)

            for sensor_id in sensor_ids:
                # Aggregate this second's data
                readings = SensorReading.objects.filter(
                    sensor_id=sensor_id,
                    timestamp__gte=current_time,
                    timestamp__lt=next_time
                )

                agg = readings.aggregate(
                    avg=Avg('value'),
                    min_val=Min('value'),
                    max_val=Max('value'),
                    std=StdDev('value'),
                    count=Count('id')
                )

                if agg['count'] and agg['count'] > 0:
                    aggregations_batch.append(
                        SensorAggregated1Sec(
                            sensor_id=sensor_id,
                            timestamp=current_time,
                            avg=agg['avg'],
                            min=agg['min_val'],
                            max=agg['max_val'],
                            std=agg['std'] if agg['std'] is not None else 0.0,
                            count=agg['count']
                        )
                    )

            # Bulk insert
            if len(aggregations_batch) >= batch_size:
                SensorAggregated1Sec.objects.bulk_create(
                    aggregations_batch,
                    batch_size=batch_size,
                    ignore_conflicts=True
                )
                created_count += len(aggregations_batch)
                aggregations_batch = []

                self.stdout.write(
                    f'\rAggregations created: {created_count:,}',
                    ending=''
                )
                self.stdout.flush()

            current_time = next_time

        # Insert remaining
        if aggregations_batch:
            SensorAggregated1Sec.objects.bulk_create(
                aggregations_batch,
                batch_size=batch_size,
                ignore_conflicts=True
            )
            created_count += len(aggregations_batch)

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f'[OK] Created {created_count:,} 1-second aggregations'
        ))
