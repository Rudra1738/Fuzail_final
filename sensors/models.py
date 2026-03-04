from django.db import models
from django.utils import timezone
from datetime import timedelta


class SensorReading(models.Model):
    """
    Raw sensor readings at 60Hz frequency.
    Retention: 7 days, then auto-deleted.
    """
    sensor_id = models.IntegerField(db_index=True, help_text="Sensor ID (1-12)")
    timestamp = models.DateTimeField(db_index=True, help_text="Reading timestamp with microsecond precision")
    value = models.FloatField(help_text="Sensor reading value")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'sensor_readings'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['sensor_id', '-timestamp']),
            models.Index(fields=['timestamp']),
        ]
        verbose_name = 'Sensor Reading'
        verbose_name_plural = 'Sensor Readings'

    def __str__(self):
        return f"Sensor {self.sensor_id} at {self.timestamp}: {self.value}"

    @classmethod
    def cleanup_old_readings(cls, days=7):
        """Delete readings older than specified days"""
        cutoff_date = timezone.now() - timedelta(days=days)
        deleted_count, _ = cls.objects.filter(timestamp__lt=cutoff_date).delete()
        return deleted_count


class SensorAggregated1Sec(models.Model):
    """
    1-second aggregated sensor data.
    Retention: 30 days.
    """
    sensor_id = models.IntegerField(db_index=True)
    timestamp = models.DateTimeField(db_index=True, help_text="Aggregation window start time (second precision)")
    avg = models.FloatField(help_text="Average value")
    min = models.FloatField(help_text="Minimum value")
    max = models.FloatField(help_text="Maximum value")
    std = models.FloatField(null=True, blank=True, help_text="Standard deviation")
    count = models.IntegerField(help_text="Number of readings in aggregation")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'sensor_aggregated_1sec'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['sensor_id', '-timestamp']),
            models.Index(fields=['timestamp']),
        ]
        unique_together = [['sensor_id', 'timestamp']]
        verbose_name = '1-Second Aggregation'
        verbose_name_plural = '1-Second Aggregations'

    def __str__(self):
        return f"Sensor {self.sensor_id} 1-sec agg at {self.timestamp}: avg={self.avg}"


class SensorAggregated1Min(models.Model):
    """
    1-minute aggregated sensor data.
    Retention: 1 year.
    """
    sensor_id = models.IntegerField(db_index=True)
    timestamp = models.DateTimeField(db_index=True, help_text="Aggregation window start time (minute precision)")
    avg = models.FloatField(help_text="Average value")
    min = models.FloatField(help_text="Minimum value")
    max = models.FloatField(help_text="Maximum value")
    std = models.FloatField(null=True, blank=True, help_text="Standard deviation")
    count = models.IntegerField(help_text="Number of readings in aggregation")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'sensor_aggregated_1min'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['sensor_id', '-timestamp']),
            models.Index(fields=['timestamp']),
        ]
        unique_together = [['sensor_id', 'timestamp']]
        verbose_name = '1-Minute Aggregation'
        verbose_name_plural = '1-Minute Aggregations'

    def __str__(self):
        return f"Sensor {self.sensor_id} 1-min agg at {self.timestamp}: avg={self.avg}"


class SensorAggregated1Hour(models.Model):
    """
    1-hour aggregated sensor data.
    Retention: Forever.
    """
    sensor_id = models.IntegerField(db_index=True)
    timestamp = models.DateTimeField(db_index=True, help_text="Aggregation window start time (hour precision)")
    avg = models.FloatField(help_text="Average value")
    min = models.FloatField(help_text="Minimum value")
    max = models.FloatField(help_text="Maximum value")
    std = models.FloatField(null=True, blank=True, help_text="Standard deviation")
    count = models.IntegerField(help_text="Number of readings in aggregation")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'sensor_aggregated_1hour'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['sensor_id', '-timestamp']),
            models.Index(fields=['timestamp']),
        ]
        unique_together = [['sensor_id', 'timestamp']]
        verbose_name = '1-Hour Aggregation'
        verbose_name_plural = '1-Hour Aggregations'

    def __str__(self):
        return f"Sensor {self.sensor_id} 1-hour agg at {self.timestamp}: avg={self.avg}"


class Anomaly(models.Model):
    """
    Detected anomalies in sensor data.
    """
    ANOMALY_TYPES = [
        ('spike', 'Spike'),
        ('dropout', 'Dropout'),
        ('out_of_range', 'Out of Range'),
    ]

    SEVERITY_LEVELS = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]

    sensor_id = models.IntegerField(db_index=True)
    timestamp = models.DateTimeField(db_index=True, help_text="When anomaly occurred")
    anomaly_type = models.CharField(max_length=20, choices=ANOMALY_TYPES)
    severity = models.CharField(max_length=10, choices=SEVERITY_LEVELS)
    value = models.FloatField(help_text="Value that triggered anomaly")
    expected_range_min = models.FloatField(null=True, blank=True)
    expected_range_max = models.FloatField(null=True, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    acknowledged = models.BooleanField(default=False)

    class Meta:
        db_table = 'anomalies'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['sensor_id', '-timestamp']),
            models.Index(fields=['timestamp']),
            models.Index(fields=['severity', '-timestamp']),
        ]
        verbose_name = 'Anomaly'
        verbose_name_plural = 'Anomalies'

    def __str__(self):
        return f"Anomaly: Sensor {self.sensor_id} - {self.anomaly_type} ({self.severity}) at {self.timestamp}"
