import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  Platform, Image, ActivityIndicator, Alert, Modal, TextInput, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, SHADOW } from '../../theme';
import { apiFetch } from '../../api';

export default function ErrorReportsAdmin({ tokens, onBack }) {
  const [tab, setTab] = useState('tickets'); // 'tickets' | 'system_logs' | 'server_stream'

  // Tickets state
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedImage, setSelectedImage] = useState(null);

  // Edit / Details Modal State
  const [editItem, setEditItem] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('ui_ux');
  const [editStatus, setEditStatus] = useState('new');
  const [editSeverity, setEditSeverity] = useState('medium');
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Create Ticket Modal State (Admin Create CRUD)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCat, setNewCat] = useState('other');
  const [newPhone, setNewPhone] = useState('');
  const [newSev, setNewSev] = useState('medium');
  const [creating, setCreating] = useState(false);

  // System Logs & Health state
  const [systemLogs, setSystemLogs] = useState([]);
  const [serverLogs, setServerLogs] = useState([]);
  const [health, setHealth] = useState(null);
  const [logTimestamp, setLogTimestamp] = useState('');
  const [autoPoll, setAutoPoll] = useState(true);

  // Fetch Tickets
  const fetchReports = useCallback(async () => {
    try {
      const url = statusFilter === 'all'
        ? '/error-reports/admin/list/'
        : `/error-reports/admin/list/?status=${statusFilter}`;
      const res = await apiFetch(url);
      const data = await res.json();
      if (data.success) {
        setReports(data.reports || []);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // Fetch System Logs
  const fetchSystemLogs = useCallback(async () => {
    try {
      const res = await apiFetch('/error-reports/admin/logs/system/');
      const data = await res.json();
      if (data.success) setSystemLogs(data.system_logs || []);
    } catch {}
  }, []);

  // Fetch Server Log Stream & Health
  const fetchServerLogsAndHealth = useCallback(async () => {
    try {
      const [logsRes, healthRes] = await Promise.all([
        apiFetch('/error-reports/admin/logs/server/?lines=100'),
        apiFetch('/error-reports/admin/health/'),
      ]);
      const logsData = await logsRes.json();
      const healthData = await healthRes.json();
      if (logsData.success) {
        setServerLogs(logsData.lines || []);
        setLogTimestamp(logsData.timestamp || '');
      }
      if (healthData.success) {
        setHealth(healthData.health || null);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (tab === 'tickets') fetchReports();
    else if (tab === 'system_logs') fetchSystemLogs();
    else if (tab === 'server_stream') fetchServerLogsAndHealth();
  }, [tab, fetchReports, fetchSystemLogs, fetchServerLogsAndHealth]);

  useEffect(() => {
    if (tab !== 'server_stream' || !autoPoll) return;
    const interval = setInterval(fetchServerLogsAndHealth, 4000);
    return () => clearInterval(interval);
  }, [tab, autoPoll, fetchServerLogsAndHealth]);

  // Open Edit Modal
  const openEditModal = (item) => {
    setEditItem(item);
    setEditTitle(item.title || '');
    setEditCategory(item.category || 'ui_ux');
    setEditStatus(item.status || 'new');
    setEditSeverity(item.severity || 'medium');
    setEditPhone(item.user_phone || '');
    setEditNotes(item.admin_notes || '');
  };

  // Save Edit Changes (CRUD Update)
  const handleSaveEdit = async () => {
    if (!editItem) return;
    setSavingEdit(true);
    try {
      const res = await apiFetch(`/error-reports/admin/${editItem.id}/status/`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editTitle,
          category: editCategory,
          status: editStatus,
          severity: editSeverity,
          user_phone: editPhone,
          admin_notes: editNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditItem(null);
        fetchReports();
      } else {
        Alert.alert('Update Failed', data.error || 'Could not update ticket.');
      }
    } catch {
      Alert.alert('Network Error', 'Could not update ticket.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Admin Create Ticket (CRUD Create)
  const handleCreateTicket = async () => {
    if (!newDesc.trim()) {
      Alert.alert('Missing Description', 'Please provide a ticket description.');
      return;
    }

    setCreating(true);
    try {
      const res = await apiFetch('/error-reports/admin/create/', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle.trim() || newDesc.substring(0, 50),
          description: newDesc.trim(),
          category: newCat,
          severity: newSev,
          user_phone: newPhone.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        setNewTitle('');
        setNewDesc('');
        setNewPhone('');
        fetchReports();
      } else {
        Alert.alert('Create Failed', data.error || 'Could not create ticket.');
      }
    } catch {
      Alert.alert('Network Error', 'Could not create ticket.');
    } finally {
      setCreating(false);
    }
  };

  // Delete Ticket (CRUD Delete)
  const handleDelete = (pk) => {
    Alert.alert('Delete Ticket', 'Permanently remove this error report?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/error-reports/admin/${pk}/delete/`, { method: 'DELETE' });
            fetchReports();
          } catch {
            Alert.alert('Error', 'Could not delete report.');
          }
        },
      },
    ]);
  };

  const handleClearSystemLogs = () => {
    Alert.alert('Clear Logs', 'Delete all captured system exception logs?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch('/error-reports/admin/logs/system/clear/', { method: 'DELETE' });
            fetchSystemLogs();
          } catch {
            Alert.alert('Error', 'Could not clear system logs.');
          }
        },
      },
    ]);
  };

  // Render User Ticket Card
  const renderTicketItem = ({ item }) => (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={s.userName}>{item.user_name}</Text>
          <Text style={s.userEmail}>{item.user_email}</Text>
          {!!item.user_phone && (
            <Text style={{ fontSize: 11, fontWeight: FONT.w7, color: COLORS.brand, marginTop: 1 }}>
              📞 {item.user_phone}
            </Text>
          )}
        </View>
        <View style={[
          s.badge,
          item.status === 'new' && { backgroundColor: '#fee2e2' },
          item.status === 'resolved' && { backgroundColor: '#d1fae5' },
        ]}>
          <Text style={[
            s.badgeText,
            item.status === 'new' && { color: COLORS.error },
            item.status === 'resolved' && { color: COLORS.success },
          ]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={s.catRow}>
        <Ionicons name="pricetag-outline" size={12} color={COLORS.brand} style={{ marginRight: 4 }} />
        <Text style={s.catText}>{item.category_display}</Text>
        <Text style={{ fontSize: 10, color: COLORS.textTer, marginLeft: 'auto' }}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>

      <Text style={s.title}>{item.title}</Text>
      <Text style={s.desc} numberOfLines={3}>{item.description}</Text>

      {/* Screenshots */}
      {item.screenshots && item.screenshots.length > 0 && (
        <View style={s.shotsRow}>
          {item.screenshots.map((url) => (
            <TouchableOpacity key={url} onPress={() => setSelectedImage(url)} activeOpacity={0.8}>
              <Image source={{ uri: url }} style={s.shotThumb} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Admin Notes */}
      {!!item.admin_notes && (
        <View style={s.notesBox}>
          <Text style={s.notesLabel}>ADMIN NOTES:</Text>
          <Text style={s.notesText}>{item.admin_notes}</Text>
        </View>
      )}

      {/* Action buttons */}
      <View style={s.actionRow}>
        <TouchableOpacity onPress={() => openEditModal(item)} style={s.editBtn} activeOpacity={0.8}>
          <Ionicons name="create-outline" size={14} color={COLORS.brand} style={{ marginRight: 4 }} />
          <Text style={s.editBtnText}>Edit / Resolve</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => handleDelete(item.id)} style={s.deleteBtn} activeOpacity={0.75}>
          <Ionicons name="trash-outline" size={15} color={COLORS.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={s.container}>
      {/* Full Image Modal */}
      <Modal visible={!!selectedImage} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
        <View style={s.imageModalBg}>
          <TouchableOpacity onPress={() => setSelectedImage(null)} style={s.closeModalBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          {selectedImage && <Image source={{ uri: selectedImage }} style={s.fullModalImage} resizeMode="contain" />}
        </View>
      </Modal>

      {/* Edit Ticket Modal */}
      <Modal visible={!!editItem} transparent animationType="slide" onRequestClose={() => setEditItem(null)}>
        <View style={s.editModalBg}>
          <View style={s.editModalCard}>
            <View style={s.editModalHeader}>
              <Text style={s.editModalTitle}>Edit &amp; Manage Ticket</Text>
              <TouchableOpacity onPress={() => setEditItem(null)}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.modalLabel}>TITLE / SUMMARY</Text>
              <TextInput style={s.modalInput} value={editTitle} onChangeText={setEditTitle} />

              <Text style={s.modalLabel}>USER PHONE CONTACT</Text>
              <TextInput style={s.modalInput} value={editPhone} onChangeText={setEditPhone} keyboardType="phone-pad" />

              <Text style={s.modalLabel}>STATUS</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                {['new', 'in_progress', 'resolved', 'closed'].map(st => (
                  <TouchableOpacity
                    key={st}
                    onPress={() => setEditStatus(st)}
                    style={[s.modalPill, editStatus === st && s.modalPillActive]}
                  >
                    <Text style={[s.modalPillText, editStatus === st && { color: '#fff' }]}>
                      {st.replace('_', ' ').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.modalLabel}>SEVERITY</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                {['low', 'medium', 'high', 'critical'].map(sev => (
                  <TouchableOpacity
                    key={sev}
                    onPress={() => setEditSeverity(sev)}
                    style={[s.modalPill, editSeverity === sev && { backgroundColor: COLORS.error, borderColor: COLORS.error }]}
                  >
                    <Text style={[s.modalPillText, editSeverity === sev && { color: '#fff' }]}>
                      {sev.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.modalLabel}>ADMIN RESOLUTION NOTES</Text>
              <TextInput
                style={s.modalTextArea}
                placeholder="Mention fixes or action steps..."
                placeholderTextColor={COLORS.textTer}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={editNotes}
                onChangeText={setEditNotes}
              />

              <TouchableOpacity
                onPress={handleSaveEdit}
                disabled={savingEdit}
                style={s.modalSaveBtn}
                activeOpacity={0.85}
              >
                {savingEdit ? <ActivityIndicator color="#fff" /> : <Text style={s.modalSaveBtnText}>Save Ticket Changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Admin Create Ticket Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <View style={s.editModalBg}>
          <View style={s.editModalCard}>
            <View style={s.editModalHeader}>
              <Text style={s.editModalTitle}>Create New Bug Ticket</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.modalLabel}>TITLE / SUMMARY</Text>
              <TextInput style={s.modalInput} placeholder="Short issue title..." value={newTitle} onChangeText={setNewTitle} />

              <Text style={s.modalLabel}>USER PHONE CONTACT</Text>
              <TextInput style={s.modalInput} placeholder="+91 XXXXX XXXXX" value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" />

              <Text style={s.modalLabel}>DESCRIPTION *</Text>
              <TextInput style={s.modalTextArea} placeholder="Describe the issue..." multiline numberOfLines={4} textAlignVertical="top" value={newDesc} onChangeText={setNewDesc} />

              <TouchableOpacity onPress={handleCreateTicket} disabled={creating} style={s.modalSaveBtn} activeOpacity={0.85}>
                {creating ? <ActivityIndicator color="#fff" /> : <Text style={s.modalSaveBtnText}>Create Ticket</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Top Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Error Logs &amp; Diagnostics</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {tab === 'tickets' && (
            <TouchableOpacity onPress={() => setShowCreateModal(true)} style={s.addBtn}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => {
            if (tab === 'tickets') fetchReports();
            else if (tab === 'system_logs') fetchSystemLogs();
            else fetchServerLogsAndHealth();
          }} style={s.refreshBtn}>
            <Ionicons name="refresh" size={18} color={COLORS.brand} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Mode Tabs */}
      <View style={s.mainTabRow}>
        <TouchableOpacity onPress={() => setTab('tickets')} style={[s.mainTab, tab === 'tickets' && s.mainTabActive]}>
          <Ionicons name="bug" size={14} color={tab === 'tickets' ? COLORS.brand : COLORS.textSec} style={{ marginRight: 4 }} />
          <Text style={[s.mainTabText, tab === 'tickets' && s.mainTabTextActive]}>Tickets</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('system_logs')} style={[s.mainTab, tab === 'system_logs' && s.mainTabActive]}>
          <Ionicons name="alert-circle" size={14} color={tab === 'system_logs' ? COLORS.brand : COLORS.textSec} style={{ marginRight: 4 }} />
          <Text style={[s.mainTabText, tab === 'system_logs' && s.mainTabTextActive]}>System Errors</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('server_stream')} style={[s.mainTab, tab === 'server_stream' && s.mainTabActive]}>
          <Ionicons name="terminal" size={14} color={tab === 'server_stream' ? COLORS.brand : COLORS.textSec} style={{ marginRight: 4 }} />
          <Text style={[s.mainTabText, tab === 'server_stream' && s.mainTabTextActive]}>Live Server</Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: User Reported Tickets */}
      {tab === 'tickets' && (
        <View style={{ flex: 1 }}>
          <View style={s.filterRow}>
            {['all', 'new', 'in_progress', 'resolved'].map(st => (
              <TouchableOpacity
                key={st}
                onPress={() => setStatusFilter(st)}
                style={[s.filterPill, statusFilter === st && s.filterPillActive]}
              >
                <Text style={[s.filterPillText, statusFilter === st && s.filterPillTextActive]}>
                  {st.replace('_', ' ').toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={COLORS.brand} />
            </View>
          ) : (
            <FlatList
              data={reports}
              keyExtractor={item => item.id}
              renderItem={renderTicketItem}
              contentContainerStyle={{ padding: SPACE.md, paddingBottom: 60 }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Ionicons name="checkmark-done-circle-outline" size={48} color={COLORS.success} style={{ opacity: 0.5, marginBottom: 8 }} />
                  <Text style={{ fontSize: 14, color: COLORS.textTer }}>No error reports found</Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {/* TAB 2: System Exceptions */}
      {tab === 'system_logs' && (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACE.md, paddingVertical: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
            <Text style={{ fontSize: 12, fontWeight: FONT.w7, color: COLORS.textSec }}>
              Captured 500s, Push &amp; Auth Failures ({systemLogs.length})
            </Text>
            {systemLogs.length > 0 && (
              <TouchableOpacity onPress={handleClearSystemLogs} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                <Ionicons name="trash" size={12} color={COLORS.error} style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 11, fontWeight: FONT.w7, color: COLORS.error }}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={systemLogs}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: SPACE.md, paddingBottom: 60 }}
            renderItem={({ item }) => (
              <View style={s.sysLogCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <View style={[s.sysBadge, item.level === 'CRITICAL' ? { backgroundColor: '#fee2e2' } : { backgroundColor: '#fef3c7' }]}>
                    <Text style={[s.sysBadgeText, item.level === 'CRITICAL' ? { color: COLORS.error } : { color: '#d97706' }]}>
                      {item.level} · {item.log_type_display}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 10, color: COLORS.textTer }}>{item.created_at}</Text>
                </View>
                <Text style={s.sysLogMsg}>{item.message}</Text>
                {!!item.path && <Text style={s.sysLogPath}>{item.method} {item.path}</Text>}
                {!!item.traceback && (
                  <ScrollView style={s.sysTraceBox} nestedScrollEnabled>
                    <Text style={s.sysTraceText}>{item.traceback}</Text>
                  </ScrollView>
                )}
              </View>
            )}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Ionicons name="shield-checkmark-outline" size={48} color={COLORS.success} style={{ opacity: 0.5, marginBottom: 8 }} />
                <Text style={{ fontSize: 14, color: COLORS.textTer }}>No captured system errors</Text>
              </View>
            }
          />
        </View>
      )}

      {/* TAB 3: Live Server Stream & Health */}
      {tab === 'server_stream' && (
        <ScrollView style={{ flex: 1, padding: SPACE.md }} contentContainerStyle={{ paddingBottom: 60 }}>
          {health && (
            <View style={s.healthGrid}>
              <View style={s.healthCard}>
                <Text style={s.healthLabel}>GUNICORN</Text>
                <Text style={s.healthVal}>{health.gunicorn_workers} Workers</Text>
                <Text style={s.healthSub}>Status: Active</Text>
              </View>
              <View style={s.healthCard}>
                <Text style={s.healthLabel}>RAM USED</Text>
                <Text style={s.healthVal}>{health.ram_used}</Text>
                <Text style={s.healthSub}>{health.ram_percent}% of {health.ram_total}</Text>
              </View>
              <View style={s.healthCard}>
                <Text style={s.healthLabel}>POSTGRESQL</Text>
                <Text style={s.healthVal}>{health.postgres_active_connections} Conns</Text>
                <Text style={s.healthSub}>Healthy</Text>
              </View>
              <View style={s.healthCard}>
                <Text style={s.healthLabel}>UPTIME</Text>
                <Text style={s.healthVal} numberOfLines={1}>{health.uptime}</Text>
                <Text style={s.healthSub}>App VM</Text>
              </View>
            </View>
          )}

          <View style={s.consoleHeader}>
            <Text style={s.consoleTitle}>Live server.log ({logTimestamp || 'Active'})</Text>
            <TouchableOpacity onPress={() => setAutoPoll(!autoPoll)} style={[s.pollPill, autoPoll && { backgroundColor: '#d1fae5' }]}>
              <Ionicons name={autoPoll ? 'radio-button-on' : 'radio-button-off'} size={12} color={autoPoll ? COLORS.success : COLORS.textTer} style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 10, fontWeight: FONT.w7, color: autoPoll ? COLORS.success : COLORS.textTer }}>
                {autoPoll ? 'Auto-polling (4s)' : 'Paused'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={s.terminalBox}>
            <ScrollView nestedScrollEnabled style={{ maxHeight: 380 }}>
              <Text style={s.terminalText}>
                {serverLogs.join('\n') || 'Awaiting live server logs...'}
              </Text>
            </ScrollView>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f9' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 54 : 44, paddingBottom: 12,
    paddingHorizontal: SPACE.lg, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.brand },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.brandLight },
  headerTitle: { fontSize: FONT.md, fontWeight: FONT.w8, color: COLORS.text },

  mainTabRow: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: SPACE.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  mainTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  mainTabActive: { borderBottomColor: COLORS.brand },
  mainTabText: { fontSize: 12, fontWeight: FONT.w6, color: COLORS.textSec },
  mainTabTextActive: { color: COLORS.brand, fontWeight: FONT.w8 },

  filterRow: { flexDirection: 'row', padding: SPACE.sm, gap: 6, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  filterPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.full, backgroundColor: '#f1f5f9' },
  filterPillActive: { backgroundColor: COLORS.brand },
  filterPillText: { fontSize: 10, fontWeight: FONT.w7, color: COLORS.textSec },
  filterPillTextActive: { color: '#fff' },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border, ...SHADOW.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  userName: { fontSize: 13, fontWeight: FONT.w8, color: COLORS.text },
  userEmail: { fontSize: 10, color: COLORS.textTer },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: '#fef3c7' },
  badgeText: { fontSize: 9, fontWeight: FONT.w8, color: '#d97706' },

  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  catText: { fontSize: 11, fontWeight: FONT.w6, color: COLORS.brand },
  title: { fontSize: 13, fontWeight: FONT.w7, color: COLORS.text, marginBottom: 2 },
  desc: { fontSize: 11, color: COLORS.textSec, lineHeight: 16, marginBottom: 8 },

  shotsRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  shotThumb: { width: 54, height: 54, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },

  notesBox: { backgroundColor: '#f8fafc', padding: 8, borderRadius: 8, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: COLORS.brand },
  notesLabel: { fontSize: 9, fontWeight: FONT.w8, color: COLORS.textTer },
  notesText: { fontSize: 11, color: COLORS.text, marginTop: 2 },

  actionRow: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8, alignItems: 'center' },
  editBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.brandLight, height: 34, borderRadius: 8 },
  editBtnText: { color: COLORS.brand, fontSize: 11, fontWeight: FONT.w7 },
  deleteBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },

  imageModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  closeModalBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  fullModalImage: { width: '90%', height: '80%' },

  editModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  editModalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACE.lg, maxHeight: '85%' },
  editModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  editModalTitle: { fontSize: FONT.md, fontWeight: FONT.w8, color: COLORS.text },
  modalLabel: { fontSize: 10, fontWeight: FONT.w8, color: COLORS.textTer, letterSpacing: 1, marginBottom: 4 },
  modalInput: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: COLORS.border, fontSize: 12, marginBottom: 10 },
  modalPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#f1f5f9' },
  modalPillActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  modalPillText: { fontSize: 10, fontWeight: FONT.w7, color: COLORS.textSec },
  modalTextArea: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: COLORS.border, minHeight: 80, fontSize: 12, marginBottom: 14 },
  modalSaveBtn: { backgroundColor: COLORS.brand, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalSaveBtnText: { color: '#fff', fontSize: 13, fontWeight: FONT.w8 },

  sysLogCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  sysBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  sysBadgeText: { fontSize: 9, fontWeight: FONT.w8 },
  sysLogMsg: { fontSize: 12, fontWeight: FONT.w7, color: COLORS.error, marginTop: 4 },
  sysLogPath: { fontSize: 10, color: COLORS.textTer, marginTop: 2, fontFamily: 'monospace' },
  sysTraceBox: { maxHeight: 100, backgroundColor: '#1e293b', padding: 6, borderRadius: 6, marginTop: 6 },
  sysTraceText: { color: '#f8fafc', fontSize: 9, fontFamily: 'monospace' },

  healthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  healthCard: { width: '48%', backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  healthLabel: { fontSize: 9, fontWeight: FONT.w8, color: COLORS.textTer, letterSpacing: 0.8 },
  healthVal: { fontSize: 14, fontWeight: FONT.w9, color: COLORS.text, marginTop: 2 },
  healthSub: { fontSize: 10, color: COLORS.brand, marginTop: 1 },

  consoleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  consoleTitle: { fontSize: 11, fontWeight: FONT.w7, color: COLORS.textSec },
  pollPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: '#f1f5f9' },
  terminalBox: { backgroundColor: '#0f172a', borderRadius: 12, padding: 12 },
  terminalText: { color: '#38bdf8', fontSize: 10, fontFamily: 'monospace', lineHeight: 15 },
});
