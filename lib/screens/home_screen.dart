import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:location/location.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  _HomeScreenState createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late final MapController _mapController;
  late final Location _location;
  LatLng? _currentLocation;
  final Set<String> _highlightedStreets = {};
  final String _mapboxToken = 'pk.eyJ1Ijoia2lraXR0ZWxlZSIsImEiOiJja254eDZ5MGUwdmZvMndveTM2ZGlxY202In0.QTDE0VZFKtcWic6eY1q_jA';
  String? _selectedStreetId;

  // Agregar estas variables
  List<LatLng> _selectedStreetPoints = [];
  String _selectedStreetName = '';

  @override
  void initState() {
    super.initState();
    _mapController = MapController();
    _location = Location();
    _getLocation();
  }

  Future<void> _getLocation() async {
    final hasPermission = await _location.hasPermission();
    if (hasPermission == PermissionStatus.denied) {
      await _location.requestPermission();
    }

    final locationData = await _location.getLocation();
    setState(() {
      _currentLocation = LatLng(locationData.latitude!, locationData.longitude!);
    });
  }

  Future<void> _highlightStreet(LatLng point) async {
    try {
      final response = await http.get(
        Uri.parse(
          'https://api.mapbox.com/geocoding/v5/mapbox.places/${point.longitude},${point.latitude}.json?access_token=$_mapboxToken&types=address'
        )
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['features'] != null && data['features'].isNotEmpty) {
          final feature = data['features'][0];
          final streetName = feature['text'];
          
          // Obtener las coordenadas del linestring
          if (feature['geometry'] != null) {
            final List coordinates = feature['geometry']['coordinates'];
            
            setState(() {
              if (_selectedStreetName == streetName) {
                _selectedStreetPoints = [];
                _selectedStreetName = '';
              } else {
                // Convertir las coordenadas correctamente
                _selectedStreetPoints = [
                  LatLng(point.latitude, point.longitude), // Punto inicial (donde se hizo clic)
                  LatLng(coordinates[1], coordinates[0]), // Punto final de la calle
                ];
                _selectedStreetName = streetName;
              }
            });
          }
        }
      }
    } catch (e) {
      print('Error al obtener información de la calle: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Water App Pro'),
      ),
      body: Stack(
        children: [
          _currentLocation == null
              ? const Center(child: CircularProgressIndicator())
              : FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: _currentLocation!,
                    initialZoom: 15.0,
                    onTap: (tapPosition, point) async {
                      await _highlightStreet(point);
                    },
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=$_mapboxToken',
                      additionalOptions: {
                        'accessToken': _mapboxToken,
                        'id': 'mapbox.streets',
                      },
                    ),
                    // Agregar capa de polilíneas
                    PolylineLayer(
                      polylines: [
                        if (_selectedStreetPoints.isNotEmpty)
                          Polyline(
                            points: _selectedStreetPoints,
                            color: Colors.blue,
                            strokeWidth: 4.0,
                          ),
                      ],
                    ),
                    MarkerLayer(
                      markers: [
                        Marker(
                          width: 80.0,
                          height: 80.0,
                          point: _currentLocation!,
                          child: const Icon(
                            Icons.location_on,
                            color: Colors.red,
                            size: 40.0,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
          if (_selectedStreetName.isNotEmpty)
            Positioned(
              top: 10,
              right: 10,
              child: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.1),
                      spreadRadius: 1,
                      blurRadius: 2,
                    ),
                  ],
                ),
                child: Text(
                  'Calle seleccionada: $_selectedStreetName',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}