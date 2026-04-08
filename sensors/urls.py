from django.urls import path
from . import views

urlpatterns = [
    # Data ingestion
    path('ingest/', views.ingest_sensor_data, name='ingest-sensor-data'),

    # Data retrieval
    path('list/', views.list_sensors, name='list-sensors'),
    path('<int:sensor_id>/live/', views.get_live_data, name='get-live-data'),
    path('<int:sensor_id>/history/', views.get_historical_data, name='get-historical-data'),

    # Anomalies
    path('anomalies/', views.get_anomalies, name='get-anomalies'),
]
