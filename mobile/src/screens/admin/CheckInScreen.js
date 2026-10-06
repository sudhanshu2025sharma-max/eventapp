import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Platform, ActivityIndicator, Alert,
  ScrollView, Modal, FlatList, Image, KeyboardAvoidingView
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

// Manage Kit Modal (For handling Skipped + Remarks)
function ManageKitModal({ visible, onClose, onSave, participant }) {
  const [note, setNote] = useState('');
  
  useEffect(() => {
    if (visible) setNote(participant?.goodies_note || '');
  }, [visible, participant]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={mk.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={mk.card}>
          <Text style={mk.title}>Manage Conference Kit</Text>
          <Text style={mk.sub}>{participant?.name || participant?.first_name}</Text>
          
          <Text style={mk.label}>Remark / Reason</Text>
          <TextInput
            style={mk.input}
            placeholder="e.g. T-shirt size M out of stock, pending bag..."
            placeholderTextColor="#94a3b8"
            value={note}
            onChangeText={setNote}
          />
          
          <View style={mk.btnRow}>
            <TouchableOpacity style={[mk.btn, mk.btnSkip]} onPress={() => onSave('skipped', note)}>
              <Ionicons name="alert-circle" size={18} color="#92400e" />
              <Text style={mk.btnSkipTxt}>Mark Skipped</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[mk.btn, mk.btnIssue]} onPress={() => onSave('received', note)}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={mk.btnIssueTxt}>Issue Kit</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity onPress={onClose} style={mk.cancelBtn}>
            <Text style={mk.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const mk = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: RADIUS.xl, padding: 24 },
  title: { fontSize: FONT.lg, fontWeight: FONT.w9, color: COLORS.text },
  sub: { fontSize: FONT.sm, color: COLORS.textSec, marginBottom: SPACE.lg },
  label: { fontSize: FONT.xs, fontWeight: FONT.w7, color: COLORS.textTer, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACE.md, color: COLORS.text, backgroundColor: COLORS.surface, marginBottom: SPACE.lg },
  btnRow: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: RADIUS.lg },
  btnSkip: { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#f59e0b' },
  btnSkipTxt: { color: '#92400e', fontWeight: FONT.w8, fontSize: FONT.sm },
  btnIssue: { backgroundColor: COLORS.success },
  btnIssueTxt: { color: '#fff', fontWeight: FONT.w8, fontSize: FONT.sm },
  cancelBtn: { marginTop: SPACE.lg, alignItems: 'center' },
  cancelTxt: { color: COLORS.textTer, fontWeight: FONT.w7, fontSize: FONT.sm },
});

