import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  StatusBar,
  Platform,
  NativeModules,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { COLORS, FONT, RADIUS, SPACE, fixMediaUrl } from '../theme';

const WS_CALL_URL = `${API_ROOT.replace('https://', 'wss://').replace('http://', 'ws://')}/ws/call/`;

const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:10.17.9.48:3478' },
    { urls: 'turn:10.17.9.48:3478?transport=udp', username: 'etd', credential: 'etd2026turn' },
    { urls: 'turn:10.17.9.48:3478?transport=tcp', username: 'etd', credential: 'etd2026turn' },
  ],
  iceCandidatePoolSize: 10,
};

// Check if native module is linked
const isNativeWebRTC = Platform.OS !== 'web' && !!(NativeModules && NativeModules.WebRTCModule);

function getWebRTC() {
  if (Platform.OS === 'web') {
    return {
      RTCPeerConnection: typeof window !== 'undefined' ? (window.RTCPeerConnection || window.webkitRTCPeerConnection) : null,
      RTCSessionDescription: typeof window !== 'undefined' ? window.RTCSessionDescription : null,
      RTCIceCandidate: typeof window !== 'undefined' ? window.RTCIceCandidate : null,
      mediaDevices: typeof navigator !== 'undefined' ? navigator.mediaDevices : null,
    };
  } else if (isNativeWebRTC) {
    try {
      const webrtc = require('react-native-webrtc');
      const mod = webrtc.default || webrtc;
      return {
        RTCPeerConnection: mod.RTCPeerConnection,
        RTCSessionDescription: mod.RTCSessionDescription,
        RTCIceCandidate: mod.RTCIceCandidate,
        mediaDevices: mod.mediaDevices,
      };
    } catch (e) {
      return { RTCPeerConnection: null, RTCSessionDescription: null, RTCIceCandidate: null, mediaDevices: null };
    }
  }
  return { RTCPeerConnection: null, RTCSessionDescription: null, RTCIceCandidate: null, mediaDevices: null };
}

