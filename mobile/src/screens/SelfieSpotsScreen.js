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
const PAD = SPACE.xl;

export default function SelfieSpotsScreen({ tokens, onBack }) {
  const [spots, setSpots] = useState([]);
  const [selfieOpen, setSelfieOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('locating');
  const [uploadingId, setUploadingId] = useState(null);
  const [previewModal, setPreviewModal] = useState(null);
  const [selectedSpotId, setSelectedSpotId] = useState(null);
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
      setGpsStatus('error');
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
.spot-pin{width:32px;height:32px;border-radius:50%;background:#ec4899;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);}
.spot-pin.done{background:#10b981;}
.user-dot{width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 0 6px rgba(59,130,246,0.25);}
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
  var icon=L.divIcon({html:d,className:'',iconSize:[32,32],iconAnchor:[16,16]});
  var m=L.marker([sp.lat,sp.lng],{icon:icon}).addTo(map);
  L.circle([sp.lat,sp.lng],{color:sp.completed?'#10b981':'#ec4899',fillColor:sp.completed?'#10b981':'#ec4899',fillOpacity:0.10,radius:sp.radius,weight:1.5}).addTo(map);
  m.on('click',function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'SPOT',id:sp.id}));});
});
window.updateUserLocation=function(lat,lng){
  if(!userMarker){
    var u=document.createElement('div');u.className='user-dot';
    userMarker=L.marker([lat,lng],{icon:L.divIcon({html:u,className:'',iconSize:[16,16],iconAnchor:[8,8]})}).addTo(map);
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
      Alert.alert('Challenges Closed', 'Selfie challenges are currently closed by the organizers.');
      return;
    }
    if (!userLocation) {
      Alert.alert('GPS Required', 'Waiting for GPS. Enable location services.');
      return;
    }
    const dist = getHaversineDistanceMeters(userLocation.latitude, userLocation.longitude, spot.latitude, spot.longitude);
    if (dist != null && dist > spot.radius_meters) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      Alert.alert('Too Far', `You are ${Math.round(dist)}m away. Move within ${spot.radius_meters}m of "${spot.name}".`);
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera Required', 'Allow camera access.');
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
        Alert.alert('Failed', data.error || 'Outside geofence.');
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('🎉 Verified!', data.message || `+${data.points_awarded} points!`);
      fetchSpots();
    } catch {
      Alert.alert('Error', 'Upload failed. Check connection.');
    } finally {
      setUploadingId(null);
    }
  };

  const completedCount = spots.filter((s) => s.completed).length;

  const getDistance = (spot) => {
    if (!userLocation) return null;
    return getHaversineDistanceMeters(userLocation.latitude, userLocation.longitude, spot.latitude, spot.longitude);
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={['#0F172A', COLORS.brand]} style={s.header}>
        <View style={s.headerBlob1} />
        <View style={s.headerBlob2} />
        <View style={s.topbar}>
          <TouchableOpacity onPress={onBack} style={s.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Selfie Spots</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.statsCard}>
          <View style={s.statsColumn}>
            <Text style={s.statsVal}>{completedCount}/{spots.length}</Text>
            <Text style={s.statsLbl}>Completed</Text>
          </View>
          <View style={s.statsDivider} />
          <View style={s.statsColumn}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {gpsStatus === 'ready' && <PulsingDot color={COLORS.success} size={7} />}
              {gpsStatus === 'locating' && <ActivityIndicator size="small" color="#fff" />}
              {gpsStatus === 'denied' && <Ionicons name="location-outline" size={14} color={COLORS.error} />}
              <Text style={s.statsGps}>
                {gpsStatus === 'ready' ? 'GPS Active' : gpsStatus === 'locating' ? 'Locating...' : 'GPS Off'}
              </Text>
            </View>
            <Text style={s.statsLbl}>Geofence Radar</Text>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={s.centerWrap}>
          <ActivityIndicator color={COLORS.brand} size="large" />
          <Text style={s.loadingText}>Locating campus selfie spots...</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* MAP */}
          {spots.length > 0 && (
            <View style={s.mapWrapper}>
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
              <View style={s.mapHint}>
                <Ionicons name="map-outline" size={11} color="#fff" />
                <Text style={s.mapHintText}>Tap a pin to see details</Text>
              </View>
            </View>
          )}

          {/* POPUP CARD */}
          {selectedSpot && (
            <View style={s.popupCard}>
              <View style={s.popupHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.popupTitle}>{selectedSpot.name}</Text>
                  {!!selectedSpot.description && (
                    <Text style={s.popupDesc} numberOfLines={2}>{selectedSpot.description}</Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => setSelectedSpotId(null)} style={s.popupClose}>
                  <Ionicons name="close-circle" size={24} color={COLORS.textTer} />
                </TouchableOpacity>
              </View>

              <View style={s.popupInfoRow}>
                {selectedSpot.sample_photo_url && (
                  <Image source={{ uri: fixMediaUrl(selectedSpot.sample_photo_url) }} style={s.popupPhoto} resizeMode="cover" />
                )}
                <View style={s.popupInfoCol}>
                  <View style={s.popupBadge}>
                    <Ionicons name="medal" size={13} color="#d97706" />
                    <Text style={s.popupBadgeText}>+{selectedSpot.points} pts</Text>
                  </View>
                  {(() => {
                    const d = getDistance(selectedSpot);
                    const inside = d != null && d <= selectedSpot.radius_meters;
                    return (
                      <View style={[s.popupDistBadge, inside ? { backgroundColor: COLORS.successLight } : null]}>
                        <Ionicons name={inside ? 'checkmark-circle' : 'navigate-circle'} size={13} color={inside ? COLORS.success : COLORS.brand} />
                        <Text style={[s.popupDistText, inside ? { color: COLORS.success } : null]}>
                          {d != null ? (inside ? `In Range (${Math.round(d)}m)` : formatDistance(d)) : 'Measuring...'}
                        </Text>
                      </View>
                    );
                  })()}
                  <Text style={s.popupRadius}>Geofence: {selectedSpot.radius_meters}m radius</Text>
                </View>
              </View>

              <View style={s.popupActions}>
                <TouchableOpacity
                  style={s.popupDirBtn}
                  onPress={() => setDirectionsUrl(`https://www.google.com/maps/dir/?api=1&destination=${selectedSpot.latitude},${selectedSpot.longitude}&travelmode=walking`)}
                >
                  <Ionicons name="navigate" size={15} color={COLORS.brand} />
                  <Text style={s.popupDirBtnText}>Directions</Text>
                </TouchableOpacity>

                {!selectedSpot.completed ? (
                  <TouchableOpacity
                    style={s.popupCaptureBtn}
                    onPress={() => handleTakeSelfie(selectedSpot)}
                    disabled={uploadingId === selectedSpot.id}
                  >
                    <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} style={s.popupCaptureGrad}>
                      {uploadingId === selectedSpot.id ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Ionicons name="camera" size={15} color="#fff" />
                          <Text style={s.popupCaptureText}>Take Selfie</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <View style={s.popupDoneBtn}>
                    <Ionicons name="checkmark-done" size={15} color={COLORS.success} />
                    <Text style={s.popupDoneText}>Completed</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* SCROLLABLE LIST */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: PAD, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSpots(); }} tintColor={COLORS.brand} />}
          >
            {spots.length === 0 ? (
              <View style={s.centerWrap}>
                <Ionicons name="camera-outline" size={48} color={COLORS.textTer} />
                <Text style={s.emptyTitle}>No Selfie Spots Active</Text>
              </View>
            ) : (
              <>
                <Text style={s.sectionHeader}>Campus Challenges</Text>
                <Text style={s.sectionSub}>Walk to each spot, verify inside the geofence, snap a selfie, and earn points!</Text>

                {spots.map((spot, index) => {
                  const distance = getDistance(spot);
                  const isInside = distance != null && distance <= spot.radius_meters;
                  const isUploading = uploadingId === spot.id;
                  const btnGradient = isInside ? [COLORS.brand, COLORS.brandDark] : ['#94a3b8', '#64748b'];

                  return (
                    <View key={spot.id} style={[s.spotCard, spot.completed && s.spotCardCompleted]}>
                      <View style={s.cardTopRow}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={s.spotName}>{spot.name}</Text>
                            {spot.completed && (
                              <View style={s.completedPill}>
                                <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                                <Text style={s.completedPillText}>Unlocked</Text>
                              </View>
                            )}
                          </View>
                          {!!spot.description && <Text style={s.spotDesc}>{spot.description}</Text>}
                        </View>
                        <View style={s.pointsBadge}>
                          <Ionicons name="medal" size={14} color="#d97706" />
                          <Text style={s.pointsText}>+{spot.points} pts</Text>
                        </View>
                      </View>

                      <View style={s.mediaRow}>
                        {spot.sample_photo_url && (
                          <TouchableOpacity activeOpacity={0.85} onPress={() => setPreviewModal({ spotIndex: index, mode: 'sample' })} style={s.thumbnailWrap}>
                            <Image source={{ uri: fixMediaUrl(spot.sample_photo_url) }} style={s.thumbnail} resizeMode="cover" />
                            <View style={s.thumbnailTag}><Text style={s.thumbnailTagText}>Reference</Text></View>
                          </TouchableOpacity>
                        )}
                        {spot.completed && spot.submission?.photo_url && (
                          <TouchableOpacity activeOpacity={0.85} onPress={() => setPreviewModal({ spotIndex: index, mode: 'submission' })} style={[s.thumbnailWrap, { borderColor: COLORS.success }]}>
                            <Image source={{ uri: fixMediaUrl(spot.submission.photo_url) }} style={s.thumbnail} resizeMode="cover" />
                            <View style={[s.thumbnailTag, { backgroundColor: COLORS.success }]}><Text style={s.thumbnailTagText}>Your Selfie</Text></View>
                          </TouchableOpacity>
                        )}
                      </View>

                      <View style={s.radarStrip}>
                        <View style={s.radarLeft}>
                          <Ionicons name={isInside ? 'radio-button-on' : 'navigate-circle-outline'} size={18} color={isInside ? COLORS.success : COLORS.textTer} />
                          <Text style={[s.distanceText, isInside ? { color: COLORS.success, fontWeight: FONT.w8 } : null]}>
                            {distance != null ? (isInside ? `In Range (${Math.round(distance)}m)` : formatDistance(distance)) : 'Calculating...'}
                          </Text>
                        </View>
                        <Text style={s.radiusText}>Radius: {spot.radius_meters}m</Text>
                      </View>

                      <View style={s.actionsRow}>
                        <TouchableOpacity
                          style={s.directionsBtn}
                          activeOpacity={0.8}
                          onPress={() => setDirectionsUrl(`https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}&travelmode=walking`)}
                        >
                          <Ionicons name="navigate-outline" size={16} color={COLORS.brand} />
                          <Text style={s.directionsBtnText}>Directions</Text>
                        </TouchableOpacity>

                        {!spot.completed ? (
                          <TouchableOpacity
                            style={[s.captureBtn, (!isInside || isUploading) ? s.captureBtnDisabled : null]}
                            disabled={!isInside || isUploading}
                            onPress={() => handleTakeSelfie(spot)}
                          >
                            <LinearGradient colors={btnGradient} style={s.captureBtnGrad}>
                              {isUploading ? (
                                <ActivityIndicator color="#fff" size="small" />
                              ) : (
                                <>
                                  <Ionicons name="camera" size={16} color="#fff" />
                                  <Text style={s.captureBtnText}>{isInside ? 'Take Selfie' : 'Get Closer'}</Text>
                                </>
                              )}
                            </LinearGradient>
                          </TouchableOpacity>
                        ) : (
                          <View style={s.completedBtn}>
                            <Ionicons name="checkmark-done" size={16} color={COLORS.success} />
                            <Text style={s.completedBtnText}>Completed</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </ScrollView>
        </View>
      )}

      {/* Lightbox Modal */}
      {previewModal && (
        <Modal transparent animationType="fade" visible={Boolean(previewModal)} onRequestClose={() => setPreviewModal(null)}>
          <View style={s.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setPreviewModal(null)} />
            <View style={s.modalCard}>
              {(() => {
                const spot = spots[previewModal.spotIndex];
                if (!spot) return null;
                const imgUrl = previewModal.mode === 'submission' ? spot.submission?.photo_url : spot.sample_photo_url;
                return (
                  <>
                    <View style={s.modalHeader}>
                      <Text style={s.modalTitle} numberOfLines={1}>{spot.name}</Text>
                      <TouchableOpacity style={s.modalClose} onPress={() => setPreviewModal(null)}>
                        <Ionicons name="close" size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>
                    <Image source={{ uri: fixMediaUrl(imgUrl) }} style={s.modalImage} resizeMode="contain" />
                    <View style={s.modalNavBar}>
                      <TouchableOpacity
                        style={[s.modalNavBtn, previewModal.spotIndex === 0 ? { opacity: 0.3 } : null]}
                        disabled={previewModal.spotIndex === 0}
                        onPress={() => setPreviewModal((p) => ({ ...p, spotIndex: p.spotIndex - 1 }))}
                      >
                        <Ionicons name="chevron-back" size={20} color="#fff" />
                        <Text style={s.modalNavBtnText}>Prev</Text>
                      </TouchableOpacity>
                      {spot.sample_photo_url && spot.submission?.photo_url && (
                        <TouchableOpacity
                          style={s.modalToggleBtn}
                          onPress={() => setPreviewModal((p) => ({ ...p, mode: p.mode === 'sample' ? 'submission' : 'sample' }))}
                        >
                          <Text style={s.modalToggleText}>{previewModal.mode === 'sample' ? 'My Selfie' : 'Reference'}</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[s.modalNavBtn, previewModal.spotIndex === spots.length - 1 ? { opacity: 0.3 } : null]}
                        disabled={previewModal.spotIndex === spots.length - 1}
                        onPress={() => setPreviewModal((p) => ({ ...p, spotIndex: p.spotIndex + 1 }))}
                      >
                        <Text style={s.modalNavBtnText}>Next</Text>
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

      {/* IN-APP DIRECTIONS WEBVIEW MODAL */}
      {directionsUrl && (
        <Modal animationType="slide" visible={Boolean(directionsUrl)} onRequestClose={() => setDirectionsUrl(null)}>
          <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <View style={s.dirTopBar}>
              <TouchableOpacity onPress={() => setDirectionsUrl(null)} style={s.dirBackBtn}>
                <Ionicons name="arrow-back" size={22} color={COLORS.text} />
              </TouchableOpacity>
              <Text style={s.dirTitle}>Walking Directions</Text>
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
  header: { paddingTop: Platform.OS === 'ios' ? 54 : 44, paddingBottom: SPACE.xl, paddingHorizontal: PAD, overflow: 'hidden' },
  headerBlob1: { position: 'absolute', top: -50, right: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.06)' },
  headerBlob2: { position: 'absolute', bottom: -40, left: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(245,158,11,0.08)' },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { fontSize: FONT.xl, fontWeight: FONT.w8, color: '#fff' },
  statsCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: RADIUS.xl, paddingVertical: SPACE.md, paddingHorizontal: SPACE.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  statsColumn: { flex: 1, alignItems: 'center', gap: 2 },
  statsVal: { fontSize: FONT.lg, fontWeight: FONT.w9, color: '#fff' },
  statsGps: { fontSize: FONT.sm, fontWeight: FONT.w8, color: '#fff' },
  statsLbl: { fontSize: 10, fontWeight: FONT.w7, color: 'rgba(255,255,255,0.65)', letterSpacing: 0.5 },
  statsDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },

  mapWrapper: { height: 220, width: '100%', backgroundColor: '#e2e8f0', position: 'relative', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  mapWebView: { flex: 1 },
  mapHint: { position: 'absolute', bottom: 8, alignSelf: 'center', backgroundColor: 'rgba(15,23,42,0.7)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4 },
  mapHintText: { fontSize: 10, color: '#fff', fontWeight: FONT.w7 },

  popupCard: { backgroundColor: '#fff', marginHorizontal: PAD, marginTop: 12, borderRadius: RADIUS.xxl, padding: SPACE.lg, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', ...SHADOW.lg },
  popupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACE.sm },
  popupTitle: { fontSize: FONT.md, fontWeight: FONT.w9, color: COLORS.text },
  popupDesc: { fontSize: FONT.xs, color: COLORS.textSec, marginTop: 2, lineHeight: 16 },
  popupClose: { padding: 2 },
  popupInfoRow: { flexDirection: 'row', gap: SPACE.md, marginBottom: SPACE.md },
  popupPhoto: { width: 64, height: 64, borderRadius: RADIUS.md, backgroundColor: '#e2e8f0' },
  popupInfoCol: { flex: 1, gap: 6, justifyContent: 'center' },
  popupBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, alignSelf: 'flex-start' },
  popupBadgeText: { fontSize: 11, fontWeight: FONT.w9, color: '#d97706' },
  popupDistBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.brandLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, alignSelf: 'flex-start' },
  popupDistText: { fontSize: 11, fontWeight: FONT.w7, color: COLORS.brand },
  popupRadius: { fontSize: 10, color: COLORS.textTer, fontWeight: FONT.w6 },
  popupActions: { flexDirection: 'row', gap: SPACE.sm },
  popupDirBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: SPACE.md, paddingHorizontal: SPACE.lg, borderRadius: RADIUS.xl, backgroundColor: COLORS.brandLight },
  popupDirBtnText: { fontSize: FONT.xs, fontWeight: FONT.w8, color: COLORS.brand },
  popupCaptureBtn: { flex: 1, borderRadius: RADIUS.xl, overflow: 'hidden' },
  popupCaptureGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: SPACE.md },
  popupCaptureText: { fontSize: FONT.xs, fontWeight: FONT.w8, color: '#fff' },
  popupDoneBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.successLight, borderRadius: RADIUS.xl, paddingVertical: SPACE.md },
  popupDoneText: { fontSize: FONT.xs, fontWeight: FONT.w8, color: COLORS.success },

  sectionHeader: { fontSize: FONT.xl, fontWeight: FONT.w9, color: COLORS.brand, marginTop: SPACE.lg },
  sectionSub: { fontSize: FONT.xs, color: COLORS.textSec, marginTop: 4, marginBottom: SPACE.lg, lineHeight: 18 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: PAD * 2, gap: SPACE.md },
  loadingText: { fontSize: FONT.sm, color: COLORS.textSec },
  emptyTitle: { fontSize: FONT.lg, fontWeight: FONT.w8, color: COLORS.text },

  spotCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACE.lg, marginBottom: SPACE.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', ...SHADOW.md },
  spotCardCompleted: { borderColor: 'rgba(16,185,129,0.3)', backgroundColor: '#fafefe' },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACE.sm },
  spotName: { fontSize: FONT.md, fontWeight: FONT.w9, color: COLORS.text },
  spotDesc: { fontSize: FONT.xs, color: COLORS.textSec, marginTop: 4, lineHeight: 18 },
  completedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.successLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  completedPillText: { fontSize: 10, fontWeight: FONT.w8, color: COLORS.success },
  pointsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fef3c7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.full },
  pointsText: { fontSize: 11, fontWeight: FONT.w9, color: '#d97706' },
  mediaRow: { flexDirection: 'row', gap: SPACE.sm, marginVertical: SPACE.md },
  thumbnailWrap: { width: 72, height: 72, borderRadius: RADIUS.md, overflow: 'hidden', borderWidth: 1.5, borderColor: COLORS.border, position: 'relative' },
  thumbnail: { width: '100%', height: '100%' },
  thumbnailTag: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(15,23,42,0.7)', paddingVertical: 2, alignItems: 'center' },
  thumbnailTagText: { fontSize: 8, fontWeight: FONT.w8, color: '#fff' },
  radarStrip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: RADIUS.lg, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, marginBottom: SPACE.md },
  radarLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  distanceText: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.textSec },
  radiusText: { fontSize: 10, fontWeight: FONT.w6, color: COLORS.textTer },
  actionsRow: { flexDirection: 'row', gap: SPACE.sm },
  directionsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: SPACE.md, paddingHorizontal: SPACE.lg, borderRadius: RADIUS.xl, backgroundColor: COLORS.brandLight, borderWidth: 1, borderColor: 'rgba(3,51,182,0.1)' },
  directionsBtnText: { fontSize: FONT.xs, fontWeight: FONT.w8, color: COLORS.brand },
  captureBtn: { flex: 1, borderRadius: RADIUS.xl, overflow: 'hidden' },
  captureBtnDisabled: { opacity: 0.65 },
  captureBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: SPACE.md, paddingHorizontal: SPACE.lg },
  captureBtnText: { fontSize: FONT.xs, fontWeight: FONT.w8, color: '#fff' },
  completedBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.successLight, borderRadius: RADIUS.xl, paddingVertical: SPACE.md },
  completedBtnText: { fontSize: FONT.xs, fontWeight: FONT.w8, color: COLORS.success },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: SPACE.xl },
  modalCard: { width: W - 32, backgroundColor: '#0f172a', borderRadius: RADIUS.xxl, overflow: 'hidden', padding: SPACE.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACE.sm },
  modalTitle: { fontSize: FONT.md, fontWeight: FONT.w8, color: '#fff', flex: 1 },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  modalImage: { width: '100%', height: H * 0.45, backgroundColor: '#1e293b', borderRadius: RADIUS.lg },
  modalNavBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACE.md },
  modalNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' },
  modalNavBtnText: { color: '#fff', fontSize: FONT.xs, fontWeight: FONT.w7 },
  modalToggleBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: COLORS.brand },
  modalToggleText: { color: '#fff', fontSize: 10, fontWeight: FONT.w8 },

  dirTopBar: { paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingBottom: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dirBackBtn: { padding: 4 },
  dirTitle: { fontSize: FONT.md, fontWeight: FONT.w8, color: COLORS.text },
});
