from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta
from django.db.models import Max, Min
from .models import (
    SensorReading,
    SensorAggregated1Sec,
    SensorAggregated1Min,
    SensorAggregated1Hour,
    Anomaly
)
from .serializers import (
    SensorReadingSerializer,
    SensorReadingBulkCreateSerializer,
    SensorAggregated1SecSerializer,
    SensorAggregated1MinSerializer,
    SensorAggregated1HourSerializer,
    AnomalySerializer,
    SensorListSerializer
)

# ============================================================================
# Sensor metadata derived from actual datasheets
# ============================================================================
SENSOR_METADATA = {
    1:  {"name": "Light Intensity",     "sensor": "BH1750FVI",  "unit": "lx",     "min": 0,      "max": 65535},
    2:  {"name": "Temperature",         "sensor": "BME688",     "unit": "\u00b0C",      "min": -40,    "max": 85},
    3:  {"name": "Humidity",            "sensor": "BME688",     "unit": "%RH",    "min": 0,      "max": 100},
    4:  {"name": "Pressure",            "sensor": "BME688",     "unit": "Pa",     "min": 30000,  "max": 110000},
    5:  {"name": "Gas Resistance",      "sensor": "BME688",     "unit": "\u03a9",     "min": 1000,   "max": 500000},
    6:  {"name": "IAQ Index",           "sensor": "BME688",     "unit": "",       "min": 0,      "max": 500},
    7:  {"name": "CO",                  "sensor": "MiCS-6814",  "unit": "ppm",    "min": 0,      "max": 1000},
    8:  {"name": "NO\u2082",                 "sensor": "MiCS-6814",  "unit": "ppm",    "min": 0,      "max": 10},
    9:  {"name": "NH\u2083",                 "sensor": "MiCS-6814",  "unit": "ppm",    "min": 0,      "max": 300},
    10: {"name": "TVOC",               "sensor": "ZMOD4410",   "unit": "ppb",    "min": 0,      "max": 5000},
    11: {"name": "eCO\u2082",               "sensor": "ZMOD4410",   "unit": "ppm",    "min": 400,    "max": 5000},
    12: {"name": "PM2.5",              "sensor": "SEN5x",      "unit": "\u00b5g/m\u00b3",  "min": 0,      "max": 1000},
}


def _get_csv_data_range():
    """Get the min/max timestamps of data in the 1-sec table for time-cycling."""
    result = SensorAggregated1Sec.objects.aggregate(
        min_ts=Min('timestamp'),
        max_ts=Max('timestamp'),
    )
    return result['min_ts'], result['max_ts']


def _map_to_csv_time(now, csv_min, csv_max):
    """Map current wall-clock time to a position in the CSV dataset using modulo.
    This makes the data cycle continuously so the dashboard always has live data."""
    if csv_min is None or csv_max is None:
        return now, now - timedelta(seconds=60)

    csv_duration = (csv_max - csv_min).total_seconds()
    if csv_duration <= 0:
        return csv_min, csv_min

    # How far into the cycle are we? Use seconds since midnight for natural day mapping.
    seconds_since_midnight = now.hour * 3600 + now.minute * 60 + now.second
    offset = seconds_since_midnight % csv_duration
    mapped_time = csv_min + timedelta(seconds=offset)
    return mapped_time


