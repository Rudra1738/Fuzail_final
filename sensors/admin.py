from django.contrib import admin
from .models import (
    SensorReading,
    SensorAggregated1Sec,
    SensorAggregated1Min,
    SensorAggregated1Hour,
    Anomaly
)


@admin.register(SensorReading)
class SensorReadingAdmin(admin.ModelAdmin):
    list_display = ['id', 'sensor_id', 'timestamp', 'value', 'created_at']
    list_filter = ['sensor_id', 'timestamp']
    search_fields = ['sensor_id']
    ordering = ['-timestamp']
    readonly_fields = ['created_at']


@admin.register(SensorAggregated1Sec)
class SensorAggregated1SecAdmin(admin.ModelAdmin):
    list_display = ['id', 'sensor_id', 'timestamp', 'avg', 'min', 'max', 'std', 'count']
    list_filter = ['sensor_id', 'timestamp']
    search_fields = ['sensor_id']
    ordering = ['-timestamp']
    readonly_fields = ['created_at']


@admin.register(SensorAggregated1Min)
class SensorAggregated1MinAdmin(admin.ModelAdmin):
    list_display = ['id', 'sensor_id', 'timestamp', 'avg', 'min', 'max', 'std', 'count']
    list_filter = ['sensor_id', 'timestamp']
    search_fields = ['sensor_id']
    ordering = ['-timestamp']
    readonly_fields = ['created_at']


@admin.register(SensorAggregated1Hour)
class SensorAggregated1HourAdmin(admin.ModelAdmin):
    list_display = ['id', 'sensor_id', 'timestamp', 'avg', 'min', 'max', 'std', 'count']
    list_filter = ['sensor_id', 'timestamp']
    search_fields = ['sensor_id']
    ordering = ['-timestamp']
    readonly_fields = ['created_at']


@admin.register(Anomaly)
class AnomalyAdmin(admin.ModelAdmin):
    list_display = ['id', 'sensor_id', 'timestamp', 'anomaly_type', 'severity', 'value', 'acknowledged']
    list_filter = ['sensor_id', 'anomaly_type', 'severity', 'acknowledged', 'timestamp']
    search_fields = ['sensor_id', 'description']
    ordering = ['-timestamp']
    readonly_fields = ['created_at']
    actions = ['mark_acknowledged']

    def mark_acknowledged(self, request, queryset):
        queryset.update(acknowledged=True)
    mark_acknowledged.short_description = "Mark selected anomalies as acknowledged"
