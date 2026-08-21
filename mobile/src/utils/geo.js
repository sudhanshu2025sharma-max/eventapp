import { Linking, Platform } from 'react-native';

/**
 * Calculates the great-circle distance between two points on the Earth's surface
 * using the Haversine formula. Returns distance in meters.
 */
export function getHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  
  const R = 6371000; // Radius of the Earth in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Formats a distance in meters into a readable string.
 */
export function formatDistance(meters) {
  if (meters == null || isNaN(meters)) return "Distance unknown";
  if (meters < 1) return "At location";
  if (meters < 1000) return `${Math.round(meters)}m away`;
  return `${(meters / 1000).toFixed(1)} km away`;
}

/**
 * Launches native walking directions to the target coordinates.
 * Falls back safely to a Google Maps search URL.
 */
export function openNativeWalkingDirections(lat, lng, label = 'Selfie Spot') {
  if (lat == null || lng == null) return;
  const latLng = `${lat},${lng}`;
  
  const iosUrl = `maps://app?daddr=${latLng}&dirflg=w`;
  const androidUrl = `https://www.google.com/maps/dir/?api=1&destination=${latLng}&travelmode=walking`;
  const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${latLng}`;

  const url = Platform.OS === 'ios' ? iosUrl : androidUrl;

  Linking.canOpenURL(url)
    .then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(fallbackUrl);
      }
    })
    .catch(() => {
      Linking.openURL(fallbackUrl);
    });
}