@api_view(['POST'])
def ingest_sensor_data(request):
    """
    Batch insert sensor readings from Raspberry Pi.
    Expects array of readings: [{"sensor_id": 1, "timestamp": "...", "value": 123.45}, ...]
    """
    if not isinstance(request.data, list):
        return Response(
            {"error": "Expected an array of sensor readings"},
            status=status.HTTP_400_BAD_REQUEST
        )

    serializer = SensorReadingBulkCreateSerializer(data=request.data, many=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    readings = [
        SensorReading(
            sensor_id=item['sensor_id'],
            timestamp=item['timestamp'],
            value=item['value']
        )
        for item in serializer.validated_data
    ]

    try:
        SensorReading.objects.bulk_create(readings, batch_size=500)
        return Response(
            {
                "success": True,
                "count": len(readings),
                "message": f"Successfully inserted {len(readings)} sensor readings"
            },
            status=status.HTTP_201_CREATED
        )
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def get_live_data(request, sensor_id):
    """
    Get the last 60 seconds of sensor data for real-time dashboard.
    Uses time-cycling to replay CSV data as live data.
    """
    if sensor_id < 1 or sensor_id > 12:
        return Response(
            {"error": "sensor_id must be between 1 and 12"},
            status=status.HTTP_400_BAD_REQUEST
        )

    csv_min, csv_max = _get_csv_data_range()
    now = timezone.now()

    if csv_min and csv_max:
        # Map current time to a position in the CSV data
        mapped_now = _map_to_csv_time(now, csv_min, csv_max)
        cutoff_time = mapped_now - timedelta(seconds=60)

        data = SensorAggregated1Sec.objects.filter(
            sensor_id=sensor_id,
            timestamp__gte=cutoff_time,
            timestamp__lte=mapped_now,
        ).order_by('timestamp')
    else:
        # Fallback: use real wall-clock time
        cutoff_time = now - timedelta(seconds=60)
        data = SensorAggregated1Sec.objects.filter(
            sensor_id=sensor_id,
            timestamp__gte=cutoff_time
        ).order_by('timestamp')

    serializer = SensorAggregated1SecSerializer(data, many=True)

    # Get latest value for quick access
    latest = data.last()

    return Response({
        "sensor_id": sensor_id,
        "data": serializer.data,
        "count": len(serializer.data),
        "latest": latest.avg if latest else None,
        "status": "online" if len(serializer.data) > 0 else "offline",
    })


@api_view(['GET'])
def get_historical_data(request, sensor_id):
    """
    Get historical sensor data with automatic aggregation level selection.
    Supports both wall-clock and CSV-relative time ranges.
    """
    if sensor_id < 1 or sensor_id > 12:
        return Response(
            {"error": "sensor_id must be between 1 and 12"},
            status=status.HTTP_400_BAD_REQUEST
        )

    start_time_str = request.query_params.get('start_time')
    end_time_str = request.query_params.get('end_time')
    resolution = request.query_params.get('resolution', 'auto')

    csv_min, csv_max = _get_csv_data_range()

    if not start_time_str or not end_time_str:
        # Default: return last 1 hour of CSV data
        if csv_max:
            end_time = csv_max
            start_time = csv_max - timedelta(hours=1)
        else:
            return Response(
                {"error": "start_time and end_time are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
    else:
        try:
            from django.utils.dateparse import parse_datetime
            start_time = parse_datetime(start_time_str)
            end_time = parse_datetime(end_time_str)

            if not start_time or not end_time:
                raise ValueError("Invalid datetime format")

            # If the requested range is outside CSV data, remap relative to CSV end
            if csv_min and csv_max:
                requested_duration = end_time - start_time
                # Always query relative to the CSV data range
                end_time = csv_max
                start_time = csv_max - requested_duration
        except Exception as e:
            return Response(
                {"error": f"Invalid datetime format: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

    time_range = end_time - start_time

    if resolution == 'auto':
        if time_range <= timedelta(hours=1):
            resolution = '1sec'
        elif time_range <= timedelta(days=1):
            resolution = '1min'
        else:
            resolution = '1hour'

    if resolution == '1sec':
        queryset = SensorAggregated1Sec.objects.filter(
            sensor_id=sensor_id,
            timestamp__gte=start_time,
            timestamp__lte=end_time
        ).order_by('timestamp')
        serializer = SensorAggregated1SecSerializer(queryset, many=True)
    elif resolution == '1min':
        queryset = SensorAggregated1Min.objects.filter(
            sensor_id=sensor_id,
            timestamp__gte=start_time,
            timestamp__lte=end_time
        ).order_by('timestamp')
        serializer = SensorAggregated1MinSerializer(queryset, many=True)
    elif resolution == '1hour':
        queryset = SensorAggregated1Hour.objects.filter(
            sensor_id=sensor_id,
            timestamp__gte=start_time,
            timestamp__lte=end_time
        ).order_by('timestamp')
        serializer = SensorAggregated1HourSerializer(queryset, many=True)
    else:
        return Response(
            {"error": "Invalid resolution. Use 'auto', '1sec', '1min', or '1hour'"},
            status=status.HTTP_400_BAD_REQUEST
        )

    return Response({
        "sensor_id": sensor_id,
        "start_time": start_time,
        "end_time": end_time,
        "resolution": resolution,
        "data": serializer.data,
        "count": len(serializer.data)
    })


@api_view(['GET'])
def get_anomalies(request):
    """
    Get anomalies with optional filtering.
    """
    queryset = Anomaly.objects.all()

    sensor_id = request.query_params.get('sensor_id')
    if sensor_id:
        try:
            sensor_id = int(sensor_id)
            if 1 <= sensor_id <= 12:
                queryset = queryset.filter(sensor_id=sensor_id)
        except ValueError:
            pass

    severity = request.query_params.get('severity')
    if severity and severity in ['low', 'medium', 'high']:
        queryset = queryset.filter(severity=severity)

    start_time_str = request.query_params.get('start_time')
    if start_time_str:
        try:
            from django.utils.dateparse import parse_datetime
            start_time = parse_datetime(start_time_str)
            if start_time:
                queryset = queryset.filter(timestamp__gte=start_time)
        except Exception:
            pass

    limit = request.query_params.get('limit', 100)
    try:
        limit = int(limit)
        if limit > 1000:
            limit = 1000
    except ValueError:
        limit = 100

    queryset = queryset.order_by('-timestamp')[:limit]
    serializer = AnomalySerializer(queryset, many=True)

    # Count unacknowledged
    unack_count = Anomaly.objects.filter(acknowledged=False).count()

    return Response({
        "anomalies": serializer.data,
        "count": len(serializer.data),
        "unacknowledged_count": unack_count,
    })


@api_view(['GET'])
def list_sensors(request):
    """
    Get list of all 12 sensors with metadata, status, and last reading.
    Returns real sensor names, units, and ranges from datasheets.
    """
    sensors_data = []
    csv_min, csv_max = _get_csv_data_range()
    now = timezone.now()

    for sensor_id in range(1, 13):
        meta = SENSOR_METADATA.get(sensor_id, {})

        # Get last reading for this sensor (from 1-sec table for speed)
        last_agg = SensorAggregated1Sec.objects.filter(
            sensor_id=sensor_id
        ).order_by('-timestamp').first()

        # Determine status based on whether we have data
        if last_agg:
            status_str = "online"
            last_value = last_agg.avg
            last_time = last_agg.timestamp
        else:
            last_reading = SensorReading.objects.filter(
                sensor_id=sensor_id
            ).order_by('-timestamp').first()

            if last_reading:
                status_str = "online"
                last_value = last_reading.value
                last_time = last_reading.timestamp
            else:
                status_str = "no_data"
                last_value = None
                last_time = None

        sensors_data.append({
            "sensor_id": sensor_id,
            "name": meta.get("name", f"Sensor {sensor_id}"),
            "sensor_model": meta.get("sensor", "Unknown"),
            "unit": meta.get("unit", ""),
            "range_min": meta.get("min", 0),
            "range_max": meta.get("max", 100),
            "status": status_str,
            "last_reading_time": last_time,
            "last_value": last_value,
        })

    return Response({
        "sensors": sensors_data,
        "count": len(sensors_data)
    })
