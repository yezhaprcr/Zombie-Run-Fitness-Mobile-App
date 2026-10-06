import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Platform } from 'react-native';
import * as Location from 'expo-location';

// Conditionally import react-native-maps for native mobile platforms only
let MapView: any, Polyline: any, Marker: any;
if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Polyline = Maps.Polyline;
  Marker = Maps.Marker;
}

interface Coordinate {
  latitude: number;
  longitude: number;
}

export default function App() {
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>([]);
  const [zombieLocation, setZombieLocation] = useState<Coordinate | null>(null);
  const [isChasing, setIsChasing] = useState<boolean>(false);
  const [zombieSpeed, setZombieSpeed] = useState<'walking' | 'running'>('walking');
  const [distanceToZombie, setDistanceToZombie] = useState<number | null>(null);

  const mapRef = useRef<any>(null);

  // 1. Request Permission & Start Real-time GPS Tracking
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (Platform.OS !== 'web') {
          Alert.alert('Permission Denied', 'Permission to access location was denied');
        }
        return;
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 3,
        },
        (location) => {
          const currentCoord = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          setUserLocation(currentCoord);
        }
      );
    })();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  // 2. Haversine Distance Formula
  const calculateDistance = (coord1: Coordinate, coord2: Coordinate) => {
    const R = 6371e3;
    const lat1 = (coord1.latitude * Math.PI) / 180;
    const lat2 = (coord2.latitude * Math.PI) / 180;
    const deltaLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const deltaLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  };

  // 3. Zombie Movement Simulation Engine
  useEffect(() => {
    if (!isChasing || routeCoordinates.length === 0) return;

    const stepSize = zombieSpeed === 'walking' ? 0.00005 : 0.00012;

    const interval = setInterval(() => {
      setZombieLocation((prev) => {
        if (!prev) return routeCoordinates[0];

        const target = userLocation || routeCoordinates[routeCoordinates.length - 1];
        const latDiff = target.latitude - prev.latitude;
        const lonDiff = target.longitude - prev.longitude;

        if (Math.abs(latDiff) < 0.00001 && Math.abs(lonDiff) < 0.00001) {
          return prev;
        }

        const angle = Math.atan2(latDiff, lonDiff);
        const newZombiePos = {
          latitude: prev.latitude + Math.sin(angle) * stepSize,
          longitude: prev.longitude + Math.cos(angle) * stepSize,
        };

        if (userLocation) {
          const dist = calculateDistance(userLocation, newZombiePos);
          setDistanceToZombie(dist);
        }

        return newZombiePos;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isChasing, zombieSpeed, userLocation, routeCoordinates]);

  const handleMapPress = (e: any) => {
    const { coordinate } = e.nativeEvent;
    if (coordinate) {
      setRouteCoordinates((prev) => [...prev, coordinate]);
    }
  };

  const startChase = () => {
    if (routeCoordinates.length === 0) {
      const msg = 'Tap on the map to plot a route before starting.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Draw a Route First', msg);
      return;
    }
    setZombieLocation(routeCoordinates[0]);
    setIsChasing(true);
  };

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        <View style={styles.webFallbackContainer}>
          <Text style={styles.webFallbackTitle}>🧟 Zombie Run (Web Simulator)</Text>
          <Text style={styles.webFallbackSubtitle}>
            `react-native-maps` requires native mobile devices (iOS/Android) or Expo Go to display interactive maps[cite: 6].
          </Text>
          <Text style={styles.webStatusText}>
            GPS Status: {userLocation ? `Lat: ${userLocation.latitude.toFixed(4)}, Lng: ${userLocation.longitude.toFixed(4)}` : 'Requesting location access...'}
          </Text>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          showsUserLocation={true}
          followsUserLocation={true}
          initialRegion={{
            latitude: userLocation ? userLocation.latitude : 14.5995,
            longitude: userLocation ? userLocation.longitude : 120.9842,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
          onPress={handleMapPress}
        >
          {routeCoordinates.length > 0 && (
            <Polyline coordinates={routeCoordinates} strokeWidth={5} strokeColor="#007AFF" />
          )}

          {routeCoordinates.map((coords, index) => (
            <Marker key={index} coordinate={coords} title={`Waypoint ${index + 1}`} />
          ))}

          {zombieLocation && (
            <Marker
              coordinate={zombieLocation}
              title="Zombie"
              description={distanceToZombie ? `${distanceToZombie}m away!` : 'Chasing...'}
              pinColor="green"
            />
          )}
        </MapView>
      )}

      {/* Control Overlay Dashboard */}
      <View style={styles.overlay}>
        <Text style={styles.titleText}>🧟 Zombie Chase Dashboard</Text>

        {distanceToZombie !== null && (
          <Text style={styles.distanceText}>
            Zombie Distance: <Text style={styles.highlight}>{distanceToZombie} meters</Text>
          </Text>
        )}

        <View style={styles.speedRow}>
          <TouchableOpacity
            style={[styles.speedBtn, zombieSpeed === 'walking' && styles.activeBtn]}
            onPress={() => setZombieSpeed('walking')}
          >
            <Text style={styles.btnText}>Walker (4 km/h)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.speedBtn, zombieSpeed === 'running' && styles.activeBtn]}
            onPress={() => setZombieSpeed('running')}
          >
            <Text style={styles.btnText}>Runner (10 km/h)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, isChasing ? styles.stopBtn : styles.startBtn]}
            onPress={isChasing ? () => setIsChasing(false) : startChase}
          >
            <Text style={styles.btnText}>{isChasing ? 'Pause Chase' : 'Start Chase'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.clearBtn]}
            onPress={() => {
              setRouteCoordinates([]);
              setIsChasing(false);
              setZombieLocation(null);
              setDistanceToZombie(null);
            }}
          >
            <Text style={styles.btnText}>Clear Map</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  map: { width: '100%', height: '100%' },
  webFallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#1e1e1e',
  },
  webFallbackTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  webFallbackSubtitle: { color: '#aaa', fontSize: 14, textAlign: 'center', maxWidth: 450, marginBottom: 16 },
  webStatusText: { color: '#34C759', fontSize: 13 },
  overlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    padding: 16,
    borderRadius: 12,
  },
  titleText: { color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  distanceText: { color: '#fff', fontSize: 15, textAlign: 'center', marginBottom: 12 },
  highlight: { color: '#FF3B30', fontWeight: 'bold', fontSize: 18 },
  speedRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  speedBtn: { flex: 0.48, backgroundColor: '#3A3A3C', padding: 10, borderRadius: 8, alignItems: 'center' },
  activeBtn: { backgroundColor: '#34C759' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn: { flex: 0.48, padding: 12, borderRadius: 8, alignItems: 'center' },
  startBtn: { backgroundColor: '#FF9500' },
  stopBtn: { backgroundColor: '#FF3B30' },
  clearBtn: { backgroundColor: '#8E8E93' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
});