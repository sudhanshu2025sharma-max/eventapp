import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Platform, ActivityIndicator, Alert,
  ScrollView, Modal, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { COLORS, FONT, SPACE, RADIUS, API_URL, API_HEADERS } from '../../theme';

function authHeaders(tokens) {
  return { ...API_HEADERS, Authorization: `Bearer ${tokens.access}` };
}

function TopTabs({ tab, setTab }) {
  const tabs = [
    { key: 'checkin', label: 'Check In', icon: 'person-circle-outline' },
    { key: 'meal', label: 'Meal', icon: 'restaurant-outline' },
    { key: 'history', label: 'History', icon: 'list-outline' },
  ];
  return (
    <View style={tt.wrap}>
      {tabs.map(t => (
        <TouchableOpacity
          key={t.key}
          style={[tt.tab, tab === t.key && tt.tabOn]}
          onPress={() => setTab(t.key)}
          activeOpacity={0.85}
        >
          <Ionicons name={t.icon} size={15} color={tab === t.key ? '#fff' : COLORS.textSec} />
          <Text style={[tt.txt, tab === t.key && tt.txtOn]}>{t.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const tt = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 4, marginBottom: SPACE.lg, borderWidth: 1, borderColor: COLORS.border },
  tab: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: SPACE.sm + 2, borderRadius: RADIUS.md },
  tabOn: { backgroundColor: COLORS.brand },
  txt: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.textSec },
  txtOn: { color: '#fff' },
});

function QRScannerModal({ visible, onScan, onClose }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => { if (visible) setScanned(false); }, [visible]);

  const handleBarcode = ({ data }) => {
    if (scanned) return;
    setScanned(true);
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    onScan(data);
  };

  if (!visible) return null;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={qr.header}>
          <TouchableOpacity onPress={onClose} style={qr.closeBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={qr.headerTxt}>Scan QR</Text>
          <View style={{ width: 40 }} />
        </View>

        {!permission?.granted ? (
          <View style={qr.permWrap}>
            <Ionicons name="camera-outline" size={48} color="rgba(255,255,255,0.55)" />
            <Text style={qr.permTxt}>Camera permission required.</Text>
            <TouchableOpacity style={qr.permBtn} onPress={requestPermission}>
              <Text style={qr.permBtnTxt}>Grant Permission</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarcode}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          />
        )}
      </View>
    </Modal>
  );
}
const qr = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 54 : 44, paddingHorizontal: SPACE.xl, paddingBottom: SPACE.md, backgroundColor: 'rgba(0,0,0,0.6)' },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTxt: { color: '#fff', fontSize: FONT.md, fontWeight: FONT.w8 },
  permWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.xxl, gap: SPACE.lg },
  permTxt: { color: 'rgba(255,255,255,0.75)', textAlign: 'center', fontSize: FONT.sm },
  permBtn: { backgroundColor: COLORS.brand, borderRadius: RADIUS.lg, paddingHorizontal: SPACE.xxl, paddingVertical: SPACE.md },
  permBtnTxt: { color: '#fff', fontWeight: FONT.w8 },
});

function SelectMealTypeModal({ visible, onClose, onSelect }) {
  const [customName, setCustomName] = useState('');
  const options = [
    { label: 'Lunch', icon: '🥪' },
    { label: 'Dinner', icon: '🍛' },
    { label: 'High Tea', icon: '☕' },
    { label: 'Breakfast', icon: '🥐' },
  ];

  const handleCustom = () => {
    if (!customName.trim()) return Alert.alert('Required', 'Enter custom meal name');
    onSelect(customName.trim());
    setCustomName('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={sel.overlay}>
        <View style={sel.card}>
          <Text style={sel.title}>Select Meal Service to Open</Text>
          <Text style={sel.sub}>Participants will be able to generate passes for this meal.</Text>

          {options.map((item) => (
            <TouchableOpacity key={item.label} style={sel.optionBtn} onPress={() => onSelect(item.label)}>
              <Text style={{ fontSize: 20 }}>{item.icon}</Text>
              <Text style={sel.optionTxt}>{item.label}</Text>
            </TouchableOpacity>
          ))}

          <View style={sel.customRow}>
            <TextInput
              style={sel.customInput}
              value={customName}
              onChangeText={setCustomName}
              placeholder="Or custom meal name..."
              placeholderTextColor="#94a3b8"
            />
            <TouchableOpacity style={sel.customBtn} onPress={handleCustom}>
              <Text style={sel.customBtnTxt}>Open</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={sel.cancelBtn} onPress={onClose}>
            <Text style={sel.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
const sel = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', backgroundColor: '#fff', borderRadius: RADIUS.xl, padding: 24 },
  title: { fontSize: FONT.lg, fontWeight: FONT.w9, color: COLORS.text },
  sub: { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 4, marginBottom: 16 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: RADIUS.lg, backgroundColor: COLORS.brandLight, marginBottom: 8 },
  optionTxt: { fontSize: FONT.md, fontWeight: FONT.w8, color: COLORS.brand },
  customRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  customInput: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: 14, fontSize: FONT.sm, color: COLORS.text },
  customBtn: { backgroundColor: COLORS.brand, paddingHorizontal: 16, paddingVertical: 12, borderRadius: RADIUS.lg, justifyContent: 'center' },
  customBtnTxt: { color: '#fff', fontWeight: FONT.w8 },
  cancelBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 8 },
  cancelTxt: { color: COLORS.textTer, fontWeight: FONT.w7 },
});

