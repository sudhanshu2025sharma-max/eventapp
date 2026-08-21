import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, RefreshControl,
  StyleSheet, Platform, StatusBar, Alert, ActivityIndicator,
  Dimensions, Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, fixMediaUrl } from '../theme';
import { apiFetch } from '../api';
import { getHaversineDistanceMeters, formatDistance } from '../utils/geo';
import { PulsingDot } from '../components';

const { width: W, height: H } = Dimensions.get('window');
const PAD = SPACE.lg;

export default function SelfieSpotsScreen({ tokens, onBack }) {
  const [spots, setSpots] = useState([]);
  const [selfieOpen, setSelfieOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('locating'); // 'locating' | 'ready' | 'denied'
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'in_range' | 'unlocked'
  const [uploadingId, setUploadingId] = useState(null);

  // Floating Popups & Modals
  const [selectedSpotId, setSelectedSpotId] = useState(null);
  const [previewModal, setPreviewModal] = useState(null); // { spotIndex, mode: 'sample' | 'submission' }
  const [directionsUrl, setDirectionsUrl] = useState(null);

  const webViewRef = useRef(null);
  const locSubscriptionRef = useRef(null);
  const locationHistoryRef = useRef([]);

  const fetchSpots = useCallback(async () => {
    try {
      const res = await apiFetch('/photos/selfie-points/');
      if (res.ok) {
        const data = await res.json();
        setSpots(data.points || []);
        if (data.selfie_upload_open !== undefined) {
          setSelfieOpen(data.selfie_upload_open);
        }
      }
    } catch (e) {
      console.log('Error fetching selfie spots:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const smoothLocation = (newCoords) => {
    if (newCoords.accuracy && newCoords.accuracy > 30) return null;
    const history = locationHistoryRef.current;
    history.push({ lat: newCoords.latitude, lng: newCoords.longitude });
    if (history.length > 4) history.shift();
    return {
      latitude: history.reduce((s, p) => s + p.lat, 0) / history.length,
      longitude: history.reduce((s, p) => s + p.lng, 0) / history.length,
      accuracy: newCoords.accuracy,
    };
  };

  const startLocationTracking = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsStatus('denied');
        return;
      }
      const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (initial?.coords) {
        const sm = smoothLocation(initial.coords) || initial.coords;
        setUserLocation(sm);
        setGpsStatus('ready');
      }
      locSubscriptionRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1, timeInterval: 2000 },
        (loc) => {
          if (loc?.coords) {
            const sm = smoothLocation(loc.coords);
            if (sm) {
              setUserLocation(sm);
              setGpsStatus('ready');
              if (webViewRef.current) {
                webViewRef.current.injectJavaScript(
                  `window.updateUserLocation && window.updateUserLocation(${sm.latitude}, ${sm.longitude}); true;`
                );
              }
            }
          }
        }
      );
    } catch (err) {
      setGpsStatus('denied');
    }
  }, []);

  useEffect(() => {
    fetchSpots();
    startLocationTracking();
    return () => {
      if (locSubscriptionRef.current) locSubscriptionRef.current.remove();
    };
  }, [fetchSpots, startLocationTracking]);

  const selectedSpot = useMemo(() => {
    if (!selectedSpotId) return null;
    return spots.find((s) => s.id === selectedSpotId) || null;
  }, [spots, selectedSpotId]);

  const getDistance = (spot) => {
    if (!userLocation) return null;
    return getHaversineDistanceMeters(userLocation.latitude, userLocation.longitude, spot.latitude, spot.longitude);
  };

  const completedCount = spots.filter((s) => s.completed).length;

  // Filtered Spot List
  const displaySpots = useMemo(() => {
    if (filterTab === 'unlocked') return spots.filter((s) => s.completed);
    if (filterTab === 'in_range') {
      return spots.filter((s) => {
        const d = getDistance(s);
        return d != null && d <= s.radius_meters;
      });
    }
    return spots;
  }, [spots, filterTab, userLocation]);

  // Leaflet Map HTML
  const leafletHTML = useMemo(() => {
    const spotsJson = JSON.stringify(
      spots.map((s) => ({
        id: s.id,
        name: s.name,
        lat: s.latitude,
        lng: s.longitude,
        radius: s.radius_meters,
        completed: s.completed,
      }))
    );
    return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
html,body,#map{height:100%;width:100%;margin:0;padding:0;}
.leaflet-control-attribution{display:none!important;}
.spot-pin{
  width:36px;height:36px;border-radius:18px;background:linear-gradient(135deg,#ec4899,#db2777);
  border:3px solid #ffffff;display:flex;align-items:center;justify-content:center;
  font-size:15px;box-shadow:0 6px 14px rgba(236,72,153,0.4);
}
.spot-pin.done{
  background:linear-gradient(135deg,#10b981,#059669);
  box-shadow:0 6px 14px rgba(16,185,129,0.4);
}
.user-dot{
  width:18px;height:18px;border-radius:50%;background:#3b82f6;border:3px solid #fff;
  box-shadow:0 0 0 8px rgba(59,130,246,0.25);
}
</style></head><body>
<div id="map"></div>
<script>
var spots=${spotsJson};
var map=L.map('map',{zoomControl:false,attributionControl:false}).setView([28.5456,77.1923],16);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
var userMarker=null;
spots.forEach(function(sp){
  var d=document.createElement('div');
  d.className='spot-pin'+(sp.completed?' done':'');
  d.textContent=sp.completed?'\\u2713':'\\uD83D\\uDCF8';
  var icon=L.divIcon({html:d,className:'',iconSize:[36,36],iconAnchor:[18,18]});
  var m=L.marker([sp.lat,sp.lng],{icon:icon}).addTo(map);
  L.circle([sp.lat,sp.lng],{color:sp.completed?'#10b981':'#ec4899',fillColor:sp.completed?'#10b981':'#ec4899',fillOpacity:0.12,radius:sp.radius,weight:2}).addTo(map);
  m.on('click',function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'SPOT',id:sp.id}));});
});
window.updateUserLocation=function(lat,lng){
  if(!userMarker){
    var u=document.createElement('div');u.className='user-dot';
    userMarker=L.marker([lat,lng],{icon:L.divIcon({html:u,className:'',iconSize:[18,18],iconAnchor:[9,9]})}).addTo(map);
  }else{userMarker.setLatLng([lat,lng]);}
};
</script></body></html>`;
  }, [spots]);

  const onMapMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'SPOT') {
        setSelectedSpotId(data.id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    } catch {}
  };

  const handleTakeSelfie = async (spot) => {
    if (!selfieOpen) {
      Alert.alert('Challenge Window Closed', 'Selfie challenges are currently closed by conference organizers.');
      return;
    }
    if (!userLocation) {
      Alert.alert('GPS Required', 'Waiting for accurate GPS signal. Please enable high accuracy location.');
      return;
    }
    const dist = getHaversineDistanceMeters(userLocation.latitude, userLocation.longitude, spot.latitude, spot.longitude);
    if (dist != null && dist > spot.radius_meters) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      Alert.alert(
        'Out of Geofence Zone',
        `You are ${Math.round(dist)}m away from "${spot.name}".\n\nPlease step within ${spot.radius_meters}m to unlock and snap your verified selfie.`
      );
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera Required', 'Please allow camera access to take your selfie.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploadingId(spot.id);
    try {
      const form = new FormData();
      form.append('selfie_point_id', spot.id);
      form.append('user_latitude', String(userLocation.latitude));
      form.append('user_longitude', String(userLocation.longitude));
      if (Platform.OS === 'web' && asset.file) {
        form.append('image', asset.file, 'selfie.jpg');
      } else {
        form.append('image', { uri: asset.uri, type: asset.mimeType || 'image/jpeg', name: 'selfie.jpg' });
      }
      const res = await apiFetch('/photos/selfie-upload/', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        Alert.alert('Geofence Verification Failed', data.error || 'Coordinates were outside the spot radius.');
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        '🎉 Quest Completed!',
        data.message || `You unlocked ${spot.name}! +${data.points_awarded || spot.points} points awarded. Submission sent for admin review.`
      );
      fetchSpots();
    } catch {
      Alert.alert('Upload Error', 'Failed to upload selfie. Check your internet connection.');
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* Top Header Card */}
      <LinearGradient colors={['#0F172A', '#0333b6']} style={s.header}>
        <View style={s.topbar}>
          <TouchableOpacity onPress={onBack} style={s.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={s.headerTitle}>Campus Quest Radar</Text>
            <Text style={s.headerSubtitle}>IIT Delhi Photo Challenges</Text>
          </View>
          <TouchableOpacity onPress={fetchSpots} style={s.backBtn}>
            <Ionicons name="reload" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Quest Radar Bar */}
        <View style={s.radarStatusCard}>
          <View style={s.radarStatCol}>
            <Text style={s.radarStatVal}>{completedCount} <Text style={s.radarStatValDim}>/ {spots.length}</Text></Text>
            <Text style={s.radarStatLbl}>Quests Done</Text>
          </View>
          <View style={s.radarDivider} />
          <View style={s.radarStatCol}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {gpsStatus === 'ready' && <PulsingDot color="#10b981" size={7} />}
              {gpsStatus === 'locating' && <ActivityIndicator size="small" color="#fff" />}
              {gpsStatus === 'denied' && <Ionicons name="warning-outline" size={14} color="#ef4444" />}
              <Text style={s.radarGpsText}>
                {gpsStatus === 'ready' ? 'GPS Locked' : gpsStatus === 'locating' ? 'Locating...' : 'GPS Off'}
              </Text>
            </View>
            <Text style={s.radarStatLbl}>Live Geofence</Text>
          </View>
          <View style={s.radarDivider} />
          <View style={s.radarStatCol}>
            <View style={[s.challengePill, selfieOpen ? s.pillOpen : s.pillClosed]}>
              <Text style={[s.challengePillText, selfieOpen ? s.textOpen : s.textClosed]}>
                {selfieOpen ? 'OPEN' : 'CLOSED'}
              </Text>
            </View>
            <Text style={s.radarStatLbl}>Challenge Status</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Main Quest Content */}
      {loading ? (
        <View style={s.centerWrap}>
          <ActivityIndicator color={COLORS.brand} size="large" />
          <Text style={s.loadingText}>Calibrating campus satellite radar...</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>

          {/* Interactive Leaflet Radar Map Viewport */}
          <View style={s.mapViewport}>
            <WebView
              ref={webViewRef}
              originWhitelist={['*']}
              source={{ html: leafletHTML }}
              style={s.mapWebView}
              onMessage={onMapMessage}
              scrollEnabled={false}
              bounces={false}
              javaScriptEnabled={true}
              domStorageEnabled={true}
            />
            <View style={s.mapRadarBadge}>
              <Ionicons name="radio-outline" size={12} color="#fff" />
              <Text style={s.mapRadarBadgeText}>Tap any pin to view challenge route</Text>
            </View>
          </View>

          {/* Floating Selected Spot Drawer Card */}
          {selectedSpot && (
            <View style={s.drawerCard}>
              <View style={s.drawerHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.drawerTitle}>{selectedSpot.name}</Text>
                  {Boolean(selectedSpot.description) && (
                    <Text style={s.drawerDesc} numberOfLines={2}>{selectedSpot.description}</Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => setSelectedSpotId(null)} style={{ padding: 4 }}>
                  <Ionicons name="close-circle" size={24} color={COLORS.textTer} />
                </TouchableOpacity>
              </View>

              <View style={s.drawerRow}>
                {Boolean(selectedSpot.sample_photo_url) && (
                  <Image source={{ uri: fixMediaUrl(selectedSpot.sample_photo_url) }} style={s.drawerThumb} />
                )}
                <View style={s.drawerInfo}>
                  <View style={s.drawerBadgeRow}>
                    <View style={s.ptsPill}>
                      <Ionicons name="medal" size={13} color="#d97706" />
                      <Text style={s.ptsPillText}>+{selectedSpot.points} pts</Text>
                    </View>
                    {(() => {
                      const d = getDistance(selectedSpot);
                      const inside = d != null && d <= selectedSpot.radius_meters;
                      return (
                        <View style={[s.distPill, inside ? s.distPillInside : null]}>
                          <Ionicons name={inside ? 'checkmark-circle' : 'navigate-circle'} size={13} color={inside ? '#059669' : COLORS.brand} />
                          <Text style={[s.distPillText, inside ? s.distPillTextInside : null]}>
                            {d != null ? (inside ? `In Range (${Math.round(d)}m)` : formatDistance(d)) : 'Locating...'}
                          </Text>
                        </View>
                      );
                    })()}
                  </View>
                  <Text style={s.radiusText}>Geofence: Within {selectedSpot.radius_meters}m</Text>
                </View>
              </View>

              <View style={s.drawerActions}>
                <TouchableOpacity
                  style={s.drawerDirBtn}
                  onPress={() => setDirectionsUrl(`https://www.google.com/maps/dir/?api=1&destination=${selectedSpot.latitude},${selectedSpot.longitude}&travelmode=walking`)}
                >
                  <Ionicons name="navigate" size={15} color={COLORS.brand} />
                  <Text style={s.drawerDirBtnText}>Walking Route</Text>
                </TouchableOpacity>

                {!selectedSpot.completed ? (
                  <TouchableOpacity
                    style={s.drawerCaptureBtn}
                    onPress={() => handleTakeSelfie(selectedSpot)}
                    disabled={uploadingId === selectedSpot.id}
                  >
                    <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} style={s.drawerCaptureGrad}>
                      {uploadingId === selectedSpot.id ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Ionicons name="camera" size={15} color="#fff" />
                          <Text style={s.drawerCaptureText}>Take Selfie</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <View style={s.drawerDoneBtn}>
                    <Ionicons name="checkmark-done" size={15} color="#059669" />
                    <Text style={s.drawerDoneText}>Completed</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Filter Chips Bar */}
          <View style={s.filterRow}>
            {[
              { key: 'all', label: `All (${spots.length})` },
              { key: 'in_range', label: 'In Range' },
              { key: 'unlocked', label: `Unlocked (${completedCount})` },
            ].map((t) => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setFilterTab(t.key)}
                style={[s.filterChip, filterTab === t.key ? s.filterChipActive : null]}
              >
                <Text style={[s.filterChipText, filterTab === t.key ? s.filterChipTextActive : null]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Quest Mission Cards Scroller */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSpots(); }} tintColor={COLORS.brand} />}
          >
            {displaySpots.length === 0 ? (
              <View style={s.emptyWrap}>
                <Ionicons name="camera-outline" size={44} color={COLORS.textTer} />
                <Text style={s.emptyTitle}>No matching challenges found</Text>
              </View>
            ) : (
              displaySpots.map((spot, index) => {
                const distance = getDistance(spot);
                const isInside = distance != null && distance <= spot.radius_meters;
                const isUploading = uploadingId === spot.id;
                const progressPct = distance != null ? Math.max(5, Math.min(100, Math.round((spot.radius_meters / Math.max(distance, spot.radius_meters)) * 100))) : 0;

                return (
                  <View key={spot.id} style={[s.questCard, spot.completed ? s.questCardDone : null]}>
                    
                    {/* Top Row */}
                    <View style={s.questTop}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={s.questName}>{spot.name}</Text>
                          {spot.completed && (
                            <View style={s.unlockedBadge}>
                              <Ionicons name="checkmark-circle" size={13} color="#059669" />
                              <Text style={s.unlockedBadgeText}>Completed</Text>
                            </View>
                          )}
                        </View>
                        {Boolean(spot.description) && (
                          <Text style={s.questDesc}>{spot.description}</Text>
                        )}
                      </View>
                      <View style={s.ptsBadgeLarge}>
                        <Ionicons name="medal" size={15} color="#d97706" />
                        <Text style={s.ptsBadgeLargeText}>+{spot.points} pts</Text>
                      </View>
                    </View>

                    {/* Proximity Gauge Bar */}
                    <View style={s.gaugeWrap}>
                      <View style={s.gaugeHeader}>
                        <Text style={[s.gaugeStatusText, isInside ? s.gaugeTextSuccess : null]}>
                          {distance != null ? (isInside ? '🎯 IN GEOFENCE ZONE (Ready to shoot)' : `📍 ${formatDistance(distance)}`) : 'Acquiring GPS...'}
                        </Text>
                        <Text style={s.gaugeRadiusText}>{spot.radius_meters}m zone</Text>
                      </View>
                      <View style={s.gaugeTrack}>
                        <View
                          style={[
                            s.gaugeFill,
                            { width: `${progressPct}%` },
                            isInside ? s.gaugeFillSuccess : null,
                          ]}
                        />
                      </View>
                    </View>

                    {/* Polaroid Comparisons */}
                    <View style={s.polaroidRow}>
                      {Boolean(spot.sample_photo_url) && (
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => setPreviewModal({ spotIndex: index, mode: 'sample' })}
                          style={s.polaroidBox}
                        >
                          <Image source={{ uri: fixMediaUrl(spot.sample_photo_url) }} style={s.polaroidImg} />
                          <View style={s.polaroidTag}><Text style={s.polaroidTagText}>Target Goal</Text></View>
                        </TouchableOpacity>
                      )}

                      {Boolean(spot.completed && spot.submission?.photo_url) && (
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => setPreviewModal({ spotIndex: index, mode: 'submission' })}
                          style={[s.polaroidBox, { borderColor: '#10b981' }]}
                        >
                          <Image source={{ uri: fixMediaUrl(spot.submission.photo_url) }} style={s.polaroidImg} />
                          <View style={[s.polaroidTag, { backgroundColor: '#10b981' }]}><Text style={s.polaroidTagText}>Your Capture</Text></View>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Quest Card Actions */}
                    <View style={s.cardActions}>
                      <TouchableOpacity
                        style={s.dirBtn}
                        onPress={() => setDirectionsUrl(`https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}&travelmode=walking`)}
                      >
                        <Ionicons name="navigate-outline" size={16} color={COLORS.brand} />
                        <Text style={s.dirBtnText}>Directions in Map</Text>
                      </TouchableOpacity>

                      {!spot.completed ? (
                        <TouchableOpacity
                          style={[s.actionCaptureBtn, (!isInside || isUploading) ? s.actionCaptureDisabled : null]}
                          disabled={!isInside || isUploading}
                          onPress={() => handleTakeSelfie(spot)}
                        >
                          <LinearGradient
                            colors={isInside ? ['#ec4899', '#be185d'] : ['#94a3b8', '#64748b']}
                            style={s.actionCaptureGrad}
                          >
                            {isUploading ? (
                              <ActivityIndicator color="#fff" size="small" />
                            ) : (
                              <>
                                <Ionicons name="camera" size={16} color="#fff" />
                                <Text style={s.actionCaptureText}>{isInside ? 'Snap Selfie' : 'Get Closer'}</Text>
                              </>
                            )}
                          </LinearGradient>
                        </TouchableOpacity>
                      ) : (
                        <View style={s.doneCardBtn}>
                          <Ionicons name="checkmark-done-circle" size={18} color="#059669" />
                          <Text style={s.doneCardBtnText}>Completed</Text>
                        </View>
                      )}
                    </View>

                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      )}

      {/* Lightbox Modal with Nav */}
      {previewModal && (
        <Modal transparent animationType="fade" visible={Boolean(previewModal)} onRequestClose={() => setPreviewModal(null)}>
          <View style={s.modalBackdrop}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setPreviewModal(null)} />
            <View style={s.modalFrame}>
              {(() => {
                const spot = spots[previewModal.spotIndex];
                if (!spot) return null;
                const imgUrl = previewModal.mode === 'submission' ? spot.submission?.photo_url : spot.sample_photo_url;
                return (
                  <>
                    <View style={s.modalTop}>
                      <Text style={s.modalTitle} numberOfLines={1}>{spot.name}</Text>
                      <TouchableOpacity style={s.modalClose} onPress={() => setPreviewModal(null)}>
                        <Ionicons name="close" size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>
                    <Image source={{ uri: fixMediaUrl(imgUrl) }} style={s.modalImg} resizeMode="contain" />
                    <View style={s.modalNav}>
                      <TouchableOpacity
                        style={[s.modalNavBtn, previewModal.spotIndex === 0 ? { opacity: 0.3 } : null]}
                        disabled={previewModal.spotIndex === 0}
                        onPress={() => setPreviewModal((p) => ({ ...p, spotIndex: p.spotIndex - 1 }))}
                      >
                        <Ionicons name="chevron-back" size={20} color="#fff" />
                        <Text style={s.modalNavText}>Prev</Text>
                      </TouchableOpacity>
                      {Boolean(spot.sample_photo_url && spot.submission?.photo_url) && (
                        <TouchableOpacity
                          style={s.modalSwitchBtn}
                          onPress={() => setPreviewModal((p) => ({ ...p, mode: p.mode === 'sample' ? 'submission' : 'sample' }))}
                        >
                          <Text style={s.modalSwitchText}>{previewModal.mode === 'sample' ? 'Show My Selfie' : 'Show Target Goal'}</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[s.modalNavBtn, previewModal.spotIndex === spots.length - 1 ? { opacity: 0.3 } : null]}
                        disabled={previewModal.spotIndex === spots.length - 1}
                        onPress={() => setPreviewModal((p) => ({ ...p, spotIndex: p.spotIndex + 1 }))}
                      >
                        <Text style={s.modalNavText}>Next</Text>
                        <Ionicons name="chevron-forward" size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </>
                );
              })()}
            </View>
          </View>
        </Modal>
      )}

      {/* In-App Walking Navigation WebView Modal */}
      {directionsUrl && (
        <Modal animationType="slide" visible={Boolean(directionsUrl)} onRequestClose={() => setDirectionsUrl(null)}>
          <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <View style={s.dirBar}>
              <TouchableOpacity onPress={() => setDirectionsUrl(null)} style={s.dirBack}>
                <Ionicons name="arrow-back" size={22} color={COLORS.text} />
              </TouchableOpacity>
              <Text style={s.dirTitle}>In-App Walking Navigation</Text>
              <View style={{ width: 40 }} />
            </View>
            <WebView source={{ uri: directionsUrl }} startInLoadingState style={{ flex: 1 }} javaScriptEnabled={true} domStorageEnabled={true} />
          </View>
        </Modal>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f9' },
  header: { paddingTop: Platform.OS === 'ios' ? 54 : 44, paddingBottom: SPACE.lg, paddingHorizontal: PAD },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.md },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT.lg, fontWeight: FONT.w9, color: '#fff', letterSpacing: -0.2 },
  headerSubtitle: { fontSize: FONT.xs, color: 'rgba(255,255,255,0.7)', fontWeight: FONT.w6 },

  radarStatusCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: RADIUS.xl,
    paddingVertical: SPACE.md, paddingHorizontal: SPACE.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  radarStatCol: { flex: 1, alignItems: 'center', gap: 2 },
  radarStatVal: { fontSize: FONT.md, fontWeight: FONT.w9, color: '#fff' },
  radarStatValDim: { fontSize: FONT.xs, color: 'rgba(255,255,255,0.6)' },
  radarStatLbl: { fontSize: 9, fontWeight: FONT.w7, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.5 },
  radarGpsText: { fontSize: FONT.xs, fontWeight: FONT.w8, color: '#fff' },
  radarDivider: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.18)' },
  challengePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  pillOpen: { backgroundColor: '#10b981' },
  pillClosed: { backgroundColor: '#ef4444' },
  challengePillText: { fontSize: 9, fontWeight: FONT.w9, color: '#fff' },

  mapViewport: { height: 210, width: '100%', backgroundColor: '#cbd5e1', position: 'relative', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  mapWebView: { flex: 1 },
  mapRadarBadge: {
    position: 'absolute', bottom: 8, alignSelf: 'center',
    backgroundColor: 'rgba(15,23,42,0.85)', paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  mapRadarBadgeText: { fontSize: 10, color: '#fff', fontWeight: FONT.w7 },

  drawerCard: {
    backgroundColor: '#fff', marginHorizontal: PAD, marginTop: 10,
    borderRadius: RADIUS.xl, padding: SPACE.md, ...SHADOW.lg,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
  },
  drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  drawerTitle: { fontSize: FONT.md, fontWeight: FONT.w9, color: COLORS.text },
  drawerDesc: { fontSize: FONT.xs, color: COLORS.textSec, marginTop: 2 },
  drawerRow: { flexDirection: 'row', gap: SPACE.sm, marginVertical: SPACE.sm },
  drawerThumb: { width: 56, height: 56, borderRadius: RADIUS.md, backgroundColor: '#e2e8f0' },
  drawerInfo: { flex: 1, justifyContent: 'center', gap: 4 },
  drawerBadgeRow: { flexDirection: 'row', gap: 6 },
  ptsPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  ptsPillText: { fontSize: 10, fontWeight: FONT.w8, color: '#d97706' },
  distPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.brandLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  distPillInside: { backgroundColor: '#d1fae5' },
  distPillText: { fontSize: 10, fontWeight: FONT.w8, color: COLORS.brand },
  distPillTextInside: { color: '#059669' },
  radiusText: { fontSize: 10, color: COLORS.textTer, fontWeight: FONT.w6 },
  drawerActions: { flexDirection: 'row', gap: SPACE.sm, marginTop: 4 },
  drawerDirBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: SPACE.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.brandLight },
  drawerDirBtnText: { fontSize: FONT.xs, fontWeight: FONT.w8, color: COLORS.brand },
  drawerCaptureBtn: { flex: 1, borderRadius: RADIUS.lg, overflow: 'hidden' },
  drawerCaptureGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10 },
  drawerCaptureText: { fontSize: FONT.xs, fontWeight: FONT.w8, color: '#fff' },
  drawerDoneBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#d1fae5', borderRadius: RADIUS.lg, paddingVertical: 10 },
  drawerDoneText: { fontSize: FONT.xs, fontWeight: FONT.w8, color: '#059669' },

  filterRow: { flexDirection: 'row', gap: SPACE.xs, paddingHorizontal: PAD, marginVertical: SPACE.md },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: '#e2e8f0' },
  filterChipActive: { backgroundColor: COLORS.brand },
  filterChipText: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.textSec },
  filterChipTextActive: { color: '#fff' },

  questCard: {
    backgroundColor: '#fff', borderRadius: RADIUS.xxl, padding: SPACE.lg,
    marginBottom: SPACE.md, borderWidth: 1, borderColor: '#e2e8f0', ...SHADOW.sm,
  },
  questCardDone: { borderColor: '#a7f3d0', backgroundColor: '#fcfdfd' },
  questTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACE.sm },
  questName: { fontSize: FONT.md, fontWeight: FONT.w9, color: COLORS.text },
  questDesc: { fontSize: FONT.xs, color: COLORS.textSec, marginTop: 2, lineHeight: 17 },
  unlockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#d1fae5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.full },
  unlockedBadgeText: { fontSize: 9, fontWeight: FONT.w8, color: '#059669' },
  ptsBadgeLarge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fef3c7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full },
  ptsBadgeLargeText: { fontSize: 11, fontWeight: FONT.w9, color: '#d97706' },

  gaugeWrap: { marginVertical: SPACE.md },
  gaugeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  gaugeStatusText: { fontSize: FONT.xs, fontWeight: FONT.w8, color: COLORS.textSec },
  gaugeTextSuccess: { color: '#059669' },
  gaugeRadiusText: { fontSize: 10, color: COLORS.textTer, fontWeight: FONT.w6 },
  gaugeTrack: { height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
  gaugeFill: { height: '100%', backgroundColor: COLORS.brand, borderRadius: 3 },
  gaugeFillSuccess: { backgroundColor: '#10b981' },

  polaroidRow: { flexDirection: 'row', gap: SPACE.sm, marginBottom: SPACE.md },
  polaroidBox: { width: 72, height: 72, borderRadius: RADIUS.md, overflow: 'hidden', borderWidth: 1.5, borderColor: COLORS.border, position: 'relative' },
  polaroidImg: { width: '100%', height: '100%' },
  polaroidTag: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(15,23,42,0.75)', paddingVertical: 2, alignItems: 'center' },
  polaroidTagText: { fontSize: 8, fontWeight: FONT.w8, color: '#fff' },

  cardActions: { flexDirection: 'row', gap: SPACE.sm },
  dirBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12, paddingHorizontal: SPACE.lg, borderRadius: RADIUS.xl, backgroundColor: COLORS.brandLight },
  dirBtnText: { fontSize: FONT.xs, fontWeight: FONT.w8, color: COLORS.brand },
  actionCaptureBtn: { flex: 1, borderRadius: RADIUS.xl, overflow: 'hidden' },
  actionCaptureDisabled: { opacity: 0.6 },
  actionCaptureGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  actionCaptureText: { fontSize: FONT.xs, fontWeight: FONT.w8, color: '#fff' },
  doneCardBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#d1fae5', borderRadius: RADIUS.xl, paddingVertical: 12 },
  doneCardBtnText: { fontSize: FONT.xs, fontWeight: FONT.w8, color: '#059669' },

  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: PAD * 2, gap: SPACE.md },
  loadingText: { fontSize: FONT.sm, color: COLORS.textSec },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: SPACE.sm },
  emptyTitle: { fontSize: FONT.sm, color: COLORS.textTer, fontWeight: FONT.w6 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center', padding: SPACE.xl },
  modalFrame: { width: W - 32, backgroundColor: '#0f172a', borderRadius: RADIUS.xxl, overflow: 'hidden', padding: SPACE.md },
  modalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACE.sm },
  modalTitle: { fontSize: FONT.md, fontWeight: FONT.w8, color: '#fff', flex: 1 },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  modalImg: { width: '100%', height: H * 0.45, backgroundColor: '#1e293b', borderRadius: RADIUS.lg },
  modalNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACE.md },
  modalNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' },
  modalNavText: { color: '#fff', fontSize: FONT.xs, fontWeight: FONT.w7 },
  modalSwitchBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: COLORS.brand },
  modalSwitchText: { color: '#fff', fontSize: 11, fontWeight: FONT.w8 },

  dirBar: { paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingBottom: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dirBack: { padding: 4 },
  dirTitle: { fontSize: FONT.md, fontWeight: FONT.w8, color: COLORS.text },
});
