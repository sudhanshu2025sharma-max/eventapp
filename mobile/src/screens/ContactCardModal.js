import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  Platform, Animated, Dimensions, Easing, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONT, SPACE, RADIUS, API_URL, API_HEADERS, fixMediaUrl } from '../theme';
import { GradientAvatar } from '../components';
import TopicPickerModal from './TopicPickerModal';

const { width: W, height: H } = Dimensions.get('window');

/* ─── Animated particle system ────────────────────────────────────────── */
function Particles({ active, color = '#fff' }) {
  const particles = useRef(
    Array.from({ length: 12 }, (_, i) => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      o: new Animated.Value(0),
      s: new Animated.Value(0),
      angle: (i / 12) * Math.PI * 2,
      dist: 60 + Math.random() * 80,
      size: 4 + Math.random() * 6,
    }))
  ).current;

  useEffect(() => {
    if (!active) return;
    particles.forEach((p, i) => {
      const delay = i * 50;
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(p.x, {
            toValue: Math.cos(p.angle) * p.dist,
            duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true,
          }),
          Animated.timing(p.y, {
            toValue: Math.sin(p.angle) * p.dist,
            duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(p.o, { toValue: 1, duration: 150, useNativeDriver: true }),
            Animated.delay(300),
            Animated.timing(p.o, { toValue: 0, duration: 250, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.spring(p.s, { toValue: 1, tension: 300, friction: 8, useNativeDriver: true }),
            Animated.timing(p.s, { toValue: 0, duration: 300, useNativeDriver: true }),
          ]),
        ]),
      ]).start();
    });
  }, [active]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute', alignSelf: 'center', top: '50%',
            width: p.size, height: p.size, borderRadius: p.size,
            backgroundColor: i % 3 === 0 ? '#fbbf24' : i % 3 === 1 ? '#60a5fa' : color,
            opacity: p.o,
            transform: [
              { translateX: p.x },
              { translateY: p.y },
              { scale: p.s },
            ],
          }}
        />
      ))}
    </View>
  );
}

/* ─── Orbiting rings around avatar ────────────────────────────────────── */
function OrbitRings({ active }) {
  const rot1 = useRef(new Animated.Value(0)).current;
  const rot2 = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      Animated.loop(Animated.timing(rot1, { toValue: 1, duration: 8000, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(Animated.timing(rot2, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true })),
    ]).start();
  }, [active]);

  const spin1 = rot1.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spin2 = rot2.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity, transform: [{ scale }] }]} pointerEvents="none">
      <Animated.View style={[_s.orbitRing, _s.orbit1, { transform: [{ rotate: spin1 }] }]}>
        <View style={[_s.orbitDot, { backgroundColor: '#60a5fa' }]} />
      </Animated.View>
      <Animated.View style={[_s.orbitRing, _s.orbit2, { transform: [{ rotate: spin2 }] }]}>
        <View style={[_s.orbitDot, { backgroundColor: '#a78bfa' }]} />
        <View style={[_s.orbitDot2, { backgroundColor: '#fbbf24' }]} />
      </Animated.View>
    </Animated.View>
  );
}

