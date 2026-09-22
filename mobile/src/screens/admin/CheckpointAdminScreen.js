import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, StyleSheet,
  Platform, StatusBar, ActivityIndicator, Alert, TextInput, Switch, Dimensions, Modal
} from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, fixMediaUrl } from '../../theme';
import { apiFetch } from '../../api';

const { width: W, height: H } = Dimensions.get('window');
const PAD = SPACE.xl;

export default function CheckpointAdminScreen({ tokens, onBack }) {
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'create'
  const [checkpoints, setCheckpoints] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [globalSettings, setGlobalSettings] = useState({ upload_open: false, selfie_upload_open: true });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formType, setFormType] = useState('selfie'); // 'selfie' | 'sponsor_zone'
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState('10');
  const [radiusMeters, setRadiusMeters] = useState('20');
  const [corridorWidth, setCorridorWidth] = useState('30');
  const [selectedSponsors, setSelectedSponsors] = useState({}); // { id: true }
  const [samplePhoto, setSamplePhoto] = useState(null);

  // Map Coordinates & Picker State
  const [selfieLat, setSelfieLat] = useState('28.5456');
  const [selfieLng, setSelfieLng] = useState('77.1923');
  const [ptALat, setPtALat] = useState('');
  const [ptALng, setPtALng] = useState('');
  const [ptBLat, setPtBLat] = useState('');
  const [ptBLng, setPtBLng] = useState('');
  
  const [showMapModal, setShowMapModal] = useState(false);
  const [tempSelfieCoords, setTempSelfieCoords] = useState({ lat: 28.5456, lng: 77.1923 });
  const [tempPtA, setTempPtA] = useState(null);
  const [tempPtB, setTempPtB] = useState(null);

  const modalWebViewRef = useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cpRes, spRes, cfgRes] = await Promise.all([
        apiFetch('/photos/admin/checkpoints/'),
        apiFetch('/photos/admin/sponsors-flat/'),
        apiFetch('/photos/admin/settings/')
      ]);

      if (cpRes.ok) {
        const cpData = await cpRes.json();
        setCheckpoints(cpData.checkpoints || []);
      }
      if (spRes.ok) {
        const spData = await spRes.json();
        setSponsors(spData.sponsors || []);
      }
      if (cfgRes.ok) {
        const cfgData = await cfgRes.json();
        setGlobalSettings(cfgData);
      }
    } catch (e) {
      console.log('Error fetching admin checkpoint data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Toggle Global Submissions Status
  const handleToggleGlobal = async (key, val) => {
    try {
      const updatedSettings = { ...globalSettings, [key]: val };
      setGlobalSettings(updatedSettings);

      const res = await apiFetch('/photos/admin/settings/', {
        method: 'POST',
        body: JSON.stringify({ [key]: val })
      });

      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert(
          'Config Updated', 
          key === 'selfie_upload_open' 
            ? `Selfie challenge window is now ${val ? 'OPENED' : 'CLOSED'}. Push broadcast triggered.`
            : `General upload window is now ${val ? 'OPENED' : 'CLOSED'}.`
        );
      }
    } catch {
      Alert.alert('Error', 'Failed to update settings.');
    }
  };

  // Toggle Active State
  const handleToggleActive = async (item) => {
    try {
      const res = await apiFetch(`/photos/admin/checkpoints/${item.id}/toggle/`, { method: 'POST' });
      if (res.ok) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        setCheckpoints(prev => prev.map(c => c.id === item.id ? { ...c, is_active: !c.is_active } : c));
      }
    } catch {
      Alert.alert('Error', 'Failed to toggle status.');
    }
  };

  // Delete Checkpoint
  const handleDelete = (item) => {
    Alert.alert('Confirm Delete', `Are you sure you want to permanently delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await apiFetch(`/photos/admin/checkpoints/${item.id}/delete/`, { method: 'DELETE' });
            if (res.ok) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              setCheckpoints(prev => prev.filter(c => c.id !== item.id));
            }
          } catch {
            Alert.alert('Error', 'Deletion failed.');
          }
        }
      }
    ]);
  };

  // Picker Camera/Gallery
  const handlePickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission required', 'Please grant library permissions.');

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!res.canceled && res.assets?.[0]) {
      setSamplePhoto(res.assets[0]);
    }
  };

  // Sponsor selection toggles
  const toggleSponsor = (id) => {
    setSelectedSponsors(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Click handler on map
  const onMapMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'MAP_CLICK') {
        const lat = parseFloat(data.lat);
        const lng = parseFloat(data.lng);

        if (formType === 'selfie') {
          setTempSelfieCoords({ lat, lng });
        } else {
          if (!tempPtA || (tempPtA && tempPtB)) {
            setTempPtA({ lat, lng });
            setTempPtB(null);
          } else {
            setTempPtB({ lat, lng });
          }
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    } catch {}
  };

  // Locate admin coordinates inside the modal
  const locateAdminGps = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return Alert.alert('GPS Required', 'Please grant location permissions.');

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (current?.coords && modalWebViewRef.current) {
        const lat = current.coords.latitude;
        const lng = current.coords.longitude;
        
        if (formType === 'selfie') {
          setTempSelfieCoords({ lat, lng });
        } else {
          setTempPtA({ lat, lng });
          setTempPtB(null);
        }

        modalWebViewRef.current.injectJavaScript(`
          map.setView([${lat}, ${lng}], 18);
          if (userMarker) {
            userMarker.setLatLng([${lat}, ${lng}]);
          } else {
            var u = document.createElement('div'); u.className='user-dot';
            userMarker = L.marker([${lat}, ${lng}], {icon: L.divIcon({html: u, className: '', iconSize: [16,16], iconAnchor: [8,8]})}).addTo(map);
          }
          true;
        `);
      }
    } catch {}
  };

  // Confirm map selections
  const confirmMapSelection = () => {
    if (formType === 'selfie') {
      setSelfieLat(tempSelfieCoords.lat.toFixed(6));
      setSelfieLng(tempSelfieCoords.lng.toFixed(6));
    } else {
      if (tempPtA) {
        setPtALat(tempPtA.lat.toFixed(6));
        setPtALng(tempPtA.lng.toFixed(6));
      }
      if (tempPtB) {
        setPtBLat(tempPtB.lat.toFixed(6));
        setPtBLng(tempPtB.lng.toFixed(6));
      }
    }
    setShowMapModal(false);
  };

  // Open Map with clean temp positions
  const handleOpenMapPicker = () => {
    if (formType === 'selfie') {
      setTempSelfieCoords({ lat: parseFloat(selfieLat) || 28.5456, lng: parseFloat(selfieLng) || 77.1923 });
    } else {
      setTempPtA(ptALat ? { lat: parseFloat(ptALat), lng: parseFloat(ptALng) } : null);
      setTempPtB(ptBLat ? { lat: parseFloat(ptBLat), lng: parseFloat(ptBLng) } : null);
    }
    setShowMapModal(true);
  };

  // Submit creator form
  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Field Required', 'Checkpoint name is required.');
    if (formType === 'selfie' && (!selfieLat || !selfieLng)) {
      return Alert.alert('Coordinates Required', 'Please input or pinpoint selfie coordinates.');
    }
    if (formType === 'sponsor_zone' && (!ptALat || !ptALng || !ptBLat || !ptBLng)) {
      return Alert.alert('Corridor Bounds Required', 'Please pinpoint both Point A and Point B for the corridor.');
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('checkpoint_type', formType);
      form.append('name', name.trim());
      form.append('description', description.trim());
      form.append('points', points);
      form.append('is_active', 'true');

      if (formType === 'selfie') {
        form.append('latitude', selfieLat);
        form.append('longitude', selfieLng);
        form.append('radius_meters', radiusMeters);
      } else {
        form.append('point_a_lat', ptALat);
        form.append('point_a_lng', ptALng);
        form.append('point_b_lat', ptBLat);
        form.append('point_b_lng', ptBLng);
        form.append('corridor_width_meters', corridorWidth);

        // Map sponsors
        const sponsorIds = Object.keys(selectedSponsors).filter(id => selectedSponsors[id]);
        sponsorIds.forEach(id => {
          form.append('sponsors', id);
        });
      }

      if (samplePhoto) {
        form.append('sample_photo', {
          uri: samplePhoto.uri,
          type: samplePhoto.mimeType || 'image/jpeg',
          name: 'sample.jpg'
        });
      }

      const res = await apiFetch('/photos/admin/checkpoints/', {
        method: 'POST',
        body: form
      });

      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert('Checkpoint Saved', 'Checkpoint successfully added.');
        
        // Reset Form
        setName('');
        setDescription('');
        setPtALat('');
        setPtALng('');
        setPtBLat('');
        setPtBLng('');
        setSamplePhoto(null);
        setSelectedSponsors({});
        fetchData();
        setActiveTab('list');
      } else {
        const err = await res.json();
        Alert.alert('Saving Failed', err.error || 'Server rejected creation.');
      }
    } catch {
      Alert.alert('Error', 'Failed to submit form.');
    } finally {
      setSubmitting(false);
    }
  };

  // Map Webview Template
  const leafletHTML = useMemo(() => {
    const isSponsor = formType === 'sponsor_zone';
    
    let aLat = tempPtA ? tempPtA.lat : null;
    let aLng = tempPtA ? tempPtA.lng : null;
    let bLat = tempPtB ? tempPtB.lat : null;
    let bLng = tempPtB ? tempPtB.lng : null;
    
    let selfieL = tempSelfieCoords ? tempSelfieCoords.lat : 28.5456;
    let selfieG = tempSelfieCoords ? tempSelfieCoords.lng : 77.1923;

    return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>
html,body,#map{height:100%;width:100%;margin:0;padding:0;background:#cbd5e1;}
.leaflet-control-attribution{display:none!important;}
.spot-pin{width:28px;height:28px;border-radius:50%;background:#ec4899;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);}
.spot-pin.a{background:#3b82f6;}
.spot-pin.b{background:#f59e0b;}
.user-dot{width:16px;height:16px;border-radius:50%;background:#ef4444;border:3px solid #fff;}
</style></head><body>
<div id="map"></div>
<script>
var map=L.map('map',{zoomControl:false,attributionControl:false}).setView([28.5456,77.1923],17);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);

var activeMarker=null;
var activeCircle=null;
var markerA=null, markerB=null, lineCorridor=null;
var userMarker=null;

// Draw Initial States
if(!${isSponsor}){
  activeMarker=L.marker([${selfieL}, ${selfieG}]).addTo(map);
  activeCircle=L.circle([${selfieL}, ${selfieG}],{color:'#ec4899',weight:1.5,fillOpacity:0.10,radius:${parseInt(radiusMeters) || 20}}).addTo(map);
  map.setView([${selfieL}, ${selfieG}], 17);
} else {
  if(${aLat !== null}){
    var d=document.createElement('div'); d.className='spot-pin a';
    markerA=L.marker([${aLat}, ${aLng}],{icon:L.divIcon({html:d,className:'',iconSize:[28,28],iconAnchor:[14,14]})}).addTo(map);
    map.setView([${aLat}, ${aLng}], 17);
  }
  if(${bLat !== null}){
    var d=document.createElement('div'); d.className='spot-pin b';
    markerB=L.marker([${bLat}, ${bLng}],{icon:L.divIcon({html:d,className:'',iconSize:[28,28],iconAnchor:[14,14]})}).addTo(map);
    lineCorridor=L.polyline([markerA.getLatLng(), markerB.getLatLng()],{color:'#3b82f6',weight:8,opacity:0.6}).addTo(map);
  }
}

map.on('click', function(e){
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type:'MAP_CLICK', lat: e.latlng.lat, lng: e.latlng.lng
  }));
  
  if(!${isSponsor}){
    if(activeMarker) map.removeLayer(activeMarker);
    if(activeCircle) map.removeLayer(activeCircle);
    activeMarker=L.marker(e.latlng).addTo(map);
    activeCircle=L.circle(e.latlng,{color:'#ec4899',weight:1.5,fillOpacity:0.10,radius:${parseInt(radiusMeters) || 20}}).addTo(map);
  } else {
    if(!markerA || (markerA && markerB)){
      if(markerA) map.removeLayer(markerA);
      if(markerB) map.removeLayer(markerB);
      if(lineCorridor) map.removeLayer(lineCorridor);
      var d=document.createElement('div'); d.className='spot-pin a';
      markerA=L.marker(e.latlng,{icon:L.divIcon({html:d,className:'',iconSize:[28,28],iconAnchor:[14,14]})}).addTo(map);
      markerB=null;
    } else {
      var d=document.createElement('div'); d.className='spot-pin b';
      markerB=L.marker(e.latlng,{icon:L.divIcon({html:d,className:'',iconSize:[28,28],iconAnchor:[14,14]})}).addTo(map);
      lineCorridor=L.polyline([markerA.getLatLng(), markerB.getLatLng()],{color:'#3b82f6',weight:8,opacity:0.6}).addTo(map);
    }
  }
});

window.updateUserLocation=function(lat,lng){
  if(!userMarker){
    var u=document.createElement('div');u.className='user-dot';
    userMarker=L.marker([lat,lng],{icon:L.divIcon({html:u,className:'',iconSize:[16,16],iconAnchor:[8,8]})}).addTo(map);
  }else{userMarker.setLatLng([lat,lng]);}
};
<\/script></body></html>`;
  }, [formType, tempPtA, tempPtB, tempSelfieCoords, radiusMeters]);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* Admin header */}
      <LinearGradient colors={[COLORS.brandDeep, COLORS.brand]} style={s.header}>
        <View style={s.topbar}>
          <TouchableOpacity onPress={onBack} style={s.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Checkpoints Admin</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={s.tabRow}>
          <TouchableOpacity style={[s.tabBtn, activeTab === 'list' && s.tabBtnOn]} onPress={() => setActiveTab('list')}>
            <Ionicons name="list" size={16} color={activeTab === 'list' ? '#fff' : 'rgba(255,255,255,0.6)'} />
            <Text style={[s.tabText, activeTab === 'list' && s.tabTextOn]}>Established</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tabBtn, activeTab === 'create' && s.tabBtnOn]} onPress={() => setActiveTab('create')}>
            <Ionicons name="add-circle" size={16} color={activeTab === 'create' ? '#fff' : 'rgba(255,255,255,0.6)'} />
            <Text style={[s.tabText, activeTab === 'create' && s.tabTextOn]}>Create Spot</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading && activeTab === 'list' ? (
        <View style={s.centerWrap}>
          <ActivityIndicator color={COLORS.brand} size="large" />
          <Text style={s.loadingText}>Syncing established checkpoints...</Text>
        </View>
      ) : activeTab === 'list' ? (
        <ScrollView contentContainerStyle={{ padding: PAD, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          
          {/* Global Window Switcher Toggle */}
          <View style={s.settingsCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.settingsTitle}>GPS Challenge Submissions</Text>
              <Text style={s.settingsDesc}>Toggle whether attendees are allowed to check in and submit photos.</Text>
            </View>
            <Switch
              value={globalSettings.selfie_upload_open}
              onValueChange={(val) => handleToggleGlobal('selfie_upload_open', val)}
              thumbColor={Platform.OS === 'android' ? COLORS.brand : '#fff'}
              trackColor={{ false: '#cbd5e1', true: COLORS.success }}
            />
          </View>

          <Text style={s.sectionHeader}>Active Checkpoint Challenges</Text>

          {checkpoints.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name="flag-outline" size={40} color={COLORS.textTer} />
              <Text style={s.emptyTitle}>No checkpoints created yet.</Text>
              <Text style={s.emptySub}>Tap 'Create Spot' to create campus geolocation missions.</Text>
            </View>
          ) : (
            checkpoints.map((item) => (
              <View key={item.id} style={s.cpCard}>
                <View style={s.cpCardTop}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={s.cpName}>{item.name}</Text>
                      <View style={[s.badge, item.checkpoint_type === 'selfie' ? s.badgeSelfie : s.badgeSponsor]}>
                        <Text style={[s.badgeText, item.checkpoint_type === 'selfie' ? s.textSelfie : s.textSponsor]}>
                          {item.checkpoint_type === 'selfie' ? '📸 Selfie' : '🏢 Sponsor Zone'}
                        </Text>
                      </View>
                    </View>
                    {Boolean(item.description) && <Text style={s.cpDesc}>{item.description}</Text>}
                  </View>
                  <Text style={s.cpPoints}>+{item.points} pts</Text>
                </View>

                <Text style={s.cpMeta}>
                  {item.checkpoint_type === 'selfie'
                    ? `GPS Radius: ${item.radius_meters}m`
                    : `Sponsors linked: ${item.sponsors.length} stalls`}
                </Text>

                <View style={s.cpActions}>
                  <TouchableOpacity
                    style={[s.statusBtn, item.is_active ? s.statusBtnActive : s.statusBtnInactive]}
                    onPress={() => handleToggleActive(item)}
                  >
                    <Ionicons name={item.is_active ? 'checkmark-circle' : 'close-circle'} size={14} color="#fff" />
                    <Text style={s.statusBtnText}>{item.is_active ? 'Active' : 'Disabled'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(item)}>
                    <Ionicons name="trash" size={15} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      ) : (
        /* CREATE FORM SCREEN */
        <ScrollView contentContainerStyle={{ padding: PAD, paddingBottom: 150 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          <Text style={s.sectionHeader}>Create Checkpoint</Text>

          {/* Form Switcher */}
          <View style={s.formTypeSelector}>
            <TouchableOpacity style={[s.typeBtnMobile, formType === 'selfie' && s.typeBtnMobileOn]} onPress={() => { setFormType('selfie'); }}>
              <Text style={[s.typeBtnText, formType === 'selfie' && s.typeBtnTextOn]}>📸 Selfie Spot</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.typeBtnMobile, formType === 'sponsor_zone' && s.typeBtnMobileOn]} onPress={() => { setFormType('sponsor_zone'); }}>
              <Text style={[s.typeBtnText, formType === 'sponsor_zone' && s.typeBtnTextOn]}>🏢 Sponsor Zone</Text>
            </TouchableOpacity>
          </View>

          {/* Pinpoint trigger action */}
          <View style={s.formGroup}>
            <Text style={s.formLabel}>COORDINATES MAPPING</Text>
            <TouchableOpacity style={s.openMapBtn} onPress={handleOpenMapPicker}>
              <Ionicons name="map-outline" size={18} color="#fff" />
              <Text style={s.openMapBtnText}>Pinpoint Location on Map</Text>
            </TouchableOpacity>
          </View>

          <View style={s.formGroup}>
            <Text style={s.formLabel}>SPOT NAME *</Text>
            <TextInput style={s.formInput} placeholder="e.g. Foyer Entrance Stall or Central Library Arch" value={name} onChangeText={setName} />
          </View>

          <View style={s.formGroup}>
            <Text style={s.formLabel}>DESCRIPTION / TASK INSTRUCTIONS</Text>
            <TextInput style={s.formInput} placeholder="Posing task details or zone stalls visit guidelines..." value={description} onChangeText={setDescription} multiline />
          </View>

          <View style={s.formGroup}>
            <Text style={s.formLabel}>POINTS AWARDED</Text>
            <TextInput style={s.formInput} keyboardType="numeric" value={points} onChangeText={setPoints} />
          </View>

          {formType === 'selfie' ? (
            <View style={s.formGroup}>
              <Text style={s.formLabel}>MANUAL COORDINATES INPUT</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput style={[s.formInput, { flex: 1 }]} placeholder="Latitude" keyboardType="numeric" value={selfieLat} onChangeText={setSelfieLat} />
                <TextInput style={[s.formInput, { flex: 1 }]} placeholder="Longitude" keyboardType="numeric" value={selfieLng} onChangeText={setSelfieLng} />
              </View>
              <Text style={s.formLabel} style={{ marginTop: 10 }}>GPS RADIAL RANGE (METERS)</Text>
              <TextInput style={s.formInput} keyboardType="numeric" value={radiusMeters} onChangeText={setRadiusMeters} />
            </View>
          ) : (
            <View style={s.formGroup}>
              <Text style={s.formLabel}>CORRIDOR LINE ENDPOINTS COORDINATES</Text>
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <Text style={{ width: 44, color: COLORS.textTer, fontSize: 11, fontWeight: '700' }}>POINT A</Text>
                  <TextInput style={[s.formInput, { flex: 1 }]} placeholder="Lat A" keyboardType="numeric" value={ptALat} onChangeText={setPtALat} />
                  <TextInput style={[s.formInput, { flex: 1 }]} placeholder="Lng A" keyboardType="numeric" value={ptALng} onChangeText={setPtALng} />
                </View>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <Text style={{ width: 44, color: COLORS.textTer, fontSize: 11, fontWeight: '700' }}>POINT B</Text>
                  <TextInput style={[s.formInput, { flex: 1 }]} placeholder="Lat B" keyboardType="numeric" value={ptBLat} onChangeText={setPtBLat} />
                  <TextInput style={[s.formInput, { flex: 1 }]} placeholder="Lng B" keyboardType="numeric" value={ptBLng} onChangeText={setPtBLng} />
                </View>
              </View>
              <Text style={[s.formLabel, { marginTop: 12 }]}>CORRIDOR WIDTH RANGE (METERS)</Text>
              <TextInput style={s.formInput} keyboardType="numeric" value={corridorWidth} onChangeText={setCorridorWidth} />
            </View>
          )}

          {/* Reference Photo Selector */}
          <View style={s.formGroup}>
            <Text style={s.formLabel}>REFERENCE TARGET PHOTO</Text>
            <TouchableOpacity style={s.imgPickerBtn} onPress={handlePickImage}>
              {samplePhoto ? (
                <Image source={{ uri: samplePhoto.uri }} style={s.imgPickerPreview} />
              ) : (
                <View style={s.imgPickerEmpty}>
                  <Ionicons name="camera-outline" size={24} color={COLORS.textTer} />
                  <Text style={s.imgPickerText}>Choose Reference Photo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Link Sponsors Checklist Scrollable Container FIXED TOUCH GESTURES */}
          {formType === 'sponsor_zone' && sponsors.length > 0 && (
            <View style={s.formGroup}>
              <Text style={s.formLabel}>LINK PARTICIPATING SPONSORS</Text>
              <View style={s.sponsorCheckContainer}>
                <ScrollView nestedScrollEnabled={true} showsVerticalScrollIndicator={true} style={{ flex: 1 }}>
                  {sponsors.map((sp) => {
                    const checked = !!selectedSponsors[sp.id];
                    return (
                      <TouchableOpacity key={sp.id} style={s.checkRow} onPress={() => toggleSponsor(sp.id)}>
                        <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={18} color={checked ? COLORS.brand : COLORS.textTer} />
                        <Text style={s.checkText}>{sp.name} {sp.stall_number ? `(${sp.stall_number})` : ''}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          )}

          <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={submitting}>
            <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} style={s.saveGrad}>
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color="#fff" />
                  <Text style={s.saveText}>Save Checkpoint</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

        </ScrollView>
      )}

      {/* FULL SCREEN MAP MODAL PICKER - FIXES SCROLL CONFLICTS */}
      <Modal visible={showMapModal} animationType="slide" onRequestClose={() => setShowMapModal(false)}>
        <View style={{ flex: 1, backgroundColor: '#f0f4f9' }}>
          <View style={s.modalHeaderMap}>
            <TouchableOpacity onPress={() => setShowMapModal(false)} style={s.modalCloseBtn}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={s.modalTitleMap}>
              {formType === 'selfie' ? 'Pinpoint Selfie Spot' : 'Pinpoint Corridor A → B'}
            </Text>
            <TouchableOpacity style={s.gpsBtn} onPress={locateAdminGps}>
              <Ionicons name="crosshairs" size={16} color={COLORS.brand} />
            </TouchableOpacity>
          </View>
          
          <View style={{ flex: 1 }}>
            <WebView
              ref={modalWebViewRef}
              originWhitelist={['*']}
              source={{ html: leafletHTML }}
              onMessage={onMapMessage}
              style={{ flex: 1 }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
            />
          </View>

          <View style={s.modalFooterMap}>
            <Text style={s.modalFooterHint} numberOfLines={1}>
              {formType === 'selfie'
                ? `Position: ${tempSelfieCoords.lat.toFixed(5)}, ${tempSelfieCoords.lng.toFixed(5)}`
                : tempPtA && tempPtB
                  ? `Corridor Set. Tap again to reset.`
                  : tempPtA
                    ? `TAP SECOND LOCATION ON MAP FOR POINT B`
                    : `TAP ON MAP TO PLACE POINT A`}
            </Text>
            <TouchableOpacity 
              style={[s.confirmBtn, formType === 'sponsor_zone' && (!tempPtA || !tempPtB) ? s.confirmBtnDisabled : null]}
              disabled={formType === 'sponsor_zone' && (!tempPtA || !tempPtB)}
              onPress={confirmMapSelection}
            >
              <Text style={s.confirmBtnText}>Confirm Selection</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f9' },
  header: { paddingTop: Platform.OS === 'ios' ? 54 : 44, paddingBottom: SPACE.lg, paddingHorizontal: PAD },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.md },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT.lg, fontWeight: FONT.w9, color: '#fff' },

  tabRow: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.sm },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.10)' },
  tabBtnOn: { backgroundColor: 'rgba(255,255,255,0.22)' },
  tabText: { fontSize: FONT.xs, fontWeight: FONT.w7, color: 'rgba(255,255,255,0.6)' },
  tabTextOn: { color: '#fff', fontWeight: FONT.w8 },

  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: PAD * 2, gap: SPACE.md },
  loadingText: { fontSize: FONT.sm, color: COLORS.textSec },

  settingsCard: { backgroundColor: '#fff', borderRadius: RADIUS.xl, padding: SPACE.lg, flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginBottom: SPACE.xl, ...SHADOW.sm },
  settingsTitle: { fontSize: FONT.sm, fontWeight: FONT.w8, color: COLORS.text },
  settingsDesc: { fontSize: 10, color: COLORS.textTer, marginTop: 2, lineHeight: 14 },

  sectionHeader: { fontSize: FONT.md, fontWeight: FONT.w9, color: COLORS.brand, marginBottom: SPACE.md, textTransform: 'uppercase', letterSpacing: 0.5 },

  cpCard: { backgroundColor: '#fff', borderRadius: RADIUS.xl, padding: SPACE.md, marginBottom: SPACE.sm, borderWidth: 1, borderColor: COLORS.border },
  cpCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACE.sm },
  cpName: { fontSize: FONT.base, fontWeight: FONT.w8, color: COLORS.text },
  cpDesc: { fontSize: FONT.xs, color: COLORS.textSec, marginTop: 4 },
  cpPoints: { fontSize: FONT.base, fontWeight: FONT.w9, color: COLORS.brand },
  cpMeta: { fontSize: 10, color: COLORS.textTer, fontWeight: FONT.w6, marginTop: 6 },
  cpActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACE.md, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: SPACE.md },

  statusBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: RADIUS.full },
  statusBtnActive: { backgroundColor: COLORS.success },
  statusBtnInactive: { backgroundColor: '#94a3b8' },
  statusBtnText: { fontSize: 10, fontWeight: FONT.w8, color: '#fff' },
  deleteBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.errorLight, alignItems: 'center', justifyContent: 'center' },

  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  badgeSelfie: { backgroundColor: 'rgba(236,72,153,0.1)' },
  badgeSponsor: { backgroundColor: 'rgba(59,130,246,0.1)' },
  badgeText: { fontSize: 9, fontWeight: FONT.w9 },
  textSelfie: { color: '#be185d' },
  textSponsor: { color: '#1d4ed8' },

  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: SPACE.sm },
  emptyTitle: { fontSize: FONT.sm, color: COLORS.text, fontWeight: FONT.w8 },
  emptySub: { fontSize: FONT.xs, color: COLORS.textTer, textAlign: 'center' },

  /* Form */
  formTypeSelector: { flexDirection: 'row', gap: SPACE.sm, marginBottom: SPACE.lg },
  typeBtnMobile: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: RADIUS.lg, backgroundColor: '#e2e8f0' },
  typeBtnMobileOn: { backgroundColor: COLORS.brand },
  typeBtnText: { fontSize: FONT.xs, fontWeight: FONT.w8, color: COLORS.textSec },
  typeBtnTextOn: { color: '#fff' },

  formGroup: { marginBottom: SPACE.lg },
  formLabel: { fontSize: 10, fontWeight: FONT.w8, color: COLORS.textTer, letterSpacing: 1, marginBottom: 6 },
  formInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: SPACE.md, fontSize: FONT.sm, backgroundColor: '#fff', color: COLORS.text },

  openMapBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.brand },
  openMapBtnText: { fontSize: FONT.sm, color: '#fff', fontWeight: FONT.w8 },

  imgPickerBtn: { height: 100, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#fff', overflow: 'hidden' },
  imgPickerEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  imgPickerText: { fontSize: FONT.xs, color: COLORS.textTer, fontWeight: FONT.w7 },
  imgPickerPreview: { width: '100%', height: '100%' },

  // Scrollable sponsor list container box
  sponsorCheckContainer: { backgroundColor: '#fff', borderRadius: 12, padding: SPACE.md, borderWidth: 1, borderColor: COLORS.border, height: 160 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingVertical: 6 },
  checkText: { fontSize: FONT.xs, color: COLORS.text, fontWeight: FONT.w6 },

  saveBtn: { borderRadius: 14, overflow: 'hidden', marginTop: SPACE.lg },
  saveGrad: { flexDirection: 'row', alignItems: 'center', justify: 'center', justifyContent: 'center', gap: SPACE.sm, paddingVertical: 14 },
  saveText: { fontSize: FONT.sm, fontWeight: FONT.w8, color: '#fff' },

  /* Modal map */
  modalHeaderMap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: '#fff' },
  modalCloseBtn: { padding: 4 },
  modalTitleMap: { fontSize: FONT.base, fontWeight: FONT.w8, color: COLORS.text },
  gpsBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.brandLight, alignItems: 'center', justifyContent: 'center' },
  
  modalFooterMap: { padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: '#fff', gap: 12 },
  modalFooterHint: { fontSize: FONT.xs, color: COLORS.textTer, fontWeight: FONT.w6, textAlign: 'center' },
  confirmBtn: { paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.brand, alignItems: 'center', justifyContent: 'center' },
  confirmBtnDisabled: { backgroundColor: '#cbd5e1' },
  confirmBtnText: { fontSize: FONT.sm, color: '#fff', fontWeight: FONT.w8 },
});
