from rest_framework import serializers
from .models import (
    SensorReading,
    SensorAggregated1Sec,
    SensorAggregated1Min,
    SensorAggregated1Hour,
    Anomaly
)


class SensorReadingSerializer(serializers.ModelSerializer):
    """Serializer for raw sensor readings"""

    class Meta:
        model = SensorReading
        fields = ['id', 'sensor_id', 'timestamp', 'value', 'created_at']
        read_only_fields = ['id', 'created_at']


class SensorReadingBulkCreateSerializer(serializers.Serializer):
    """Serializer for bulk creating sensor readings from Raspberry Pi"""
    sensor_id = serializers.IntegerField(min_value=1, max_value=12)
    timestamp = serializers.DateTimeField()
    value = serializers.FloatField()


class SensorAggregated1SecSerializer(serializers.ModelSerializer):
    """Serializer for 1-second aggregated data"""

    class Meta:
        model = SensorAggregated1Sec
        fields = ['id', 'sensor_id', 'timestamp', 'avg', 'min', 'max', 'std', 'count', 'created_at']
        read_only_fields = ['id', 'created_at']


class SensorAggregated1MinSerializer(serializers.ModelSerializer):
    """Serializer for 1-minute aggregated data"""

    class Meta:
        model = SensorAggregated1Min
        fields = ['id', 'sensor_id', 'timestamp', 'avg', 'min', 'max', 'std', 'count', 'created_at']
        read_only_fields = ['id', 'created_at']


class SensorAggregated1HourSerializer(serializers.ModelSerializer):
    """Serializer for 1-hour aggregated data"""

    class Meta:
        model = SensorAggregated1Hour
        fields = ['id', 'sensor_id', 'timestamp', 'avg', 'min', 'max', 'std', 'count', 'created_at']
        read_only_fields = ['id', 'created_at']


class AnomalySerializer(serializers.ModelSerializer):
    """Serializer for anomalies"""

    class Meta:
        model = Anomaly
        fields = [
            'id', 'sensor_id', 'timestamp', 'anomaly_type', 'severity',
            'value', 'expected_range_min', 'expected_range_max',
            'description', 'acknowledged', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class SensorListSerializer(serializers.Serializer):
    """Serializer for sensor metadata list with datasheet specs"""
    sensor_id = serializers.IntegerField()
    name = serializers.CharField()
    sensor_model = serializers.CharField(default="")
    unit = serializers.CharField(default="")
    range_min = serializers.FloatField(default=0)
    range_max = serializers.FloatField(default=100)
    status = serializers.CharField()
    last_reading_time = serializers.DateTimeField(allow_null=True)
    last_value = serializers.FloatField(allow_null=True)