function HistoryTab({ tokens, onSelectParticipant }) {
  const [subTab, setSubTab] = useState('checkin');
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
        {[{ k: 'checkin', l: 'Check-Ins' }, { k: 'meal', l: 'Meal Passes' }].map(t => (
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
          renderItem={({ item }) => {
            const isKitReceived = item.goodies_status === 'received';
            const isKitSkipped = item.goodies_status === 'skipped';
            const participantName = item.display_name || item.user?.name || item.guest_name || 'Participant';
            const mealType = item.meal_type || 'Meal';

            return (
              <TouchableOpacity 
                style={h.row} 
                activeOpacity={subTab === 'checkin' ? 0.75 : 1}
                onPress={() => subTab === 'checkin' && onSelectParticipant?.(item)}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={h.name}>{participantName}</Text>
                    {subTab === 'checkin' ? (
                      <View style={[h.badge, { backgroundColor: isKitReceived ? '#d1fae5' : isKitSkipped ? '#fef3c7' : COLORS.borderLight }]}>
                        <Text style={{ color: isKitReceived ? '#059669' : isKitSkipped ? '#d97706' : COLORS.textTer, fontWeight: FONT.w8, fontSize: FONT.xs }}>
                          {isKitReceived ? 'Kit Issued 🎁' : isKitSkipped ? 'Kit Skipped ⚠️' : 'Kit Pending'}
                        </Text>
                      </View>
                    ) : (
                      <View style={[h.badge, { backgroundColor: item.used ? '#d1fae5' : COLORS.borderLight }]}>
                        <Text style={{ color: item.used ? '#059669' : COLORS.textTer, fontWeight: FONT.w8, fontSize: FONT.xs }}>
                          {item.used ? `${mealType} Redeemed 🍽️` : `${mealType} Active`}
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={h.sub}>
                    {subTab === 'meal' ? (
                      `${mealType} Pass · ${item.user?.registration_id || item.user?.email || 'Guest Pass'}`
                    ) : (
                      `${item.user?.registration_id || item.user?.email || 'Registration ID N/A'}`
                    )}
                  </Text>

                  {/* Scanned By Info for Meal Passes */}
                  {subTab === 'meal' && item.used && (
                    <Text style={[h.sub, { color: COLORS.brand, marginTop: 2, fontWeight: '600' }]}>
                      Scanned by: {item.scanned_by || 'Admin'}
                    </Text>
                  )}

                  {/* Show Remarks/Notes if present */}
                  {Boolean(subTab === 'checkin' && item.goodies_note) && (
                    <View style={h.noteBox}>
                      <Ionicons name="chatbox-ellipses-outline" size={12} color="#92400e" />
                      <Text style={h.noteText}>Note: {item.goodies_note}</Text>
                    </View>
                  )}
                </View>
                {subTab === 'checkin' && (
                  <Ionicons name="create-outline" size={16} color={COLORS.brand} style={{ marginLeft: 8 }} />
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={{ color: COLORS.textTer, textAlign: 'center', marginTop: SPACE.xxl }}>No records found</Text>}
          refreshing={loading}
          onRefresh={load}
        />
      )}
    </View>
  );
}
const h = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: SPACE.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, marginBottom: SPACE.xs },
  name: { fontSize: FONT.sm, fontWeight: FONT.w8, color: COLORS.text },
  sub: { fontSize: FONT.xs, color: COLORS.textTer, marginTop: 2 },
  badge: { paddingHorizontal: SPACE.sm, paddingVertical: 4, borderRadius: RADIUS.full },
  noteBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 6, borderWidth: 0.5, borderColor: '#fcd34d' },
  noteText: { fontSize: 11, fontWeight: '600', color: '#92400e', flex: 1 },
});

export default function CheckInScreen({ tokens, onBack }) {
  const [tab, setTab] = useState('checkin');
  const [regId, setRegId] = useState('');
  const [loading, setLoading] = useState(false);
  const [camVisible, setCamVisible] = useState(false);

  const [activeParticipant, setActiveParticipant] = useState(null);
  const [manageKitVisible, setManageKitVisible] = useState(false);

  const [mealWin, setMealWin] = useState(null);

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
      const t = setInterval(loadMealStatus, 5000);
      return () => clearInterval(t);
    }
  }, [tab, loadMealStatus]);

  const doCheckin = async (rid) => {
    const reg = (rid || regId).trim();
    if (!reg) return;
    setLoading(true);
    setActiveParticipant(null);
    try {
      const res = await fetch(`${API_URL}/checkins/scan/`, { method: 'POST', headers: authHeaders(tokens), body: JSON.stringify({ registration_id: reg }) });
      const data = await res.json();
      if (data.success && data.user) {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
        setActiveParticipant({
          user: data.user,
          goodies_status: data.goodies_status || 'pending',
          scanned_at: data.scanned_at,
        });
      } else {
        Alert.alert('❌ Not Found', data.error || data.message || 'Participant not found');
      }
    } catch (e) {
      Alert.alert('Network Error', e.message || 'Failed');
    }
    setLoading(false);
  };

  const handleSaveKit = async (action, note) => {
    setManageKitVisible(false);
    if (!activeParticipant?.user?.id && !activeParticipant?.user?.registration_id) return;
    
    try {
      const reg = activeParticipant.user.registration_id || activeParticipant.user.id;
      const res = await fetch(`${API_URL}/checkins/confirm-goodies/`, {
        method: 'POST',
        headers: authHeaders(tokens),
        body: JSON.stringify({ registration_id: reg, user_id: activeParticipant.user.id, action, note })
      });
      const data = await res.json();
      if (data.success) {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
        setActiveParticipant(p => ({
          ...p,
          goodies_status: action,
          user: {
            ...p.user,
            goodies_note: note
          }
        }));
        Alert.alert('✅ Saved', data.message);
      } else {
        Alert.alert('Error', data.error || 'Could not update kit status');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to update kit status');
    }
  };

  const doMealScan = async (raw) => {
    const v = (raw || regId).trim();
    if (!v) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/checkins/meal/scan/`, { method: 'POST', headers: authHeaders(tokens), body: JSON.stringify({ qr_data: v }) });
      const data = await res.json();
      Alert.alert(data.success ? '✅ Verified' : '❌ Not Found', data.message || '');
      if (data.success) loadMealStatus();
    } catch (e) {
      Alert.alert('Network Error', e.message || 'Failed');
    }
    setLoading(false);
  };

  const onScan = async (raw) => {
    setCamVisible(false);
    if (tab === 'checkin') return doCheckin(raw);
    if (tab === 'meal') return doMealScan(raw);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}><Ionicons name="arrow-back" size={22} color={COLORS.text} /></TouchableOpacity>
        <View style={{ flex: 1 }}><Text style={s.title}>Scanner</Text><Text style={s.sub}>Check-in & Meal</Text></View>
      </View>

      <ManageKitModal 
        visible={manageKitVisible} 
        onClose={() => setManageKitVisible(false)} 
        onSave={handleSaveKit}
        participant={activeParticipant?.user}
      />

      <View style={{ paddingHorizontal: SPACE.xl, paddingTop: SPACE.md, flex: 1 }}>
        <TopTabs tab={tab} setTab={setTab} />

        {tab === 'history' ? (
          <HistoryTab 
            tokens={tokens} 
            onSelectParticipant={(item) => {
              setActiveParticipant({
                user: {
                  ...item.user,
                  goodies_note: item.goodies_note
                },
                goodies_status: item.goodies_status
              });
              setManageKitVisible(true);
            }}
          />
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 140 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {tab === 'meal' && (
              <View style={s.mealCard}>
                <View style={s.mealTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.mealTitle}>{mealWin?.meal_type || 'No Active Meal'}</Text>
                    <Text style={{ fontSize: FONT.xs, color: COLORS.textTer, marginTop: 4 }}>
                      {mealWin?.start_time && mealWin?.end_time ? `${mealWin.start_time} - ${mealWin.end_time}` : 'Waiting for schedule sync...'}
                    </Text>
                  </View>
                  <View style={[s.pill, { backgroundColor: mealWin?.is_open ? COLORS.successLight : COLORS.borderLight }]}>
                    <Text style={{ fontWeight: FONT.w8, color: mealWin?.is_open ? COLORS.success : COLORS.textTer }}>
                      {mealWin?.is_open ? 'OPEN' : 'CLOSED'}
                    </Text>
                  </View>
                </View>

                {/* LIVE SCANNED COUNTER */}
                <View style={s.counterBox}>
                  <Ionicons name="barcode-outline" size={24} color={COLORS.brand} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.counterLabel}>PASSES SCANNED</Text>
                    <Text style={s.counterValue}>{mealWin?.scanned_count || 0}</Text>
                  </View>
                </View>
              </View>
            )}

            <Text style={s.sectionLabel}>{tab === 'checkin' ? 'REGISTRATION ID / EMAIL' : 'QR PAYLOAD / UUID / REG ID'}</Text>

            <View style={s.inputCard}>
              <View style={s.inputRow}>
                <Ionicons name="id-card-outline" size={18} color={COLORS.textTer} />
                <TextInput
                  style={s.mainInput}
                  value={regId}
                  onChangeText={setRegId}
                  placeholder={tab === 'checkin' ? 'ETD-2026-R-001 or email' : 'Paste QR text'}
                  placeholderTextColor={COLORS.textTer}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {!!regId && (
                  <TouchableOpacity onPress={() => { setRegId(''); setActiveParticipant(null); }}>
                    <Ionicons name="close-circle" size={18} color={COLORS.textTer} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
                <TouchableOpacity style={s.camBtn} onPress={() => setCamVisible(true)} activeOpacity={0.85}>
                  <Ionicons name="qr-code-outline" size={18} color={COLORS.brand} />
                  <Text style={s.camBtnTxt}>Scan QR</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.scanBtn, loading && { opacity: 0.7 }]}
                  onPress={() => (tab === 'checkin' ? doCheckin() : doMealScan())}
                  activeOpacity={0.85}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.scanBtnTxt}>{tab === 'checkin' ? 'Check In' : 'Verify Meal'}</Text>}
                </TouchableOpacity>
              </View>
            </View>

            {/* PARTICIPANT CHECK-IN & GOODIES CARD */}
            {tab === 'checkin' && activeParticipant && (
              <View style={pk.card}>
                <View style={pk.headerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={pk.name}>{activeParticipant.user.name}</Text>
                    <Text style={pk.sub}>Reg ID: <Text style={{ fontWeight: '800', color: COLORS.brand }}>{activeParticipant.user.registration_id || 'N/A'}</Text></Text>
                  </View>
                  <View style={[pk.statusPill, { backgroundColor: '#d1fae5' }]}>
                    <Ionicons name="checkmark-circle" size={14} color="#059669" />
                    <Text style={pk.statusText}>CHECKED IN</Text>
                  </View>
                </View>

                <View style={pk.divider} />

                <View style={pk.goodiesRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={pk.goodiesLabel}>CONFERENCE KIT STATUS</Text>
                    <Text style={[pk.goodiesValue, activeParticipant.goodies_status === 'skipped' && { color: '#d97706' }]}>
                      {activeParticipant.goodies_status === 'received' ? '✅ Kit Issued & Verified' : 
                       activeParticipant.goodies_status === 'skipped' ? '⚠️ Kit Skipped / Pending' : '🟡 Not Issued'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={pk.manageBtn}
                    onPress={() => setManageKitVisible(true)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="cog-outline" size={16} color={COLORS.brand} />
                    <Text style={pk.manageBtnText}>Manage</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </View>

      <QRScannerModal visible={camVisible} onScan={onScan} onClose={() => setCamVisible(false)} />
    </View>
  );
}

const pk = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: RADIUS.xl, padding: SPACE.lg, borderWidth: 1.5, borderColor: '#3b82f6', marginTop: SPACE.xs },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  name: { fontSize: FONT.md + 1, fontWeight: FONT.w9, color: COLORS.text },
  sub: { fontSize: FONT.xs, color: COLORS.textSec, marginTop: 2 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  statusText: { fontSize: 10, fontWeight: FONT.w9, color: '#059669' },
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: SPACE.md },
  goodiesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goodiesLabel: { fontSize: 10, fontWeight: FONT.w8, color: COLORS.textTer, letterSpacing: 1 },
  goodiesValue: { fontSize: FONT.xs, fontWeight: FONT.w8, color: COLORS.text, marginTop: 2 },
  manageBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.brandLight, borderWidth: 1, borderColor: COLORS.brand, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.lg },
  manageBtnText: { color: COLORS.brand, fontSize: FONT.xs, fontWeight: FONT.w9 },
});

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
  
  mealCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACE.lg, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACE.lg},
  mealTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  mealTitle: { fontSize: FONT.xl, fontWeight: FONT.w9, color: COLORS.text },
  pill: { paddingHorizontal: SPACE.md, paddingVertical: 6, borderRadius: RADIUS.full },
  counterBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.brandLight, padding: SPACE.lg, borderRadius: RADIUS.lg, marginTop: SPACE.lg, borderWidth: 1, borderColor: 'rgba(3,51,182,0.1)' },
  counterLabel: { fontSize: 10, fontWeight: FONT.w8, color: COLORS.brand, letterSpacing: 1 },
  counterValue: { fontSize: 32, fontWeight: FONT.w9, color: COLORS.brand, marginTop: -4 },
});
