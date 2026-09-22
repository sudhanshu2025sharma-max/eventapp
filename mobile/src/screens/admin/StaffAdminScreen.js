import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  TextInput, ScrollView, Alert, ActivityIndicator, StatusBar, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACE, RADIUS, SHADOW, fixMediaUrl } from '../../theme';
import { apiFetch } from '../../api';

const TIERS = [
  { key: 'librarian', label: 'Librarian & Head' },
  { key: 'deputy', label: 'Deputy Librarian' },
  { key: 'assistant', label: 'Assistant Librarian' },
  { key: 'staff', label: 'Staff' },
];
const ROLES = ['team_head', 'staff'];

export default function StaffAdminScreen({ onBack }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [tier, setTier] = useState('staff');
  const [role, setRole] = useState('staff');
  const [password, setPassword] = useState('');
  const [photo, setPhoto] = useState(null);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [profileUrl, setProfileUrl] = useState('');
  const [scholarUrl, setScholarUrl] = useState('');

  useEffect(() => { fetchStaff(); }, []);

  const fetchStaff = async () => {
    try {
      const res = await apiFetch('/auth/staff/');
      if (res.ok) {
        const data = await res.json();
        setStaff(data.staff || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const resetForm = () => {
    setEditId(null);
    setFirstName(''); setLastName(''); setEmail(''); setPhone('');
    setDesignation(''); setDepartment(''); setTier('staff');
    setRole('staff'); setPassword(''); setPhoto(null); setLinkedinUrl(''); setProfileUrl(''); setScholarUrl('');
    setShowForm(false);
  };

  const openEditForm = (item) => {
    setEditId(item.user_id);
    setFirstName(item.first_name || '');
    setLastName(item.last_name || '');
    setEmail(item.email || '');
    setPhone(item.phone || '');
    setDesignation(item.designation || '');
    setDepartment(item.department || '');
    setTier(item.tier || 'staff');
    setRole('staff');
    setPassword('');
    setPhoto(null);
    setLinkedinUrl(item.linkedin_url || '');
    setProfileUrl(item.profile_url || '');
    setScholarUrl(item.scholar_url || '');
    setShowForm(true);
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0]);
    }
  };

  const handleSave = async () => {
    if (!firstName || !email) {
      Alert.alert('Error', 'First name and email are required.');
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('first_name', firstName);
      formData.append('last_name', lastName);
      formData.append('email', email);
      formData.append('phone', phone);
      formData.append('designation', designation);
      formData.append('department', department);
      formData.append('tier', tier);
      formData.append('role', role);
      if (password) formData.append('password', password);
      formData.append('linkedin_url', linkedinUrl);
      formData.append('profile_url', profileUrl);
      formData.append('scholar_url', scholarUrl);
      if (photo) {
        formData.append('photo', {
          uri: photo.uri,
          name: photo.fileName || 'photo.jpg',
          type: photo.mimeType || 'image/jpeg',
        });
      }

      const url = editId
        ? `/auth/staff/admin/${editId}/edit/`
        : '/auth/staff/admin/create/';
      const method = editId ? 'POST' : 'POST';

      const res = await apiFetch(url, { method, body: formData });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Success', data.message);
        resetForm();
        fetchStaff();
      } else {
        Alert.alert('Error', data.message || 'Failed to save.');
      }
    } catch (e) {
      Alert.alert('Error', 'Network error.');
    } finally { setSaving(false); }
  };

  const handleDelete = (item) => {
    Alert.alert(
      'Delete Staff',
      `Remove ${item.full_name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              const res = await apiFetch(`/auth/staff/admin/${item.user_id}/delete/`, { method: 'DELETE' });
              const data = await res.json();
              if (data.success) fetchStaff();
              else Alert.alert('Error', data.message);
            } catch (e) { Alert.alert('Error', 'Failed.'); }
          }
        }
      ]
    );
  };

  const renderCard = ({ item }) => {
    const photoUrl = fixMediaUrl(item.photo_url);
    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, { backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>
                {(item.first_name?.[0] || '') + (item.last_name?.[0] || '')}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName}>{item.full_name}</Text>
            <Text style={styles.cardDesig}>{item.designation}</Text>
            <Text style={styles.cardEmail}>{item.email}</Text>
          </View>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.editBtn} onPress={() => openEditForm(item)}>
            <Ionicons name="create-outline" size={16} color="#4f46e5" />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.delBtn} onPress={() => handleDelete(item)}>
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
            <Text style={styles.delBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Staff</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => { resetForm(); setShowForm(true); }}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#4f46e5" /></View>
      ) : (
        <FlatList
          data={staff}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCard}
          contentContainerStyle={{ padding: SPACE.lg }}
        />
      )}

      {/* Create/Edit Modal */}
      {showForm && (
      <Modal visible={showForm} animationType="slide" transparent={false}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={resetForm}>
              <Ionicons name="close" size={28} color="#1e293b" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editId ? 'Edit Staff' : 'Add Staff'}</Text>
            <View style={{ width: 28 }} />
          </View>
          <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>First Name *</Text>
            <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} />

            <Text style={styles.label}>Last Name</Text>
            <TextInput style={styles.input} value={lastName} onChangeText={setLastName} />

            <Text style={styles.label}>Email *</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

            <Text style={styles.label}>Designation</Text>
            <TextInput style={styles.input} value={designation} onChangeText={setDesignation} />

            <Text style={styles.label}>Department</Text>
            <TextInput style={styles.input} value={department} onChangeText={setDepartment} />

            <Text style={styles.label}>Tier</Text>
            <View style={styles.chipRow}>
              {TIERS.map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.chip, tier === t.key && styles.chipActive]}
                  onPress={() => setTier(t.key)}
                >
                  <Text style={[styles.chipText, tier === t.key && styles.chipTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Role</Text>
            <View style={styles.chipRow}>
              {ROLES.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.chip, role === r && styles.chipActive]}
                  onPress={() => setRole(r)}
                >
                  <Text style={[styles.chipText, role === r && styles.chipTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {!editId && (
              <>
                <Text style={styles.label}>Password</Text>
                <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Staff@123" />
              </>
            )}

            <Text style={styles.label}>LinkedIn URL</Text>
            <TextInput style={styles.input} value={linkedinUrl} onChangeText={setLinkedinUrl} placeholder="https://linkedin.com/in/..." autoCapitalize="none" />

            <Text style={styles.label}>Academic Profile URL</Text>
            <TextInput style={styles.input} value={profileUrl} onChangeText={setProfileUrl} placeholder="https://web.iitd.ac.in/~..." autoCapitalize="none" />

            <Text style={styles.label}>Google Scholar URL</Text>
            <TextInput style={styles.input} value={scholarUrl} onChangeText={setScholarUrl} placeholder="https://scholar.google.com/..." autoCapitalize="none" />

            <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
              <Ionicons name="camera-outline" size={20} color="#4f46e5" />
              <Text style={styles.photoBtnText}>{photo ? 'Photo Selected' : 'Pick Photo'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : (editId ? 'Update' : 'Create')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#0f172a', paddingTop: 48, paddingBottom: 16,
    paddingHorizontal: SPACE.lg, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff' },
  addBtn: { backgroundColor: '#4f46e5', borderRadius: 20, padding: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: SPACE.md,
    marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', ...SHADOW.sm,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 48, height: 48, borderRadius: 24 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  cardDesig: { fontSize: 12, color: '#4f46e5', fontWeight: '600' },
  cardEmail: { fontSize: 11, color: '#64748b' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 },
  editBtnText: { fontSize: 13, color: '#4f46e5', fontWeight: '600' },
  delBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 },
  delBtnText: { fontSize: 13, color: '#ef4444', fontWeight: '600' },
  modalContainer: { flex: 1, backgroundColor: '#f8fafc' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 48, paddingBottom: 12, paddingHorizontal: SPACE.lg,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  formContent: { padding: SPACE.lg, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1e293b',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#4f46e5' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  chipTextActive: { color: '#fff' },
  photoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16,
    padding: 12, backgroundColor: '#eef2ff', borderRadius: RADIUS.md, justifyContent: 'center',
  },
  photoBtnText: { fontSize: 14, fontWeight: '600', color: '#4f46e5' },
  saveBtn: {
    backgroundColor: '#4f46e5', borderRadius: RADIUS.md, padding: 14,
    alignItems: 'center', marginTop: 20,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
