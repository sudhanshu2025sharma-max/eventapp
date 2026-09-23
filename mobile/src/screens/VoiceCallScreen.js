import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONT, SPACE, RADIUS } from '../theme';

export default function VoiceCallScreen({ onEndCall, otherUserName }) {
  return (
    <View style={st.container}>
      <Text style={st.title}>Voice Calls</Text>
      <Text style={st.sub}>Voice calling has been retired for ETD 2026.</Text>
      <TouchableOpacity style={st.btn} onPress={onEndCall}>
        <Text style={st.btnText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', padding: SPACE.xl },
  title: { fontSize: FONT.xl, fontWeight: FONT.w8, color: COLORS.text, marginBottom: SPACE.sm },
  sub: { fontSize: FONT.sm, color: COLORS.textTer, textAlign: 'center', marginBottom: SPACE.xxl },
  btn: { backgroundColor: COLORS.brand, paddingHorizontal: SPACE.xxl, paddingVertical: SPACE.md, borderRadius: RADIUS.lg },
  btnText: { color: COLORS.textInverse, fontWeight: FONT.w7, fontSize: FONT.base },
});