function CreateMealPassModal({ visible, onClose, tokens, onDone }) {
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestReg, setGuestReg] = useState('');
  const [mealType, setMealType] = useState('Lunch');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!guestName.trim()) {
      Alert.alert('Required', 'Guest name is required');
      return;
    }
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`${API_URL}/checkins/meal-pass/create/`, {
        method: 'POST',
        headers: authHeaders(tokens),
        body: JSON.stringify({
          guest_name: guestName.trim(),
          guest_email: guestEmail.trim(),
          guest_phone: guestPhone.trim(),
          guest_reg_no: guestReg.trim(),
          meal_type: mealType,
          date: today,
        }),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('✅ Issued', data.email_sent ? 'QR emailed successfully.' : 'Pass created.');
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
        setGuestName(''); setGuestEmail(''); setGuestPhone(''); setGuestReg('');
        if (onDone) onDone();
        onClose();
      } else {
        Alert.alert('Error', data.error || data.message || 'Failed');
      }
    } catch (e) {
      Alert.alert('Network Error', e.message || 'Failed');
    }
    setLoading(false);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: COLORS.bg, paddingTop: Platform.OS === 'ios' ? 54 : 44 }}>
        <View style={m.header}>
          <TouchableOpacity onPress={onClose} style={m.backBtn}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={m.title}>Issue Guest Pass</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: SPACE.xl, paddingBottom: 140 }}>
          <Text style={m.label}>Meal Type *</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {['Lunch', 'Dinner', 'High Tea', 'Breakfast'].map((mt) => (
              <TouchableOpacity
                key={mt}
                onPress={() => setMealType(mt)}
                style={[m.typeChip, mealType === mt && m.typeChipOn]}
              >
                <Text style={[m.typeTxt, mealType === mt && m.typeTxtOn]}>{mt}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={m.label}>Guest Name *</Text>
          <TextInput
            style={m.input}
            value={guestName}
            onChangeText={setGuestName}
            placeholder="Guest Full Name"
            placeholderTextColor="#94a3b8"
          />

          <Text style={m.label}>Email (QR will be sent)</Text>
          <TextInput
            style={m.input}
            value={guestEmail}
            onChangeText={setGuestEmail}
            placeholder="guest@example.com"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={m.label}>Phone</Text>
          <TextInput
            style={m.input}
            value={guestPhone}
            onChangeText={setGuestPhone}
            placeholder="Phone Number"
            placeholderTextColor="#94a3b8"
            keyboardType="phone-pad"
          />

          <TouchableOpacity style={m.btn} onPress={submit} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={m.btnTxt}>Create + Send QR</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}
const m = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACE.xl, paddingBottom: SPACE.md },
  backBtn: { width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FONT.lg, fontWeight: FONT.w9, color: COLORS.text },
  label: { fontSize: 11, fontWeight: FONT.w8, color: COLORS.textTer, letterSpacing: 1, marginBottom: 6, marginTop: SPACE.md },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, color: COLORS.text, fontSize: FONT.sm },
  btn: { marginTop: SPACE.xl, backgroundColor: COLORS.brand, borderRadius: RADIUS.lg, paddingVertical: SPACE.md + 2, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: FONT.w8, fontSize: FONT.md },
  typeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  typeChipOn: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  typeTxt: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.textSec },
  typeTxtOn: { color: '#fff' },
});

