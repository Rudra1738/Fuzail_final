import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from datetime import timedelta


class SensorDataConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time sensor data streaming.
    Clients subscribe to this to receive 1-second aggregated data updates.
    """

    async def connect(self):
        """Accept WebSocket connection and add to broadcast group"""
        # Join the sensors broadcast group
        self.room_group_name = 'sensors'

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        # Send initial connection confirmation
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'message': 'Connected to sensor data stream'
        }))

    async def disconnect(self, close_code):
        """Remove from broadcast group on disconnect"""
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        """
        Handle messages from WebSocket client.
        Clients can send subscription preferences or requests for specific data.
        """
        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            if message_type == 'subscribe_sensor':
                # Client wants to subscribe to specific sensor
                sensor_id = data.get('sensor_id')
                await self.send(text_data=json.dumps({
                    'type': 'subscription_confirmed',
                    'sensor_id': sensor_id,
                    'message': f'Subscribed to sensor {sensor_id}'
                }))

            elif message_type == 'get_latest':
                # Client requests latest data for all sensors
                latest_data = await self.get_latest_sensor_data()
                await self.send(text_data=json.dumps({
                    'type': 'latest_data',
                    'data': latest_data
                }))

        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON'
            }))

    async def sensor_update(self, event):
        """
        Receive sensor update from channel layer and send to WebSocket.
        This is called when broadcast_sensor_update is triggered.
        """
        await self.send(text_data=json.dumps(event['data']))

    @database_sync_to_async
    def get_latest_sensor_data(self):
        """Get the most recent data for all 12 sensors"""
        from .models import SensorAggregated1Sec
        from .serializers import SensorAggregated1SecSerializer

        latest_data = []
        cutoff_time = timezone.now() - timedelta(seconds=10)

        for sensor_id in range(1, 13):
            latest = SensorAggregated1Sec.objects.filter(
                sensor_id=sensor_id,
                timestamp__gte=cutoff_time
            ).order_by('-timestamp').first()

            if latest:
                serializer = SensorAggregated1SecSerializer(latest)
                latest_data.append(serializer.data)

        return latest_data


async def broadcast_sensor_update(sensor_id, data):
    """
    Broadcast sensor update to all connected WebSocket clients.
    This function is called from Celery tasks after aggregation.
    """
    from channels.layers import get_channel_layer
    channel_layer = get_channel_layer()

    await channel_layer.group_send(
        'sensors',
        {
            'type': 'sensor_update',
            'data': {
                'type': 'sensor_data',
                'sensor_id': sensor_id,
                'timestamp': data['timestamp'],
                'avg': data['avg'],
                'min': data['min'],
                'max': data['max'],
                'std': data.get('std', 0),
                'count': data.get('count', 0)
            }
        }
    )


async def broadcast_anomaly(anomaly_data):
    """
    Broadcast anomaly alert to all connected WebSocket clients.
    """
    from channels.layers import get_channel_layer
    channel_layer = get_channel_layer()

    await channel_layer.group_send(
        'sensors',
        {
            'type': 'sensor_update',
            'data': {
                'type': 'anomaly_alert',
                'sensor_id': anomaly_data['sensor_id'],
                'timestamp': anomaly_data['timestamp'],
                'anomaly_type': anomaly_data['anomaly_type'],
                'severity': anomaly_data['severity'],
                'value': anomaly_data['value'],
                'description': anomaly_data.get('description', '')
            }
        }
    )
