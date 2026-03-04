from celery import shared_task
from django.utils import timezone
from django.db.models import Avg, Min, Max, StdDev, Count
from datetime import timedelta
import math
from .models import (
    SensorReading,
    SensorAggregated1Sec,
    SensorAggregated1Min,
    SensorAggregated1Hour,
    Anomaly
)


@shared_task
def aggregate_1sec_data():
    """
    Aggregate raw 60Hz sensor data into 1-second summaries.
    Runs every second.
    """
    # Get current time and round down to the second
    now = timezone.now()
    end_time = now.replace(microsecond=0)
    start_time = end_time - timedelta(seconds=1)

    aggregated_count = 0

    # Process each sensor
    for sensor_id in range(1, 13):
        # Get all readings for this sensor in the last second
        readings = SensorReading.objects.filter(
            sensor_id=sensor_id,
            timestamp__gte=start_time,
            timestamp__lt=end_time
        )

        # Calculate aggregations
        agg_data = readings.aggregate(
            avg=Avg('value'),
            min_val=Min('value'),
            max_val=Max('value'),
            std=StdDev('value'),
            count=Count('id')
        )

        # Only create aggregation if we have data
        if agg_data['count'] and agg_data['count'] > 0:
            # Create or update 1-second aggregation
            SensorAggregated1Sec.objects.update_or_create(
                sensor_id=sensor_id,
                timestamp=start_time,
                defaults={
                    'avg': agg_data['avg'],
                    'min': agg_data['min_val'],
                    'max': agg_data['max_val'],
                    'std': agg_data['std'] if agg_data['std'] is not None else 0.0,
                    'count': agg_data['count']
                }
            )
            aggregated_count += 1

            # Check for anomalies
            detect_anomalies.delay(sensor_id, start_time, agg_data['avg'])

    return f"Aggregated 1-sec data for {aggregated_count} sensors"


@shared_task
def aggregate_1min_data():
    """
    Aggregate 1-second data into 1-minute summaries.
    Runs every minute.
    """
    # Get current time and round down to the minute
    now = timezone.now()
    end_time = now.replace(second=0, microsecond=0)
    start_time = end_time - timedelta(minutes=1)

    aggregated_count = 0

    # Process each sensor
    for sensor_id in range(1, 13):
        # Get all 1-second aggregations for this sensor in the last minute
        sec_data = SensorAggregated1Sec.objects.filter(
            sensor_id=sensor_id,
            timestamp__gte=start_time,
            timestamp__lt=end_time
        )

        # Calculate aggregations from the averages (weighted by count)
        agg_data = sec_data.aggregate(
            avg=Avg('avg'),
            min_val=Min('min'),
            max_val=Max('max'),
            count=Count('id')
        )

        # Calculate weighted standard deviation
        if agg_data['count'] and agg_data['count'] > 0:
            # Simple average of std devs (approximation)
            std_data = sec_data.aggregate(avg_std=Avg('std'))
            std = std_data['avg_std'] if std_data['avg_std'] is not None else 0.0

            # Create or update 1-minute aggregation
            SensorAggregated1Min.objects.update_or_create(
                sensor_id=sensor_id,
                timestamp=start_time,
                defaults={
                    'avg': agg_data['avg'],
                    'min': agg_data['min_val'],
                    'max': agg_data['max_val'],
                    'std': std,
                    'count': agg_data['count']
                }
            )
            aggregated_count += 1

    return f"Aggregated 1-min data for {aggregated_count} sensors"


@shared_task
def aggregate_1hour_data():
    """
    Aggregate 1-minute data into 1-hour summaries.
    Runs every hour.
    """
    # Get current time and round down to the hour
    now = timezone.now()
    end_time = now.replace(minute=0, second=0, microsecond=0)
    start_time = end_time - timedelta(hours=1)

    aggregated_count = 0

    # Process each sensor
    for sensor_id in range(1, 13):
        # Get all 1-minute aggregations for this sensor in the last hour
        min_data = SensorAggregated1Min.objects.filter(
            sensor_id=sensor_id,
            timestamp__gte=start_time,
            timestamp__lt=end_time
        )

        # Calculate aggregations
        agg_data = min_data.aggregate(
            avg=Avg('avg'),
            min_val=Min('min'),
            max_val=Max('max'),
            count=Count('id')
        )

        # Calculate weighted standard deviation
        if agg_data['count'] and agg_data['count'] > 0:
            # Simple average of std devs (approximation)
            std_data = min_data.aggregate(avg_std=Avg('std'))
            std = std_data['avg_std'] if std_data['avg_std'] is not None else 0.0

            # Create or update 1-hour aggregation
            SensorAggregated1Hour.objects.update_or_create(
                sensor_id=sensor_id,
                timestamp=start_time,
                defaults={
                    'avg': agg_data['avg'],
                    'min': agg_data['min_val'],
                    'max': agg_data['max_val'],
                    'std': std,
                    'count': agg_data['count']
                }
            )
            aggregated_count += 1

    return f"Aggregated 1-hour data for {aggregated_count} sensors"