function HistoryTab({ tokens }) {
  const [subTab, setSubTab] = useState('meal');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = subTab === 'meal' ? '/checkins/meal/list/' : '/checkins/list/';
      const res = await fetch(`${API_URL}${endpoint}`, { headers: authHeaders(tokens) });
      const data = await res.json();
      setItems(subTab === 'meal' ? (data.passes || []) : (data.checkins || []));
    } catch {}
    setLoading(false);
  }, [subTab, tokens]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1 }}>
      <View style={tt.wrap}>
        {[{ k: 'meal', l: 'Meal Passes' }, { k: 'checkin', l: 'Check-Ins' }].map(t => (
          <TouchableOpacity key={t.k} style={[tt.tab, subTab === t.k && tt.tabOn]} onPress={() => setSubTab(t.k)} activeOpacity={0.85}>
            <Text style={[tt.txt, subTab === t.k && tt.txtOn]}>{t.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.brand} style={{ marginTop: SPACE.xxl }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 120 }}
          renderItem={({ item }) => (
            <View style={h.row}>
              <View style={h.icon}><Text style={{ fontSize: 18 }}>{subTab === 'meal' ? '🍽️' : '✅'}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={h.name}>{item.user?.name || item.guest_name || '—'}</Text>
                <Text style={h.sub}>
                  {subTab === 'meal' ? `${item.date || ''} · ${item.meal_type || 'meal'}` : (item.user?.registration_id || '')}
                </Text>
              </View>
              <View style={[h.badge, { backgroundColor: item.used ? COLORS.successLight : COLORS.borderLight }]}>
                <Text style={{ color: item.used ? COLORS.success : COLORS.textTer, fontWeight: FONT.w8, fontSize: FONT.xs }}>
                  {item.used ? 'Used' : 'Active'}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={{ color: COLORS.textTer, textAlign: 'center', marginTop: SPACE.xxl }}>No records</Text>}
          refreshing={loading}
          onRefresh={load}
        />
      )}
    </View>
  );
}
const h = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, marginBottom: SPACE.xs },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.brandLight, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: FONT.sm, fontWeight: FONT.w8, color: COLORS.text },
  sub: { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2 },
  badge: { paddingHorizontal: SPACE.sm, paddingVertical: 4, borderRadius: RADIUS.full },
});

