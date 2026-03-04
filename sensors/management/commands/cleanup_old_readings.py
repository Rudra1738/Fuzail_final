from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from sensors.models import SensorReading, SensorAggregated1Sec, SensorAggregated1Min


class Command(BaseCommand):
    help = 'Manually cleanup old sensor data (normally runs via Celery)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=7,
            help='Delete raw readings older than this many days (default: 7)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting'
        )

    def handle(self, *args, **options):
        days = options['days']
        dry_run = options['dry_run']

        cutoff_raw = timezone.now() - timedelta(days=days)
        cutoff_1sec = timezone.now() - timedelta(days=30)
        cutoff_1min = timezone.now() - timedelta(days=365)

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - No data will be deleted'))

        # Count what will be deleted
        raw_count = SensorReading.objects.filter(timestamp__lt=cutoff_raw).count()
        sec_count = SensorAggregated1Sec.objects.filter(timestamp__lt=cutoff_1sec).count()
        min_count = SensorAggregated1Min.objects.filter(timestamp__lt=cutoff_1min).count()

        self.stdout.write(f'\nRaw readings older than {days} days: {raw_count:,}')
        self.stdout.write(f'1-sec aggregations older than 30 days: {sec_count:,}')
        self.stdout.write(f'1-min aggregations older than 365 days: {min_count:,}')

        if not dry_run:
            # Delete raw readings
            if raw_count > 0:
                deleted, _ = SensorReading.objects.filter(timestamp__lt=cutoff_raw).delete()
                self.stdout.write(self.style.SUCCESS(f'[OK] Deleted {deleted:,} raw readings'))

            # Delete 1-sec aggregations
            if sec_count > 0:
                deleted, _ = SensorAggregated1Sec.objects.filter(timestamp__lt=cutoff_1sec).delete()
                self.stdout.write(self.style.SUCCESS(f'[OK] Deleted {deleted:,} 1-sec aggregations'))

            # Delete 1-min aggregations
            if min_count > 0:
                deleted, _ = SensorAggregated1Min.objects.filter(timestamp__lt=cutoff_1min).delete()
                self.stdout.write(self.style.SUCCESS(f'[OK] Deleted {deleted:,} 1-min aggregations'))

            self.stdout.write(self.style.SUCCESS('\n[OK] Cleanup complete'))
        else:
            self.stdout.write(self.style.WARNING('\nDry run complete - no data was deleted'))