/* ─── Typing dots ─────────────────────────────────────────────────────── */
function TypingDots() {
  const dots = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    dots.forEach((d, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(d, { toValue: 1, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.delay(600),
        ])
      ).start();
    });
  }, []);

  return (
    <View style={_s.typingRow}>
      {dots.map((d, i) => (
        <Animated.View
          key={i}
          style={[_s.typingDot, {
            opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
            transform: [{ scale: d.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.2] }) }],
          }]}
        />
      ))}
    </View>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MAIN COMPONENT
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function ContactCardModal({ visible, onClose, onSent, sender, receiver, tokens }) {
  const [step, setStep]             = useState('preview');
  const [topicModal, setTopicModal] = useState(false);
  const [error, setError]           = useState('');

  // ── Entrance ───────────────────────────────────────────────────────
  const backdrop    = useRef(new Animated.Value(0)).current;
  const modalSlide  = useRef(new Animated.Value(H)).current;
  const modalScale  = useRef(new Animated.Value(0.85)).current;

  // ── Card ───────────────────────────────────────────────────────────
  const cardFloat   = useRef(new Animated.Value(0)).current;
  const cardTilt    = useRef(new Animated.Value(0)).current;
  const cardGlow    = useRef(new Animated.Value(0)).current;
  const shimmerX    = useRef(new Animated.Value(-W)).current;

  // ── Send flight ────────────────────────────────────────────────────
  const cardFlyX    = useRef(new Animated.Value(0)).current;
  const cardFlyY    = useRef(new Animated.Value(0)).current;
  const cardFlyRot  = useRef(new Animated.Value(0)).current;
  const cardFlyScale = useRef(new Animated.Value(1)).current;
  const cardFlyOp   = useRef(new Animated.Value(1)).current;

  // ── Trail particles ────────────────────────────────────────────────
  const trails = useRef(
    Array.from({ length: 8 }, () => ({
      x: new Animated.Value(0), y: new Animated.Value(0),
      o: new Animated.Value(0), s: new Animated.Value(0),
    }))
  ).current;

  // ── Sent celebration ───────────────────────────────────────────────
  const sentScale    = useRef(new Animated.Value(0)).current;
  const sentOp       = useRef(new Animated.Value(0)).current;
  const checkPop     = useRef(new Animated.Value(0)).current;
  const ringPulse    = useRef(new Animated.Value(0.8)).current;
  const confettiGo   = useRef(false);
  const [showParticles, setShowParticles] = useState(false);

  // ── Avatar entrance ────────────────────────────────────────────────
  const avatarScale  = useRef(new Animated.Value(0)).current;
  const avatarBounce = useRef(new Animated.Value(0)).current;
  const infoSlide    = useRef(new Animated.Value(30)).current;
  const infoOp       = useRef(new Animated.Value(0)).current;
  const tagAnims     = useRef(Array.from({ length: 6 }, () => ({
    s: new Animated.Value(0), o: new Animated.Value(0),
  }))).current;

  // ── Button ─────────────────────────────────────────────────────────
  const btnScale     = useRef(new Animated.Value(0.5)).current;
  const btnOp        = useRef(new Animated.Value(0)).current;
  const btnPulse     = useRef(new Animated.Value(1)).current;

  const resetAll = () => {
    backdrop.setValue(0); modalSlide.setValue(H); modalScale.setValue(0.85);
    cardFloat.setValue(0); cardTilt.setValue(0); cardGlow.setValue(0); shimmerX.setValue(-W);
    cardFlyX.setValue(0); cardFlyY.setValue(0); cardFlyRot.setValue(0);
    cardFlyScale.setValue(1); cardFlyOp.setValue(1);
    trails.forEach(t => { t.x.setValue(0); t.y.setValue(0); t.o.setValue(0); t.s.setValue(0); });
    sentScale.setValue(0); sentOp.setValue(0); checkPop.setValue(0); ringPulse.setValue(0.8);
    avatarScale.setValue(0); avatarBounce.setValue(0);
    infoSlide.setValue(30); infoOp.setValue(0);
    tagAnims.forEach(t => { t.s.setValue(0); t.o.setValue(0); });
    btnScale.setValue(0.5); btnOp.setValue(0); btnPulse.setValue(1);
    setShowParticles(false);
    confettiGo.current = false;
  };

  /* ── ENTRANCE CHOREOGRAPHY ──────────────────────────────────────────── */
  useEffect(() => {
    setStep('preview');
    setError('');
    resetAll();

    if (!visible) return;

    // 1. Backdrop fade + modal slide up
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(modalSlide, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
      Animated.spring(modalScale, { toValue: 1, tension: 65, friction: 11, useNativeDriver: true }),
    ]).start(() => {
      // 2. Avatar pops in
      Animated.spring(avatarScale, { toValue: 1, tension: 200, friction: 6, useNativeDriver: true }).start();
      Animated.sequence([
        Animated.delay(100),
        Animated.spring(avatarBounce, { toValue: 1, tension: 250, friction: 5, useNativeDriver: true }),
      ]).start();

      // 3. Info slides in
      Animated.parallel([
        Animated.timing(infoOp, { toValue: 1, duration: 400, delay: 150, useNativeDriver: true }),
        Animated.spring(infoSlide, { toValue: 0, tension: 120, friction: 12, delay: 150, useNativeDriver: true }),
      ]).start();

      // 4. Tags pop in staggered
      tagAnims.forEach((t, i) => {
        Animated.parallel([
          Animated.spring(t.s, { toValue: 1, tension: 200, friction: 8, delay: 300 + i * 80, useNativeDriver: true }),
          Animated.timing(t.o, { toValue: 1, duration: 200, delay: 300 + i * 80, useNativeDriver: true }),
        ]).start();
      });

      // 5. Button appears
      Animated.parallel([
        Animated.spring(btnScale, { toValue: 1, tension: 150, friction: 8, delay: 600, useNativeDriver: true }),
        Animated.timing(btnOp, { toValue: 1, duration: 300, delay: 600, useNativeDriver: true }),
      ]).start(() => {
        // 6. Button gentle pulse
        Animated.loop(Animated.sequence([
          Animated.timing(btnPulse, { toValue: 1.04, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(btnPulse, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])).start();
      });

      // 7. Card float + shimmer
      Animated.loop(Animated.sequence([
        Animated.timing(cardFloat, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(cardFloat, { toValue: 0, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])).start();

      Animated.loop(Animated.sequence([
        Animated.timing(cardTilt, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(cardTilt, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])).start();

      Animated.loop(Animated.sequence([
        Animated.timing(shimmerX, { toValue: W * 2, duration: 2500, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(shimmerX, { toValue: -W, duration: 0, useNativeDriver: true }),
        Animated.delay(2000),
      ])).start();

      Animated.loop(Animated.sequence([
        Animated.timing(cardGlow, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(cardGlow, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])).start();
    });
  }, [visible, receiver?.id]);

  /* ── SEND FLIGHT ANIMATION ──────────────────────────────────────────── */
  const runSendFlight = (onDone) => {
    setStep('sending');

    // Stop floating
    cardFloat.stopAnimation();
    cardTilt.stopAnimation();

    // Phase 1: Lift + tilt
    Animated.parallel([
      Animated.timing(cardFlyY, { toValue: -20, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(cardFlyScale, { toValue: 1.08, duration: 300, useNativeDriver: true }),
      Animated.timing(cardFlyRot, { toValue: 0.5, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      // Phase 2: Fly away with trail
      trails.forEach((t, i) => {
        const delay = i * 60;
        const angle = -0.3 + (Math.random() * 0.6);
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(t.o, { toValue: 0.8, duration: 100, useNativeDriver: true }),
            Animated.timing(t.s, { toValue: 1, duration: 100, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(t.x, { toValue: -40 - i * 15, duration: 400, useNativeDriver: true }),
            Animated.timing(t.y, { toValue: angle * 50, duration: 400, useNativeDriver: true }),
            Animated.timing(t.o, { toValue: 0, duration: 400, useNativeDriver: true }),
            Animated.timing(t.s, { toValue: 0.3, duration: 400, useNativeDriver: true }),
          ]),
        ]).start();
      });

      Animated.parallel([
        Animated.timing(cardFlyX, {
          toValue: W + 100, duration: 800,
          easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true,
        }),
        Animated.timing(cardFlyY, {
          toValue: -120, duration: 800,
          easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true,
        }),
        Animated.timing(cardFlyRot, {
          toValue: 2, duration: 800,
          easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true,
        }),
        Animated.timing(cardFlyScale, {
          toValue: 0.4, duration: 800, useNativeDriver: true,
        }),
        Animated.timing(cardFlyOp, {
          toValue: 0, duration: 600, delay: 200, useNativeDriver: true,
        }),
      ]).start(() => onDone?.());
    });
  };

  /* ── CELEBRATION ────────────────────────────────────────────────────── */
  const showCelebration = () => {
    setStep('sent');
    setShowParticles(true);

    // Big pop-in
    Animated.parallel([
      Animated.spring(sentScale, { toValue: 1, tension: 150, friction: 5, useNativeDriver: true }),
      Animated.timing(sentOp, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    // Check mark pop
    setTimeout(() => {
      Animated.spring(checkPop, { toValue: 1, tension: 300, friction: 4, useNativeDriver: true }).start();
    }, 200);

    // Ring pulse
    Animated.loop(Animated.sequence([
      Animated.timing(ringPulse, { toValue: 1.15, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(ringPulse, { toValue: 0.95, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  };

  /* ── CLOSE ANIMATION ────────────────────────────────────────────────── */
  const animateClose = () => {
    let closed = false;
    const finish = () => {
      if (closed) return;
      closed = true;
      onClose?.();
    };
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(modalSlide, { toValue: H, duration: 320, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(modalScale, { toValue: 0.85, duration: 320, useNativeDriver: true }),
    ]).start(({ finished }) => finish());
    // Failsafe: always unlock parent state so next open works
    setTimeout(finish, 400);
  };

  /* ── SEND HANDLER ───────────────────────────────────────────────────── */
  const handleTopicConfirmed = async ({ topic, custom_topic }) => {
    setTopicModal(false);
    runSendFlight(showCelebration);

    try {
      const res = await fetch(`${API_URL}/chat/requests/send/`, {
        method: 'POST',
        headers: { ...API_HEADERS, Authorization: `Bearer ${tokens?.access}` },
        body: JSON.stringify({
          receiver_id: receiver?.id, request_type: 'contact',
          topic, custom_topic,
        }),
      });
      const data = await res.json();
      if (!res.ok && !data.already_connected) {
        setError(data.error || 'Failed to send.');
        setStep('preview'); resetAll(); return;
      }
      if (onSent) onSent(data);
    } catch {
      setError('Network error.');
      setStep('preview'); resetAll();
    }
  };

  if (!sender || !receiver) return null;

  const interests = String(sender.research_interests || '').split(',').map(t => t.trim()).filter(Boolean);
  const receiverName = receiver.name || `${receiver.first_name || ''} ${receiver.last_name || ''}`.trim() || 'Attendee';
  const senderName = `${sender.first_name || ''} ${sender.last_name || ''}`.trim() || sender.name || 'You';
  // Accept profile_photo_url | photo | absolute/relative — fixMediaUrl is idempotent on full URLs
  const senderPhoto = fixMediaUrl(sender.profile_photo_url || sender.photo || null);
  const receiverPhoto = fixMediaUrl(receiver.profile_photo_url || receiver.photo || null);

  const flyRotate = cardFlyRot.interpolate({ inputRange: [0, 2], outputRange: ['0deg', '25deg'] });
  const floatY = cardFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const tiltDeg = cardTilt.interpolate({ inputRange: [0, 1], outputRange: ['-1.5deg', '1.5deg'] });
  const glowOp = cardGlow.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.8] });

  return (
    <>
      <Modal visible={visible} transparent animationType="none" onRequestClose={animateClose}>
        <View style={_s.root}>
          {/* Backdrop */}
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,4,18,0.85)', opacity: backdrop }]}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1}
              onPress={step === 'sent' ? animateClose : step === 'preview' ? animateClose : undefined} />
          </Animated.View>

          {/* Modal container */}
          <Animated.View style={[
            _s.modal,
            { transform: [{ translateY: modalSlide }, { scale: modalScale }] },
          ]}>
            {/* ── PREVIEW / SENDING ────────────────────────────────── */}
            {step !== 'sent' && (
              <>
                {/* Receiver strip */}
                <View style={_s.receiverStrip}>
                  <View style={_s.receiverInfo}>
                    <Text style={_s.sendingTo}>Sending your card to</Text>
                    <Text style={_s.receiverName}>{receiverName}</Text>
                  </View>
                  <TouchableOpacity style={_s.closeBtn} onPress={animateClose}>
                    <Ionicons name="close" size={20} color="#64748b" />
                  </TouchableOpacity>
                </View>

                {/* Connection visual */}
                <View style={_s.connectionVisual}>
                  {/* Sender avatar */}
                  <Animated.View style={[_s.personBubble, { transform: [{ scale: avatarScale }] }]}>
                    <OrbitRings active={visible && step === 'preview'} />
                    <View style={_s.avatarGlowWrap}>
                      <Animated.View style={[_s.avatarGlow, { opacity: glowOp }]} />
                      {senderPhoto ? (
                        <Image source={{ uri: senderPhoto }} style={_s.bigAvatar} />
                      ) : (
                        <GradientAvatar name={sender.first_name || sender.name || 'U'} size={72} radius={24} />
                      )}
                    </View>
                    <Text style={_s.personLabel}>You</Text>
                  </Animated.View>

                  {/* Connection line */}
                  <Animated.View style={[_s.connLine, { opacity: infoOp }]}>
                    {step === 'sending' ? (
                      <TypingDots />
                    ) : (
                      <>
                        <View style={_s.connDash} />
                        <View style={_s.connIcon}>
                          <Ionicons name="paper-plane" size={14} color={COLORS.brand} />
                        </View>
                        <View style={_s.connDash} />
                      </>
                    )}
                  </Animated.View>

                  {/* Receiver avatar */}
                  <Animated.View style={[_s.personBubble, {
                    opacity: infoOp,
                    transform: [{ translateX: infoSlide }],
                  }]}>
                    {receiverPhoto ? (
                      <Image source={{ uri: receiverPhoto }} style={_s.bigAvatar} />
                    ) : (
                      <GradientAvatar name={receiverName} size={72} radius={24} />
                    )}
                    <Text style={_s.personLabel} numberOfLines={1}>{receiver.first_name || receiverName.split(' ')[0]}</Text>
                  </Animated.View>
                </View>

                {/* The actual card */}
                <View style={_s.cardArea}>
                  <Animated.View style={[
                    _s.cardOuter,
                    {
                      opacity: cardFlyOp,
                      transform: [
                        { translateX: cardFlyX },
                        { translateY: Animated.add(cardFlyY, floatY) },
                        { scale: cardFlyScale },
                        { rotate: step === 'sending' ? flyRotate : tiltDeg },
                      ],
                    },
                  ]}>
                    <LinearGradient
                      colors={['#0a1e5e', '#0333b6', '#1a4fd4']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={_s.card}
                    >
                      {/* Shimmer */}
                      <Animated.View pointerEvents="none"
                        style={[_s.shimmer, { transform: [{ translateX: shimmerX }, { skewX: '-20deg' }] }]}
                      />
                      {/* Decorative blobs */}
                      <View style={_s.blob1} />
                      <View style={_s.blob2} />
                      <View style={_s.blob3} />

                      {/* Card content */}
                      <View style={_s.cardHeader}>
                        <View style={_s.cardHeaderLeft}>
                          {senderPhoto ? (
                            <Image source={{ uri: senderPhoto }} style={_s.cardAvatar} />
                          ) : (
                            <GradientAvatar name={sender.first_name || 'U'} size={48} radius={15} />
                          )}
                        </View>
                        <View style={_s.cardHeaderInfo}>
                          <Text style={_s.cardName}>{senderName}</Text>
                          {!!sender.designation && (
                            <Text style={_s.cardRole} numberOfLines={1}>{sender.designation}</Text>
                          )}
                          {!!sender.affiliation && (
                            <View style={_s.cardOrgRow}>
                              <Ionicons name="business" size={9} color="rgba(255,255,255,0.5)" />
                              <Text style={_s.cardOrg} numberOfLines={1}>{sender.affiliation}</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Research interests */}
                      {interests.length > 0 && (
                        <View style={_s.cardTags}>
                          {interests.slice(0, 4).map((t, i) => (
                            <Animated.View key={t} style={{
                              opacity: tagAnims[i]?.o || 1,
                              transform: [{ scale: tagAnims[i]?.s || 1 }],
                            }}>
                              <View style={_s.cardTag}>
                                <Text style={_s.cardTagT}>{t}</Text>
                              </View>
                            </Animated.View>
                          ))}
                        </View>
                      )}

                      {/* Footer */}
                      <View style={_s.cardDivider} />
                      <View style={_s.cardFooter}>
                        <Ionicons name="mail-outline" size={10} color="rgba(255,255,255,0.3)" />
                        <Text style={_s.cardEmail} numberOfLines={1}>{sender.email}</Text>
                        <View style={_s.confBadge}>
                          <Text style={_s.confBadgeT}>ETD 2026</Text>
                        </View>
                      </View>
                    </LinearGradient>
                  </Animated.View>

                  {/* Trail particles */}
                  {step === 'sending' && trails.map((t, i) => (
                    <Animated.View key={i} style={{
                      position: 'absolute', right: W * 0.3, top: '50%',
                      width: 6, height: 6, borderRadius: 3,
                      backgroundColor: i % 2 === 0 ? '#60a5fa' : '#a78bfa',
                      opacity: t.o,
                      transform: [{ translateX: t.x }, { translateY: t.y }, { scale: t.s }],
                    }} />
                  ))}
                </View>

                {/* Action area */}
                {step === 'preview' && (
                  <Animated.View style={[_s.actionArea, { opacity: btnOp, transform: [{ scale: btnScale }] }]}>
                    {/* Hint */}
                    <View style={_s.hint}>
                      <View style={_s.hintIcon}>
                        <Ionicons name="information-circle" size={16} color={COLORS.brand} />
                      </View>
                      <Text style={_s.hintText}>
                        {receiverName.split(' ')[0]} will review your card and decide to connect.
                      </Text>
                    </View>

                    {/* Send button */}
                    <Animated.View style={{ transform: [{ scale: btnPulse }] }}>
                      <TouchableOpacity
                        style={_s.sendBtn}
                        onPress={() => setTopicModal(true)}
                        activeOpacity={0.85}
                      >
                        <LinearGradient
                          colors={[COLORS.brand, '#1e40af']}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                          style={_s.sendBtnGrad}
                        >
                          <View style={_s.sendBtnIconWrap}>
                            <Ionicons name="paper-plane" size={18} color="#fff" />
                          </View>
                          <View>
                            <Text style={_s.sendBtnLabel}>Send Contact Card</Text>
                            <Text style={_s.sendBtnSub}>Choose a topic to start</Text>
                          </View>
                          <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.5)" style={{ marginLeft: 'auto' }} />
                        </LinearGradient>
                      </TouchableOpacity>
                    </Animated.View>

                    <TouchableOpacity onPress={animateClose} style={_s.cancelBtn} activeOpacity={0.7}>
                      <Text style={_s.cancelT}>Maybe later</Text>
                    </TouchableOpacity>
                  </Animated.View>
                )}

                {step === 'sending' && (
                  <View style={_s.sendingArea}>
                    <TypingDots />
                    <Text style={_s.sendingText}>Sending your card...</Text>
                  </View>
                )}
              </>
            )}

            {/* ── SENT CELEBRATION ──────────────────────────────────── */}
            {step === 'sent' && (
              <View style={_s.sentWrap}>
                <Particles active={showParticles} />

                {/* Success ring */}
                <Animated.View style={[_s.sentRingOuter, { transform: [{ scale: ringPulse }] }]}>
                  <Animated.View style={[_s.sentCircle, { transform: [{ scale: sentScale }], opacity: sentOp }]}>
                    <LinearGradient colors={['#10b981', '#059669']} style={_s.sentCircleGrad}>
                      <Animated.View style={{ transform: [{ scale: checkPop }] }}>
                        <Ionicons name="checkmark" size={44} color="#fff" />
                      </Animated.View>
                    </LinearGradient>
                  </Animated.View>
                </Animated.View>

                {/* Text */}
                <Animated.View style={{ opacity: sentOp, alignItems: 'center' }}>
                  <Text style={_s.sentH}>Card Delivered! 🎉</Text>
                  <Text style={_s.sentP}>
                    Your contact card was sent to{'\n'}
                    <Text style={_s.sentName}>{receiverName}</Text>
                  </Text>
                  <View style={_s.sentTimeline}>
                    <View style={_s.tlStep}>
                      <View style={[_s.tlDot, _s.tlDotDone]} >
                        <Ionicons name="checkmark" size={10} color="#fff" />
                      </View>
                      <Text style={_s.tlText}>Card sent</Text>
                    </View>
                    <View style={_s.tlLine} />
                    <View style={_s.tlStep}>
                      <View style={[_s.tlDot, _s.tlDotPending]}>
                        <Ionicons name="time" size={10} color={COLORS.accent} />
                      </View>
                      <Text style={_s.tlText}>Awaiting review</Text>
                    </View>
                    <View style={_s.tlLine} />
                    <View style={_s.tlStep}>
                      <View style={_s.tlDot}>
                        <Ionicons name="chatbubbles-outline" size={10} color="#94a3b8" />
                      </View>
                      <Text style={[_s.tlText, { color: '#94a3b8' }]}>Start chatting</Text>
                    </View>
                  </View>
                </Animated.View>

                {/* Done button */}
                <TouchableOpacity style={_s.doneBtn} onPress={animateClose} activeOpacity={0.85}>
                  <LinearGradient colors={[COLORS.brand, '#1e40af']} style={_s.doneBtnGrad}>
                    <Text style={_s.doneBtnT}>Done</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {/* Error */}
            {!!error && (
              <View style={_s.errorBar}>
                <Ionicons name="alert-circle" size={16} color={COLORS.error} />
                <Text style={_s.errorT}>{error}</Text>
                <TouchableOpacity onPress={() => setError('')}>
                  <Ionicons name="close" size={16} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </View>
      </Modal>

      <TopicPickerModal
        visible={topicModal}
        onClose={() => setTopicModal(false)}
        onConfirm={handleTopicConfirmed}
        title="What do you want to discuss?"
      />
    </>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   STYLES
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const _s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },

  modal: {
    backgroundColor: '#fff', borderRadius: 30,
    width: '100%', maxWidth: 420,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 30 }, shadowOpacity: 0.5, shadowRadius: 50 },
      android: { elevation: 30 }, default: {},
    }),
  },

  // ── Receiver strip ──────────────────────────────────────────────────
  receiverStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingTop: 22, paddingBottom: 10,
  },
  receiverInfo: {},
  sendingTo: { fontSize: 12, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  receiverName: { fontSize: 20, fontWeight: '900', color: '#0f172a', marginTop: 3, letterSpacing: -0.4 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
  },

  // ── Connection visual ───────────────────────────────────────────────
  connectionVisual: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 20, paddingHorizontal: 22, gap: 0,
  },
  personBubble: { alignItems: 'center', width: 90 },
  bigAvatar: { width: 72, height: 72, borderRadius: 24, borderWidth: 3, borderColor: '#e2e8f0' },
  personLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginTop: 8 },

  avatarGlowWrap: { position: 'relative' },
  avatarGlow: {
    position: 'absolute', top: -6, left: -6, right: -6, bottom: -6,
    borderRadius: 28, backgroundColor: COLORS.brand,
  },

  connLine: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 4 },
  connDash: { flex: 1, height: 2, backgroundColor: '#e2e8f0', borderRadius: 1 },
  connIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.brandLight, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },

  // ── Orbit rings ─────────────────────────────────────────────────────
  orbitRing: {
    position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(99,102,241,0.15)',
    borderStyle: 'dashed',
  },
  orbit1: { width: 100, height: 100, borderRadius: 50, top: -14, left: -5 },
  orbit2: { width: 130, height: 130, borderRadius: 65, top: -29, left: -20 },
  orbitDot: {
    position: 'absolute', width: 8, height: 8, borderRadius: 4, top: -4, left: '50%',
  },
  orbitDot2: {
    position: 'absolute', width: 6, height: 6, borderRadius: 3, bottom: -3, right: '30%',
  },

  // ── Card ─────────────────────────────────────────────────────────────
  cardArea: { paddingHorizontal: 22, paddingBottom: 16, position: 'relative' },
  cardOuter: {
    borderRadius: 22, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#0333b6', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.45, shadowRadius: 30 },
      android: { elevation: 16 }, default: {},
    }),
  },
  card: { padding: 20, borderRadius: 22, overflow: 'hidden' },
  shimmer: { position: 'absolute', top: 0, bottom: 0, width: 100, backgroundColor: 'rgba(255,255,255,0.06)' },
  blob1: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.04)', top: -60, right: -40 },
  blob2: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(245,158,11,0.06)', bottom: -30, left: -20 },
  blob3: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(139,92,246,0.05)', top: 20, right: 10 },

  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  cardHeaderLeft: {},
  cardAvatar: { width: 48, height: 48, borderRadius: 15, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  cardHeaderInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  cardRole: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontWeight: '600' },
  cardOrgRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  cardOrg: { fontSize: 11, color: 'rgba(255,255,255,0.45)', flex: 1, fontWeight: '500' },

  cardTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  cardTag: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  cardTagT: { fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },

  cardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 12 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardEmail: { fontSize: 11, color: 'rgba(255,255,255,0.3)', flex: 1 },
  confBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  confBadgeT: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },

  // ── Action area ─────────────────────────────────────────────────────
  actionArea: { paddingHorizontal: 22, paddingBottom: 22 },
  hint: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#f0f4ff', borderRadius: 14, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: '#dbe4ff',
  },
  hintIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  hintText: { fontSize: 13, color: '#475569', fontWeight: '500', flex: 1, lineHeight: 19 },

  sendBtn: { borderRadius: 18, overflow: 'hidden', marginBottom: 12 },
  sendBtnGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16, paddingHorizontal: 20, borderRadius: 18,
  },
  sendBtnIconWrap: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnLabel: { fontSize: 15, fontWeight: '800', color: '#fff' },
  sendBtnSub: { fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '500', marginTop: 2 },

  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelT: { fontSize: 14, color: '#94a3b8', fontWeight: '600' },

  // ── Sending state ───────────────────────────────────────────────────
  sendingArea: { alignItems: 'center', paddingBottom: 30, gap: 12 },
  sendingText: { fontSize: 14, color: '#94a3b8', fontWeight: '600' },

  // ── Typing dots ─────────────────────────────────────────────────────
  typingRow: { flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center' },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.brand },

  // ── Sent celebration ────────────────────────────────────────────────
  sentWrap: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 22, position: 'relative', overflow: 'hidden' },

  sentRingOuter: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#d1fae5',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  sentCircle: {
    width: 96, height: 96, borderRadius: 48,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#10b981', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20 },
      android: { elevation: 12 }, default: {},
    }),
  },
  sentCircleGrad: { flex: 1, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },

  sentH: { fontSize: 24, fontWeight: '900', color: '#0f172a', marginBottom: 10, letterSpacing: -0.5 },
  sentP: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 22, fontWeight: '500', marginBottom: 24 },
  sentName: { fontWeight: '800', color: COLORS.brand },

  // ── Timeline ────────────────────────────────────────────────────────
  sentTimeline: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f8fafc', borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 16,
    marginBottom: 28, borderWidth: 1, borderColor: '#e2e8f0',
    width: '100%',
  },
  tlStep: { alignItems: 'center', flex: 1, gap: 6 },
  tlDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#e2e8f0',
  },
  tlDotDone: { backgroundColor: '#10b981', borderColor: '#10b981' },
  tlDotPending: { backgroundColor: '#fef3c7', borderColor: '#fbbf24' },
  tlText: { fontSize: 10, fontWeight: '700', color: '#475569', textAlign: 'center' },
  tlLine: { width: 20, height: 2, backgroundColor: '#e2e8f0', borderRadius: 1 },

  doneBtn: { width: '100%', borderRadius: 18, overflow: 'hidden' },
  doneBtnGrad: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 18 },
  doneBtnT: { fontSize: 16, fontWeight: '800', color: '#fff' },

  // ── Error ───────────────────────────────────────────────────────────
  errorBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fee2e2', marginHorizontal: 22, marginBottom: 22,
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#fecaca',
  },
  errorT: { fontSize: 13, color: '#dc2626', fontWeight: '600', flex: 1 },
});