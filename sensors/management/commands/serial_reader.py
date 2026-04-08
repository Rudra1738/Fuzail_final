import re
import time
import serial
import requests
from django.core.management.base import BaseCommand
from django.utils import timezone


# ============================================================================
# Field mapping: Tera Term field name → sensor_id
# Adjust this dict to match your hardware's serial output.
# ============================================================================
FIELD_TO_SENSOR = {
    'Temp': 2,         # Temperature        (BME688, °C)
    'RH': 3,           # Humidity            (BME688, %RH)
    'Pressure': 4,     # Pressure            (BME688, Pa)
    'TVOC': 5,         # Gas Resistance      (BME688, Ω)
    'IAQ': 6,          # IAQ Index           (BME688)
    'PM': 7,           # PM2.5               (SEN50, µg/m³)
    'Lux': 1,          # Light Intensity     (BH1750FVI, lx)
}

# Matches lines like: DATA [1] Temp:24.11 Pressure:30700.87 ...
DATA_LINE_RE = re.compile(r'^DATA\s*\[(\d+)\]\s+(.+)$')

# Matches key:value pairs, handles negative numbers and decimals
FIELD_RE = re.compile(r'([A-Za-z]\w*):([-+]?\d+(?:\.\d+)?)')


class Command(BaseCommand):
    help = (
        'Read live sensor data from a serial port (replaces Tera Term) '
        'and ingest into the Django API'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--port',
            type=str,
            required=True,
            help='Serial port (e.g. COM3, COM5, /dev/ttyUSB0)',
        )
        parser.add_argument(
            '--baud',
            type=int,
            default=115200,
            help='Baud rate (default: 115200)',
        )
        parser.add_argument(
            '--api-url',
            type=str,
            default='http://127.0.0.1:8000/api/sensors/ingest/',
            help='Ingestion API endpoint URL',
        )
        parser.add_argument(
            '--batch-interval',
            type=float,
            default=1.0,
            help='Seconds between batch POSTs to the API (default: 1.0)',
        )
        parser.add_argument(
            '--log-file',
            type=str,
            default=None,
            help='Also save raw serial lines to this file (like Tera Term logging)',
        )
        parser.add_argument(
            '--list-ports',
            action='store_true',
            help='List available serial ports and exit',
        )

    def handle(self, *args, **options):
        if options['list_ports']:
            self._list_ports()
            return

        port = options['port']
        baud = options['baud']
        api_url = options['api_url']
        batch_interval = options['batch_interval']
        log_file = options['log_file']

        self.stdout.write(self.style.SUCCESS(
            f'Connecting to {port} at {baud} baud...'
        ))

        try:
            ser = serial.Serial(
                port=port,
                baudrate=baud,
                timeout=1,
                bytesize=serial.EIGHTBITS,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE,
            )
        except serial.SerialException as e:
            self.stderr.write(self.style.ERROR(f'Failed to open {port}: {e}'))
            self.stderr.write('Run with --list-ports to see available ports.')
            return

        self.stdout.write(self.style.SUCCESS(f'Connected to {port}'))
        self.stdout.write(f'Mapped fields: {list(FIELD_TO_SENSOR.keys())}')
        self.stdout.write(f'Batch interval: {batch_interval}s')
        self.stdout.write(f'API endpoint: {api_url}')
        self.stdout.write('Press Ctrl+C to stop.\n')

        log_fh = None
        if log_file:
            log_fh = open(log_file, 'a', encoding='utf-8')
            self.stdout.write(f'Logging raw serial data to: {log_file}')

        batch = []
        readings_sent = 0
        lines_parsed = 0
        lines_skipped = 0
        errors = 0
        last_send = time.time()
        start_time = time.time()

        try:
            while True:
                raw_line = ser.readline()
                if not raw_line:
                    continue

                try:
                    line = raw_line.decode('utf-8', errors='replace').strip()
                except UnicodeDecodeError:
                    continue

                if not line:
                    continue

                # Log raw line if requested
                if log_fh:
                    log_fh.write(
                        f'{timezone.now().isoformat()} | {line}\n'
                    )
                    log_fh.flush()

                # Parse DATA lines, skip status/metadata lines
                match = DATA_LINE_RE.match(line)
                if not match:
                    lines_skipped += 1
                    continue

                fields_str = match.group(2)
                fields = FIELD_RE.findall(fields_str)
                now = timezone.now().isoformat()

                for field_name, field_value in fields:
                    sensor_id = FIELD_TO_SENSOR.get(field_name)
                    if sensor_id is None:
                        continue

                    try:
                        value = float(field_value)
                    except ValueError:
                        continue

                    batch.append({
                        'sensor_id': sensor_id,
                        'timestamp': now,
                        'value': value,
                    })

                lines_parsed += 1

                # Send batch at the configured interval
                now_mono = time.time()
                if now_mono - last_send >= batch_interval and batch:
                    try:
                        response = requests.post(
                            api_url, json=batch, timeout=5
                        )
                        if response.status_code == 201:
                            readings_sent += len(batch)
                        else:
                            errors += 1
                            self.stderr.write(self.style.ERROR(
                                f'API {response.status_code}: '
                                f'{response.text[:200]}'
                            ))
                    except requests.exceptions.RequestException as e:
                        errors += 1
                        if errors % 10 == 1:
                            self.stderr.write(self.style.ERROR(
                                f'Request failed: {e}'
                            ))

                    # Status update every ~50 parsed lines
                    if lines_parsed % 50 == 0:
                        elapsed = now_mono - start_time
                        rate = readings_sent / elapsed if elapsed > 0 else 0
                        self.stdout.write(self.style.SUCCESS(
                            f'[{elapsed:.0f}s] Parsed: {lines_parsed} | '
                            f'Sent: {readings_sent} ({rate:.1f}/s) | '
                            f'Skipped: {lines_skipped} | Errors: {errors}'
                        ))

                    batch = []
                    last_send = now_mono

        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING('\nStopped by user.'))
        finally:
            # Flush remaining batch
            if batch:
                try:
                    response = requests.post(
                        api_url, json=batch, timeout=5
                    )
                    if response.status_code == 201:
                        readings_sent += len(batch)
                except Exception:
                    pass

            ser.close()
            if log_fh:
                log_fh.close()

            total_time = time.time() - start_time
            self.stdout.write(self.style.SUCCESS(
                '\n=== Serial Reader Stopped ==='
            ))
            self.stdout.write(f'Duration:      {total_time:.1f}s')
            self.stdout.write(f'Lines parsed:  {lines_parsed}')
            self.stdout.write(f'Lines skipped: {lines_skipped}')
            self.stdout.write(f'Readings sent: {readings_sent}')
            self.stdout.write(f'Errors:        {errors}')

    def _list_ports(self):
        """List all available serial ports on this machine."""
        from serial.tools.list_ports import comports
        ports = comports()
        if not ports:
            self.stdout.write('No serial ports found.')
            return
        self.stdout.write(self.style.SUCCESS(f'Found {len(ports)} port(s):'))
        for p in ports:
            self.stdout.write(f'  {p.device:10s}  {p.description}')