export default function VoiceCallScreen({
  callMode = 'outgoing',
  targetUser,
  incomingSessionId,
  tokens,
  currentUser,
  onEndCall,
}) {
  const [callState, setCallState] = useState(
    callMode === 'incoming' ? 'incoming' : 'calling'
  );
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);

  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const localStreamRef = useRef(null);
  const sessionIdRef = useRef(incomingSessionId || null);
  const iceQueueRef = useRef([]);
  const timerRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // 1. Prime System Audio
  useEffect(() => {
    async function configureAudio() {
      if (Platform.OS !== 'web') {
        try {
          await Audio.requestPermissionsAsync();
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
        } catch (e) {}
      }
    }
    configureAudio();

    return () => {
      if (Platform.OS !== 'web') {
        Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        }).catch(() => {});
      }
    };
  }, []);

  // 2. Pulse Animation for Avatar
  useEffect(() => {
    if (callState === 'calling' || callState === 'incoming' || callState === 'connected') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1000,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      ).start();
    }
  }, [callState]);

  // 3. Duration Timer
  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // 4. WebRTC Connection Setup
  useEffect(() => {
    let isMounted = true;
    const rtc = getWebRTC();

    async function initCall() {
      try {
        // Capture local microphone
        if (rtc.mediaDevices?.getUserMedia) {
          try {
            const stream = await rtc.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
              video: false,
            });
            localStreamRef.current = stream;
          } catch (e) {
            console.warn('[Mic Access]', e);
          }
        }

        // Open signaling WebSocket
        const ws = new WebSocket(`${WS_CALL_URL}?token=${tokens?.access || ''}`);
        wsRef.current = ws;

        ws.onopen = () => {
          if (callMode === 'outgoing' && targetUser?.id) {
            ws.send(JSON.stringify({ type: 'call_initiate', callee_id: targetUser.id }));
          }
        };

        ws.onmessage = async (e) => {
          try {
            const data = JSON.parse(e.data);
            handleSignaling(data);
          } catch (err) {}
        };

        ws.onerror = () => {
          if (isMounted) setCallState('failed');
        };
      } catch (err) {
        if (isMounted) setCallState('failed');
      }
    }

    initCall();

    return () => {
      isMounted = false;
      cleanup();
    };
  }, []);

  const createPeerConnection = async () => {
    if (pcRef.current) return pcRef.current;
    const rtc = getWebRTC();
    if (!rtc.RTCPeerConnection) return null;

    const pc = new rtc.RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;

    if (localStreamRef.current && localStreamRef.current.getTracks().length > 0) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    } else {
      try { pc.addTransceiver('audio', { direction: 'sendrecv' }); } catch (_) {}
    }

    pc.ontrack = (event) => {
      if (Platform.OS === 'web') {
        let audioEl = document.getElementById('web-voice-remote-audio');
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.id = 'web-voice-remote-audio';
          audioEl.autoplay = true;
          document.body.appendChild(audioEl);
        }
        if (event.streams && event.streams[0]) {
          audioEl.srcObject = event.streams[0];
        } else if (event.track) {
          audioEl.srcObject = new MediaStream([event.track]);
        }
        audioEl.play().catch(() => {});
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN && sessionIdRef.current) {
        const payload = event.candidate.toJSON ? event.candidate.toJSON() : {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        };
        wsRef.current.send(JSON.stringify({
          type: 'ice_candidate',
          session_id: sessionIdRef.current,
          candidate: payload,
        }));
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallState('connected');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setCallState('ended');
      }
    };

    return pc;
  };

  const drainIceCandidates = async () => {
    const rtc = getWebRTC();
    if (pcRef.current && pcRef.current.remoteDescription && rtc.RTCIceCandidate) {
      while (iceQueueRef.current.length > 0) {
        const cand = iceQueueRef.current.shift();
        try {
          await pcRef.current.addIceCandidate(new rtc.RTCIceCandidate(cand));
        } catch (_) {}
      }
    }
  };

  const handleSignaling = async (data) => {
    const rtc = getWebRTC();
    switch (data.type) {
      case 'session_created': {
        sessionIdRef.current = data.session_id;
        break;
      }

      case 'call_accepted': {
        sessionIdRef.current = data.session_id;
        // Instantly transition caller UI to connected
        setCallState('connected');
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}

        const pc = await createPeerConnection();
        if (!pc) return;

        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
        await pc.setLocalDescription(offer);

        wsRef.current?.send(JSON.stringify({
          type: 'offer',
          session_id: sessionIdRef.current,
          sdp: offer.sdp,
        }));
        break;
      }

      case 'offer': {
        sessionIdRef.current = data.session_id;
        // Instantly transition callee UI to connected
        setCallState('connected');
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}

        const pc = await createPeerConnection();
        if (!pc) return;

        const desc = rtc.RTCSessionDescription
          ? new rtc.RTCSessionDescription({ type: 'offer', sdp: data.sdp })
          : { type: 'offer', sdp: data.sdp };

        await pc.setRemoteDescription(desc);
        await drainIceCandidates();

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        wsRef.current?.send(JSON.stringify({
          type: 'answer',
          session_id: sessionIdRef.current,
          sdp: answer.sdp,
        }));
        break;
      }

      case 'answer': {
        if (pcRef.current) {
          const desc = rtc.RTCSessionDescription
            ? new rtc.RTCSessionDescription({ type: 'answer', sdp: data.sdp })
            : { type: 'answer', sdp: data.sdp };
          await pcRef.current.setRemoteDescription(desc);
          await drainIceCandidates();
        }
        break;
      }

      case 'ice_candidate': {
        if (data.candidate) {
          const candPayload = data.candidate.candidate ? data.candidate : {
            candidate: data.candidate,
            sdpMid: data.sdpMid,
            sdpMLineIndex: data.sdpMLineIndex,
          };
          if (pcRef.current && pcRef.current.remoteDescription && rtc.RTCIceCandidate) {
            try {
              await pcRef.current.addIceCandidate(new rtc.RTCIceCandidate(candPayload));
            } catch (_) {}
          } else {
            iceQueueRef.current.push(candPayload);
          }
        }
        break;
      }

      case 'call_rejected': {
        setCallState('rejected');
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch (_) {}
        setTimeout(() => onEndCall?.(), 1500);
        break;
      }

      case 'call_ended': {
        setCallState('ended');
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch (_) {}
        setTimeout(() => onEndCall?.(), 1200);
        break;
      }
    }
  };

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (Platform.OS === 'web') {
      const el = document.getElementById('web-voice-remote-audio');
      if (el) el.remove();
    }
  };

  const handleAccept = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (_) {}
    setCallState('connected');
    if (wsRef.current?.readyState === WebSocket.OPEN && sessionIdRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'call_accept',
        session_id: sessionIdRef.current,
      }));
    }
  };

  const handleReject = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (_) {}
    if (wsRef.current?.readyState === WebSocket.OPEN && sessionIdRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'call_reject',
        session_id: sessionIdRef.current,
      }));
    }
    setCallState('rejected');
    cleanup();
    setTimeout(() => onEndCall?.(), 800);
  };

  const handleEnd = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch (_) {}
    if (wsRef.current?.readyState === WebSocket.OPEN && sessionIdRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'call_end',
        session_id: sessionIdRef.current,
      }));
    }
    setCallState('ended');
    cleanup();
    setTimeout(() => onEndCall?.(), 800);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
      }
    }
  };

  const toggleSpeaker = () => {
    setIsSpeaker(prev => !prev);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const photoUri = fixMediaUrl(targetUser?.photo_url || targetUser?.photo);
  const displayName = targetUser?.full_name || targetUser?.name || 'Staff Member';
  const designation = targetUser?.designation || 'Conference Team';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      <LinearGradient
        colors={['#0F172A', '#1E293B', '#090D16']}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.topBar}>
        <View style={styles.secureBadge}>
          <Ionicons name="shield-checkmark" size={14} color="#10B981" />
          <Text style={styles.secureText}>IITD Direct Voice Relay</Text>
        </View>
      </View>

      <View style={styles.centerSection}>
        <Animated.View
          style={[
            styles.avatarGlow,
            { transform: [{ scale: pulseAnim }] },
            callState === 'connected' && styles.avatarGlowActive,
          ]}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarLetter}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </Animated.View>

        <Text style={styles.callerName} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={styles.callerRole}>{designation}</Text>

        <View style={styles.statusContainer}>
          {callState === 'calling' && (
            <Text style={styles.statusText}>Connecting...</Text>
          )}
          {callState === 'incoming' && (
            <Text style={[styles.statusText, { color: '#38BDF8' }]}>
              Incoming Voice Call...
            </Text>
          )}
          {callState === 'connected' && (
            <View style={styles.timerRow}>
              <View style={styles.liveDot} />
              <Text style={styles.timerText}>{formatTime(duration)}</Text>
            </View>
          )}
          {callState === 'rejected' && (
            <Text style={[styles.statusText, { color: '#EF4444' }]}>
              Call Declined
            </Text>
          )}
          {callState === 'ended' && (
            <Text style={[styles.statusText, { color: '#94A3B8' }]}>
              Call Ended
            </Text>
          )}
          {callState === 'failed' && (
            <Text style={[styles.statusText, { color: '#EF4444' }]}>
              Connection Failed
            </Text>
          )}
        </View>
      </View>

      <View style={styles.bottomControls}>
        {callState === 'incoming' ? (
          <View style={styles.incomingControls}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.declineBtn]}
              onPress={handleReject}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={32} color="#FFF" />
              <Text style={styles.actionBtnLabel}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.acceptBtn]}
              onPress={handleAccept}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={30} color="#FFF" />
              <Text style={styles.actionBtnLabel}>Accept</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.activeControls}>
            <View style={styles.controlRow}>
              <TouchableOpacity
                style={[styles.circleBtn, isMuted && styles.circleBtnActive]}
                onPress={toggleMute}
                disabled={callState !== 'connected'}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isMuted ? 'mic-off' : 'mic'}
                  size={24}
                  color={isMuted ? '#EF4444' : '#FFF'}
                />
                <Text style={styles.circleBtnLabel}>
                  {isMuted ? 'Unmute' : 'Mute'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.circleBtn, isSpeaker && styles.circleBtnActive]}
                onPress={toggleSpeaker}
                disabled={callState !== 'connected'}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isSpeaker ? 'volume-high' : 'volume-medium'}
                  size={24}
                  color={isSpeaker ? '#38BDF8' : '#FFF'}
                />
                <Text style={styles.circleBtnLabel}>Speaker</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.endCallBtn}
              onPress={handleEnd}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  topBar: {
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    alignItems: 'center',
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    gap: 6,
  },
  secureText: {
    color: '#10B981',
    fontSize: FONT.xs,
    fontWeight: '600',
  },
  centerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACE.xl,
  },
  avatarGlow: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACE.lg,
    borderWidth: 3,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  avatarGlowActive: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.brandLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: '#FFF',
    fontSize: 44,
    fontWeight: '700',
  },
  callerName: {
    color: '#FFF',
    fontSize: FONT.xl,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  callerRole: {
    color: '#94A3B8',
    fontSize: FONT.sm,
    textAlign: 'center',
    marginBottom: SPACE.lg,
  },
  statusContainer: {
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    color: '#CBD5E1',
    fontSize: FONT.base,
    fontWeight: '500',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  timerText: {
    color: '#FFF',
    fontSize: FONT.lg,
    fontWeight: '600',
    letterSpacing: 1,
  },
  bottomControls: {
    paddingBottom: Platform.OS === 'ios' ? 48 : 36,
    paddingHorizontal: SPACE.xl,
  },
  incomingControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  actionBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineBtn: {
    backgroundColor: '#EF4444',
  },
  acceptBtn: {
    backgroundColor: '#10B981',
  },
  actionBtnLabel: {
    color: '#FFF',
    fontSize: FONT.xs,
    fontWeight: '600',
    marginTop: 4,
  },
  activeControls: {
    alignItems: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 36,
    marginBottom: SPACE.xl,
  },
  circleBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  circleBtnLabel: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 4,
  },
  endCallBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
});
