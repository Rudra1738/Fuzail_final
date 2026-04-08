import time
import random
import math
import requests
from datetime import datetime
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = 'Simulate 60Hz sensor stream from all 12 sensors (mimics Raspberry Pi behavior)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--duration',
            type=int,
            default=60,
            help='Duration to run the simulation in seconds (default: 60)'
        )
        parser.add_argument(
            '--api-url',
            type=str,
            default='http://127.0.0.1:8000/api/sensors/ingest/',
            help='URL of the ingestion API endpoint'
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=6,
            help='Number of readings to batch per sensor before sending (default: 6)'
        )

    def handle(self, *args, **options):
        duration = options['duration']
        api_url = options['api_url']
        batch_size = options['batch_size']

        self.stdout.write(self.style.SUCCESS(
            f'Starting sensor stream simulation for {duration} seconds'
        ))
        self.stdout.write(f'API URL: {api_url}')
        self.stdout.write(f'Batch size: {batch_size} readings per sensor')
        self.stdout.write(f'Total data rate: {12 * 60} readings/second ({12 * 60 * batch_size / batch_size} requests/second)')

        # Initialize sensor base values and trends
        sensors = {}
        for sensor_id in range(1, 13):
            sensors[sensor_id] = {
                'base_value': random.uniform(40, 60),  # Base value around 50
                'trend': random.uniform(-0.01, 0.01),  # Slow drift
                'noise_amplitude': random.uniform(1, 3),  # Noise level
                'batch': []  # Batch accumulator
            }

        start_time = time.time()
        iteration = 0
        readings_sent = 0
        errors = 0

        try:
            while time.time() - start_time < duration:
                iteration_start = time.time()
                batch_to_send = []

                # Generate readings for all 12 sensors
                for sensor_id in range(1, 13):
                    sensor_data = sensors[sensor_id]

                    # Generate realistic sensor value with noise and trend
                    base = sensor_data['base_value']
                    trend = sensor_data['trend'] * iteration
                    noise = random.gauss(0, sensor_data['noise_amplitude'])
                    sinusoidal = 5 * math.sin(iteration * 0.1 + sensor_id)  # Slow oscillation

                    value = base + trend + noise + sinusoidal

                    # Add occasional spikes for anomaly testing (1% chance)
                    if random.random() < 0.01:
                        value += random.choice([-20, 20])

                    # Create reading
                    reading = {
                        'sensor_id': sensor_id,
                        'timestamp': timezone.now().isoformat(),
                        'value': round(value, 2)
                    }

                    sensor_data['batch'].append(reading)

                    # If batch is full, add to send queue
                    if len(sensor_data['batch']) >= batch_size:
                        batch_to_send.extend(sensor_data['batch'])
                        sensor_data['batch'] = []

                # Send batch if we have data
                if batch_to_send:
                    try:
                        response = requests.post(
                            api_url,
                            json=batch_to_send,
                            timeout=5
                        )

                        if response.status_code == 201:
                            readings_sent += len(batch_to_send)
                            if iteration % 60 == 0:  # Print status every 60 iterations (~1 second)
                                elapsed = time.time() - start_time
                                rate = readings_sent / elapsed if elapsed > 0 else 0
                                self.stdout.write(
                                    self.style.SUCCESS(
                                        f'[{elapsed:.1f}s] Sent {readings_sent} readings '
                                        f'({rate:.1f} readings/sec) - Errors: {errors}'
                                    )
                                )
                        else:
                            errors += 1
                            self.stdout.write(
                                self.style.ERROR(
                                    f'API error: {response.status_code} - {response.text[:100]}'
                                )
                            )

                    except requests.exceptions.RequestException as e:
                        errors += 1
                        if errors % 10 == 1:  # Print every 10th error to avoid spam
                            self.stdout.write(
                                self.style.ERROR(f'Request failed: {str(e)[:100]}')
                            )

                iteration += 1

                # Sleep to maintain 60Hz rate (~16.67ms per iteration)
                elapsed = time.time() - iteration_start
                sleep_time = (1.0 / 60.0) - elapsed
                if sleep_time > 0:
                    time.sleep(sleep_time)

        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING('\nSimulation interrupted by user'))

        # Final statistics
        total_time = time.time() - start_time
        self.stdout.write(self.style.SUCCESS('\n=== Simulation Complete ==='))
        self.stdout.write(f'Duration: {total_time:.2f} seconds')
        self.stdout.write(f'Total readings sent: {readings_sent}')
        self.stdout.write(f'Average rate: {readings_sent / total_time:.2f} readings/second')
        self.stdout.write(f'Errors: {errors}')
        self.stdout.write(f'Success rate: {(readings_sent / (readings_sent + errors) * 100):.2f}%' if readings_sent + errors > 0 else 'N/A')
