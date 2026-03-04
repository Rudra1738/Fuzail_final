import os
from celery import Celery
from celery.schedules import crontab

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sensor_backend.settings')

app = Celery('sensor_backend')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

# Celery Beat Schedule for periodic tasks
app.conf.beat_schedule = {
    'aggregate-1sec-data': {
        'task': 'sensors.tasks.aggregate_1sec_data',
        'schedule': 1.0,  # Run every second
    },
    'aggregate-1min-data': {
        'task': 'sensors.tasks.aggregate_1min_data',
        'schedule': 60.0,  # Run every minute
    },
    'aggregate-1hour-data': {
        'task': 'sensors.tasks.aggregate_1hour_data',
        'schedule': 3600.0,  # Run every hour
    },
    'cleanup-old-readings': {
        'task': 'sensors.tasks.cleanup_old_readings',
        'schedule': crontab(hour=2, minute=0),  # Run daily at 2 AM
    },
}

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