@shared_task
def cleanup_old_readings():
    """
    Delete raw sensor readings older than 7 days.
    Runs daily at 2 AM (configured in celery.py).
    """
    cutoff_date = timezone.now() - timedelta(days=7)
    deleted_count, _ = SensorReading.objects.filter(timestamp__lt=cutoff_date).delete()

    # Also cleanup old 1-second aggregations (older than 30 days)
    cutoff_30_days = timezone.now() - timedelta(days=30)
    deleted_1sec, _ = SensorAggregated1Sec.objects.filter(timestamp__lt=cutoff_30_days).delete()

    # Cleanup old 1-minute aggregations (older than 1 year)
    cutoff_1_year = timezone.now() - timedelta(days=365)
    deleted_1min, _ = SensorAggregated1Min.objects.filter(timestamp__lt=cutoff_1_year).delete()

    return f"Deleted {deleted_count} raw readings, {deleted_1sec} 1-sec aggregations, {deleted_1min} 1-min aggregations"


@shared_task
def detect_anomalies(sensor_id, timestamp, current_value):
    """
    Detect anomalies in sensor data using statistical methods.
    - Spike detection: > 3 standard deviations from 10-minute rolling mean
    - Out of range: Below min or above max thresholds
    """
    # Get last 10 minutes of 1-second aggregated data for this sensor
    lookback_time = timestamp - timedelta(minutes=10)
    historical_data = SensorAggregated1Sec.objects.filter(
        sensor_id=sensor_id,
        timestamp__gte=lookback_time,
        timestamp__lt=timestamp
    )

    # Need at least 30 data points to calculate meaningful statistics
    if historical_data.count() < 30:
        return "Not enough historical data for anomaly detection"

    # Calculate rolling statistics
    stats = historical_data.aggregate(
        avg=Avg('avg'),
        std=StdDev('avg')
    )

    mean = stats['avg']
    std = stats['std'] if stats['std'] is not None else 0.0

    # Define sensor-specific thresholds (these would normally come from config/database)
    SENSOR_MIN = 0.0  # Minimum expected value
    SENSOR_MAX = 100.0  # Maximum expected value
    SPIKE_THRESHOLD = 3.0  # Number of standard deviations

    anomalies_created = []

    # Check for spike (> 3 std deviations from mean)
    if std > 0 and abs(current_value - mean) > (SPIKE_THRESHOLD * std):
        severity = 'high' if abs(current_value - mean) > (5 * std) else 'medium'
        anomaly = Anomaly.objects.create(
            sensor_id=sensor_id,
            timestamp=timestamp,
            anomaly_type='spike',
            severity=severity,
            value=current_value,
            expected_range_min=mean - (SPIKE_THRESHOLD * std),
            expected_range_max=mean + (SPIKE_THRESHOLD * std),
            description=f"Value {current_value:.2f} is {abs(current_value - mean) / std:.1f} std devs from mean {mean:.2f}"
        )
        anomalies_created.append('spike')

    # Check for out of range
    if current_value < SENSOR_MIN or current_value > SENSOR_MAX:
        anomaly = Anomaly.objects.create(
            sensor_id=sensor_id,
            timestamp=timestamp,
            anomaly_type='out_of_range',
            severity='high',
            value=current_value,
            expected_range_min=SENSOR_MIN,
            expected_range_max=SENSOR_MAX,
            description=f"Value {current_value:.2f} is outside range [{SENSOR_MIN}, {SENSOR_MAX}]"
        )
        anomalies_created.append('out_of_range')

    if anomalies_created:
        return f"Created {len(anomalies_created)} anomalies: {', '.join(anomalies_created)}"

    return "No anomalies detected"


@shared_task
def check_sensor_dropouts():
    """
    Check for sensor dropouts (no data for > 5 seconds).
    Runs periodically (every 10 seconds).
    """
    now = timezone.now()
    dropout_threshold = now - timedelta(seconds=5)
    dropouts_detected = []

    for sensor_id in range(1, 13):
        # Check last reading for this sensor
        last_reading = SensorReading.objects.filter(
            sensor_id=sensor_id
        ).order_by('-timestamp').first()

        if last_reading and last_reading.timestamp < dropout_threshold:
            # Check if we already reported this dropout recently
            recent_dropout = Anomaly.objects.filter(
                sensor_id=sensor_id,
                anomaly_type='dropout',
                timestamp__gte=now - timedelta(minutes=5)
            ).exists()

            if not recent_dropout:
                Anomaly.objects.create(
                    sensor_id=sensor_id,
                    timestamp=now,
                    anomaly_type='dropout',
                    severity='high',
                    value=0.0,
                    description=f"No data received for {(now - last_reading.timestamp).total_seconds():.0f} seconds"
                )
                dropouts_detected.append(sensor_id)

    if dropouts_detected:
        return f"Detected dropouts for sensors: {', '.join(map(str, dropouts_detected))}"

    return "No dropouts detected"