export default function CheckInScreen({ tokens, onBack }) {
  const [tab, setTab] = useState('checkin');
  const [regId, setRegId] = useState('');
  const [loading, setLoading] = useState(false);
  const [camVisible, setCamVisible] = useState(false);

  const [mealWin, setMealWin] = useState(null);
  const [issueVisible, setIssueVisible] = useState(false);
  const [selectMealVisible, setSelectMealVisible] = useState(false);

  const loadMealStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/checkins/meal/status/`, { headers: authHeaders(tokens) });
      const data = await res.json();
      if (data?.meal_window) setMealWin(data.meal_window);
    } catch {}
  }, [tokens]);

  useEffect(() => {
    if (tab === 'meal') {
      loadMealStatus();
      const t = setInterval(loadMealStatus, 10000);
      return () => clearInterval(t);
    }
  }, [tab, loadMealStatus]);

  const doCheckin = async (rid) => {
    const reg = (rid || regId).trim().toUpperCase();
    if (!reg) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/checkins/scan/`, { method: 'POST', headers: authHeaders(tokens), body: JSON.stringify({ registration_id: reg }) });
      const data = await res.json();
      Alert.alert(data.success ? '✅ Success' : '❌ Failed', data.message || '');
    } catch (e) {
      Alert.alert('Network Error', e.message || 'Failed');
    }
    setLoading(false);
  };

  const doMealScan = async (raw) => {
    const v = (raw || regId).trim();
    if (!v) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/checkins/meal/scan/`, { method: 'POST', headers: authHeaders(tokens), body: JSON.stringify({ qr_data: v }) });
      const data = await res.json();
      Alert.alert(data.success ? '✅ Verified' : '❌ Not Found', data.message || '');
    } catch (e) {
      Alert.alert('Network Error', e.message || 'Failed');
    }
    setLoading(false);
  };

  const openMealWithSelectedType = async (selectedType) => {
    setSelectMealVisible(false);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/checkins/meal/window/`, {
        method: 'POST',
        headers: authHeaders(tokens),
        body: JSON.stringify({ action: 'open', meal_type: selectedType }),
      });
      const data = await res.json();
      Alert.alert(data.success ? '✅ Service Opened' : '❌ Failed', `Opened dining service for ${selectedType}`);
      await loadMealStatus();
    } catch (e) {
      Alert.alert('Network Error', e.message || 'Failed');
    }
    setLoading(false);
  };

  const closeMealWindow = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/checkins/meal/window/`, {
        method: 'POST',
        headers: authHeaders(tokens),
        body: JSON.stringify({ action: 'close' }),
      });
      const data = await res.json();
      Alert.alert(data.success ? '✅ Service Closed' : '❌ Failed', 'Dining service closed');
      await loadMealStatus();
    } catch (e) {
      Alert.alert('Network Error', e.message || 'Failed');
    }
    setLoading(false);
  };

  const sendMealPush = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/checkins/meal/push/`, {
        method: 'POST',
        headers: authHeaders(tokens),
      });
      const data = await res.json();
      Alert.alert(data.success ? '📢 Sent' : '❌ Failed', data.message || 'Push sent!');
    } catch (e) {
      Alert.alert('Error', 'Failed to broadcast push notification');
    }
    setLoading(false);
  };

  const onScan = async (raw) => {
    setCamVisible(false);
    if (tab === 'checkin') return doCheckin(raw);
    if (tab === 'meal') return doMealScan(raw);
  };

  if (tab === 'history') {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <View style={s.header}>
          <TouchableOpacity onPress={onBack} style={s.backBtn}><Ionicons name="arrow-back" size={22} color={COLORS.text} /></TouchableOpacity>
          <View style={{ flex: 1 }}><Text style={s.title}>Scanner</Text><Text style={s.sub}>Check-in & Meal</Text></View>
        </View>
        <View style={{ padding: SPACE.xl, flex: 1 }}>
          <TopTabs tab={tab} setTab={setTab} />
          <HistoryTab tokens={tokens} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}><Ionicons name="arrow-back" size={22} color={COLORS.text} /></TouchableOpacity>
        <View style={{ flex: 1 }}><Text style={s.title}>Scanner</Text><Text style={s.sub}>Check-in & Meal</Text></View>
      </View>

      <CreateMealPassModal
        visible={issueVisible}
        onClose={() => setIssueVisible(false)}
        tokens={tokens}
        onDone={loadMealStatus}
      />

      <SelectMealTypeModal
        visible={selectMealVisible}
        onClose={() => setSelectMealVisible(false)}
        onSelect={openMealWithSelectedType}
      />

      <ScrollView contentContainerStyle={{ padding: SPACE.xl, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <TopTabs tab={tab} setTab={setTab} />

        {tab === 'meal' && (
          <View style={s.mealCard}>
            <View style={s.mealTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.mealTitle}>Meal Pass Window</Text>
                <Text style={{ fontSize: FONT.xs, color: COLORS.brand, fontWeight: '700', marginTop: 2 }}>
                  Active Service: {mealWin?.meal_type || 'Lunch'}
                </Text>
              </View>
              <View style={[s.pill, { backgroundColor: mealWin?.is_open ? COLORS.successLight : COLORS.borderLight }]}>
                <Text style={{ fontWeight: FONT.w8, color: mealWin?.is_open ? COLORS.success : COLORS.textTer }}>
                  {mealWin?.is_open ? 'OPEN' : 'CLOSED'}
                </Text>
              </View>
            </View>

            <Text style={s.mealSub}>
              {mealWin?.start_time && mealWin?.end_time ? `Scheduled: ${mealWin.start_time}–${mealWin.end_time}` : 'Auto-syncs with conference schedule'}
            </Text>

            <View style={{ flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.md, flexWrap: 'wrap' }}>
              <TouchableOpacity style={[s.smallBtn, { backgroundColor: COLORS.brand }]} onPress={() => setSelectMealVisible(true)} activeOpacity={0.85}>
                <Text style={s.smallBtnTxt}>Open Service...</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.smallBtn, { backgroundColor: COLORS.textSec }]} onPress={closeMealWindow} activeOpacity={0.85}>
                <Text style={s.smallBtnTxt}>Close Service</Text>
              </TouchableOpacity>
              {mealWin?.is_open && (
                <TouchableOpacity style={[s.smallBtn, { backgroundColor: COLORS.accent, flex: 2 }]} onPress={sendMealPush} activeOpacity={0.85}>
                  <Text style={s.smallBtnTxt}>📢 Send Push Notification</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[s.bigBtn, { marginTop: SPACE.md, backgroundColor: COLORS.brandLight, borderWidth: 1, borderColor: COLORS.brand }]}
              onPress={() => setIssueVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={[s.bigBtnTxt, { color: COLORS.brand }]}>Issue Guest Meal Pass</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={s.sectionLabel}>{tab === 'checkin' ? 'REGISTRATION ID' : 'QR PAYLOAD / UUID / REG ID'}</Text>

        <View style={s.inputCard}>
          <View style={s.inputRow}>
            <Ionicons name="id-card-outline" size={18} color={COLORS.textTer} />
            <TextInput
              style={s.mainInput}
              value={regId}
              onChangeText={setRegId}
              placeholder={tab === 'checkin' ? 'ETD-2026-R-001' : 'Paste QR text / UUID'}
              placeholderTextColor={COLORS.textTer}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            {!!regId && (
              <TouchableOpacity onPress={() => setRegId('')}>
                <Ionicons name="close-circle" size={18} color={COLORS.textTer} />
              </TouchableOpacity>
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
            <TouchableOpacity style={s.camBtn} onPress={() => setCamVisible(true)} activeOpacity={0.85}>
              <Ionicons name="qr-code-outline" size={18} color={COLORS.brand} />
              <Text style={s.camBtnTxt}>Scan</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.scanBtn, loading && { opacity: 0.7 }]}
              onPress={() => (tab === 'checkin' ? doCheckin() : doMealScan())}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.scanBtnTxt}>{tab === 'checkin' ? 'Check In' : 'Verify'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <QRScannerModal visible={camVisible} onScan={onScan} onClose={() => setCamVisible(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 54 : 44, paddingBottom: SPACE.md, paddingHorizontal: SPACE.xl, backgroundColor: COLORS.bg, gap: SPACE.md },
  backBtn: { width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  title: { fontSize: FONT.lg, fontWeight: FONT.w9, color: COLORS.text },
  sub: { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2 },
  sectionLabel: { fontSize: 10, fontWeight: FONT.w9, color: COLORS.textTer, letterSpacing: 1.4, marginBottom: SPACE.sm, marginLeft: 4 },
  inputCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACE.lg, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACE.lg, gap: SPACE.md },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, backgroundColor: COLORS.bg, borderRadius: RADIUS.lg, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm + 2, borderWidth: 1, borderColor: COLORS.border },
  mainInput: { flex: 1, fontSize: FONT.md, color: COLORS.text, fontWeight: FONT.w6 },
  camBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, paddingVertical: SPACE.md, paddingHorizontal: SPACE.lg, borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.brand, backgroundColor: COLORS.brandLight },
  camBtnTxt: { fontSize: FONT.sm, fontWeight: FONT.w8, color: COLORS.brand },
  scanBtn: { flex: 1, backgroundColor: COLORS.brand, borderRadius: RADIUS.lg, paddingVertical: SPACE.md, alignItems: 'center', justifyContent: 'center' },
  scanBtnTxt: { color: '#fff', fontSize: FONT.sm, fontWeight: FONT.w9 },
  mealCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACE.lg, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACE.lg },
  mealTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mealTitle: { fontSize: FONT.md, fontWeight: FONT.w9, color: COLORS.text },
  mealSub: { marginTop: SPACE.xs, color: COLORS.textTer, fontSize: FONT.xs, lineHeight: 18 },
  pill: { paddingHorizontal: SPACE.md, paddingVertical: 6, borderRadius: RADIUS.full },
  smallBtn: { flex: 1, paddingVertical: SPACE.md, paddingHorizontal: SPACE.sm, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center', minWidth: 100 },
  smallBtnTxt: { color: '#fff', fontWeight: FONT.w9, fontSize: FONT.xs },
  bigBtn: { borderRadius: RADIUS.lg, paddingVertical: SPACE.md + 2, alignItems: 'center', justifyContent: 'center' },
  bigBtnTxt: { fontWeight: FONT.w9 },
});
