import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, Alert, StatusBar, Platform, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { COLORS, FONT, RADIUS, SHADOW } from '../../theme';
import { apiFetch } from '../../api';

const TOP = Platform.OS === 'ios' ? 54 : 44;

export default function PapersAdminScreen({ onBack }) {
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');

  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [paperId, setPaperId] = useState('');
  const [type, setType] = useState('paper');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [abstract, setAbstract] = useState('');
  const [track, setTrack] = useState('');
  const [doc, setDoc] = useState(null);

  const fetchPapers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/schedule/admin/papers/');
      if (res.ok) {
        const d = await res.json();
        setPapers(d.papers || []);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPapers(); }, [fetchPapers]);

  const resetForm = () => {
    setTitle(''); setAuthors(''); setPaperId(''); setType('paper');
    setDate(''); setTime(''); setAbstract(''); setTrack(''); setDoc(null);
    setShowForm(false);
  };

  const handlePickDoc = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets?.[0]) setDoc(res.assets[0]);
    } catch {
      Alert.alert('Error', 'Could not pick document.');
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !authors.trim()) {
      Alert.alert('Required', 'Title and Authors are required.');
      return;
    }
    setSaving(true);
    try {
      const f = new FormData();
      f.append('title', title.trim());
      f.append('authors', authors.trim());
      f.append('paper_id', paperId.trim());
      f.append('paper_type', type);
      f.append('presentation_date', date.trim());
      f.append('presentation_time', time.trim());
      f.append('abstract', abstract.trim());
      f.append('track', track.trim());
      if (doc) {
        f.append('document', {
          uri: doc.uri,
          name: doc.name || 'paper.pdf',
          type: doc.mimeType || 'application/pdf',
        });
      }
      const res = await apiFetch('/schedule/admin/papers/', { method: 'POST', body: f });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.success !== false) {
        Alert.alert('Success', 'Submission saved.');
        resetForm();
        fetchPapers();
      } else {
        Alert.alert('Error', d.error || d.message || 'Save failed');
      }
    } catch {
      Alert.alert('Error', 'Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id, name) => {
    Alert.alert('Delete', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/schedule/admin/papers/?id=${id}`, { method: 'DELETE' });
            fetchPapers();
          } catch {
            Alert.alert('Error', 'Delete failed');
          }
        },
      },
    ]);
  };

  const filtered = papers.filter(p => filter === 'all' ? true : p.paper_type === filter);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Papers & Posters</Text>
        <TouchableOpacity onPress={() => setShowForm(true)} style={s.addBtn}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={s.filters}>
        {['all', 'paper', 'poster'].map(k => (
          <TouchableOpacity key={k} style={[s.chip, filter === k && s.chipOn]} onPress={() => setFilter(k)}>
            <Text style={[s.chipT, filter === k && s.chipTOn]}>
              {k === 'all' ? 'All' : k === 'paper' ? 'Papers' : 'Posters'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.brand} size="large" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {filtered.length === 0 ? (
            <Text style={s.empty}>No items yet. Tap + to add.</Text>
          ) : filtered.map(p => (
            <View key={p.id} style={s.card}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
                  <Text style={s.badge}>{p.paper_type}</Text>
                  {!!p.paper_id && <Text style={s.pid}>{p.paper_id}</Text>}
                </View>
                <Text style={s.title}>{p.title}</Text>
                <Text style={s.auth} numberOfLines={2}>{p.authors}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(p.id, p.title)} hitSlop={10}>
                <Ionicons name="trash-outline" size={20} color={COLORS.error || '#ef4444'} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={showForm} animationType="slide">
        <View style={s.root}>
          <View style={[s.header, { backgroundColor: '#fff' }]}>
            <TouchableOpacity onPress={resetForm}>
              <Ionicons name="close" size={26} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={[s.headerTitle, { color: COLORS.text }]}>Add Submission</Text>
            <View style={{ width: 26 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            <Text style={s.label}>Type</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              {['paper', 'poster'].map(t => (
                <TouchableOpacity key={t} style={[s.typeBtn, type === t && s.typeBtnOn]} onPress={() => setType(t)}>
                  <Text style={[s.typeT, type === t && { color: '#fff' }]}>{t === 'paper' ? 'Paper' : 'Poster'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.label}>Title *</Text>
            <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Full title" />
            <Text style={s.label}>Authors *</Text>
            <TextInput style={s.input} value={authors} onChangeText={setAuthors} placeholder="Comma-separated" />
            <Text style={s.label}>Paper ID</Text>
            <TextInput style={s.input} value={paperId} onChangeText={setPaperId} placeholder="ETD-042" />
            <Text style={s.label}>Track</Text>
            <TextInput style={s.input} value={track} onChangeText={setTrack} placeholder="AI & ETDs" />
            <Text style={s.label}>Date (YYYY-MM-DD)</Text>
            <TextInput style={s.input} value={date} onChangeText={setDate} placeholder="2026-10-24" />
            <Text style={s.label}>Time / Room</Text>
            <TextInput style={s.input} value={time} onChangeText={setTime} placeholder="11:15 AM @ Hall A" />
            <Text style={s.label}>Abstract</Text>
            <TextInput style={[s.input, { height: 90, textAlignVertical: 'top' }]} value={abstract} onChangeText={setAbstract} multiline />
            <Text style={s.label}>Document (PDF)</Text>
            <TouchableOpacity style={s.upload} onPress={handlePickDoc}>
              <Ionicons name="document-attach" size={18} color={doc ? COLORS.success : COLORS.brand} />
              <Text style={{ color: doc ? COLORS.success : COLORS.brand, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                {doc ? doc.name : 'Select PDF / Word file'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.save} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveT}>Save</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    paddingTop: TOP, paddingBottom: 14, paddingHorizontal: 16,
    backgroundColor: '#0f172a', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  addBtn: { backgroundColor: '#0d9488', borderRadius: 18, padding: 6 },
  filters: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9' },
  chipOn: { backgroundColor: '#0d9488' },
  chipT: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  chipTOn: { color: '#fff' },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    padding: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0',
  },
  badge: { fontSize: 10, fontWeight: '800', color: '#0f766e', backgroundColor: '#ccfbf1', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden', textTransform: 'uppercase' },
  pid: { fontSize: 10, fontWeight: '700', color: '#94a3b8', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  title: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  auth: { fontSize: 12, color: '#64748b', marginTop: 2 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  label: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 6, marginTop: 4 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, marginBottom: 12, backgroundColor: '#fff', fontSize: 14 },
  typeBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  typeBtnOn: { backgroundColor: '#0d9488', borderColor: '#0d9488' },
  typeT: { fontWeight: '700', color: '#64748b' },
  upload: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#cbd5e1', borderRadius: 10, marginBottom: 16 },
  save: { backgroundColor: '#0d9488', padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 30 },
  saveT: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
