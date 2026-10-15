import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  RefreshControl, Linking, Share, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, SPACE, RADIUS, SHADOW, BOTTOM } from '../theme';
import { apiFetch } from '../api';

export default function CertificatesScreen({ tokens, onBack }) {
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCerts = useCallback(async () => {
    try {
      const res = await apiFetch('/certificates/my/');
      const data = await res.json();
      setCerts(Array.isArray(data.certificates) ? data.certificates : []);
    } catch (e) {
      console.log('Certs fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchCerts(); }, [fetchCerts]);

  const handleShare = async (cert) => {
    if (!cert.pdf_url) return;
    try {
      await Share.share({
        message: `My ${cert.template_title} from ETD 2026!\n${cert.pdf_url}`,
        title: cert.template_title,
      });
    } catch (e) {}
  };

  const handleDownload = (cert) => {
    if (!cert.pdf_url) return;
    Linking.openURL(cert.pdf_url).catch(() => {
      Alert.alert('Download', 'Opening in browser...');
    });
  };

  const renderCert = ({ item }) => (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={s.iconWrap}>
          <Ionicons name="ribbon" size={22} color={COLORS.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.certTitle} numberOfLines={2}>{item.template_title}</Text>
          <Text style={s.certDate}>
            Issued {new Date(item.issued_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
          {!!item.issued_by && <Text style={s.certBy}>by {item.issued_by}</Text>}
        </View>
      </View>
      {!!item.template_description && (
        <Text style={s.certDesc} numberOfLines={2}>{item.template_description}</Text>
      )}
      <View style={s.actions}>
        <TouchableOpacity style={s.actionBtn} onPress={() => handleDownload(item)} activeOpacity={0.7}>
          <Ionicons name="download-outline" size={16} color={COLORS.brand} />
          <Text style={s.actionText}>Download PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => handleShare(item)} activeOpacity={0.7}>
          <Ionicons name="share-social-outline" size={16} color={COLORS.success} />
          <Text style={[s.actionText, { color: COLORS.success }]}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.title}>My Certificates</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={s.center}><Text style={s.loadingText}>Loading...</Text></View>
      ) : certs.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="ribbon-outline" size={56} color={COLORS.textTer} />
          <Text style={s.emptyTitle}>No Certificates Yet</Text>
          <Text style={s.emptySub}>Certificates will appear here once issued by the organizers.</Text>
        </View>
      ) : (
        <FlatList
          data={certs}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCert}
          contentContainerStyle={{ padding: SPACE.xl, paddingBottom: 80 + (BOTTOM || 0) }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCerts(); }} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg || '#f8fafc' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACE.xl, paddingTop: Platform.OS === 'ios' ? 54 : 38,
    paddingBottom: SPACE.md, backgroundColor: '#fff', borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.borderLight, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: FONT.lg, fontWeight: FONT.w8, color: COLORS.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.xxl },
  loadingText: { fontSize: FONT.md, color: COLORS.textSec },
  emptyTitle: { fontSize: FONT.lg, fontWeight: FONT.w8, color: COLORS.text, marginTop: SPACE.md },
  emptySub: { fontSize: FONT.sm, color: COLORS.textSec, textAlign: 'center', marginTop: SPACE.sm, lineHeight: 18 },
  card: {
    backgroundColor: '#fff', borderRadius: RADIUS.xl, padding: SPACE.lg,
    marginBottom: SPACE.md, borderWidth: 1, borderColor: COLORS.border, ...SHADOW.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  iconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.accentLight || '#fef3c7', alignItems: 'center', justifyContent: 'center',
  },
  certTitle: { fontSize: FONT.base, fontWeight: FONT.w7, color: COLORS.text },
  certDate: { fontSize: FONT.xs, color: COLORS.textSec, marginTop: 2 },
  certBy: { fontSize: FONT.micro, color: COLORS.textTer, marginTop: 1 },
  certDesc: { fontSize: FONT.xs, color: COLORS.textSec, marginTop: SPACE.sm, lineHeight: 16 },
  actions: {
    flexDirection: 'row', gap: SPACE.md, marginTop: SPACE.md,
    paddingTop: SPACE.sm, borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, paddingHorizontal: SPACE.sm + 4,
    backgroundColor: COLORS.brandLight, borderRadius: RADIUS.full,
  },
  actionText: { fontSize: FONT.xs, fontWeight: FONT.w6, color: COLORS.brand },
});
