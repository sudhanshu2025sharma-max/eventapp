import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity,
  Animated, Easing, Modal, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';
import { COLORS, FONT, SPACE, RADIUS, SHADOW } from '../theme';
import { apiFetch } from '../api';

const { width: W, height: H } = Dimensions.get('window');
const CARD_W = W * 0.88;
const CARD_H = 500;

export default function OnboardingGuideScreen({ visible, onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasShaken, setHasShaken] = useState(false);

  // Animations
  const scrollX = useRef(new Animated.Value(0)).current;
  const slideRef = useRef(null);
  const cardScale = useRef(new Animated.Value(0.9)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  
  // Continuous Motion
  const floatAnim = useRef(new Animated.Value(0)).current;
  const wiggleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Mount Animation
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(cardScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true })
      ]).start();
      startContinuousAnimations();
    } else {
      cardScale.setValue(0.9);
      cardOpacity.setValue(0);
      setHasShaken(false);
      setCurrentIndex(0);
    }
  }, [visible]);

  const startContinuousAnimations = () => {
    // Floating (Slide 1 & 3)
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -12, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Pulsing glow (Slide 1 & 3)
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Wiggling (Slide 2 phone)
    Animated.loop(
      Animated.sequence([
        Animated.timing(wiggleAnim, { toValue: 15, duration: 100, useNativeDriver: true }),
        Animated.timing(wiggleAnim, { toValue: -15, duration: 100, useNativeDriver: true }),
        Animated.timing(wiggleAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
        Animated.timing(wiggleAnim, { toValue: -10, duration: 100, useNativeDriver: true }),
        Animated.timing(wiggleAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
        Animated.delay(1000)
      ])
    ).start();
  };

  // Hardware Shake Detection
  useEffect(() => {
    let subscription;
    if (visible && currentIndex === 1 && !hasShaken) {
      Accelerometer.setUpdateInterval(100);
      subscription = Accelerometer.addListener(({ x, y, z }) => {
        const acceleration = Math.sqrt(x * x + y * y + z * z);
        if (acceleration > 2.0) { // Shake threshold
          handleShakeSuccess();
        }
      });
    }
    return () => {
      subscription && subscription.remove();
    };
  }, [visible, currentIndex, hasShaken]);

  const handleShakeSuccess = () => {
    setHasShaken(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {}
  };

  const handleNext = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    
    if (currentIndex < 2) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      slideRef.current?.scrollTo({ x: nextIdx * CARD_W, animated: true });
    } else {
      finishOnboarding();
    }
  };

  const finishOnboarding = async () => {
    // 1. Immediately dismiss UI
    onComplete && onComplete();

    // 2. Persist backend status in background
    try {
      await apiFetch('/auth/complete-guide/', {
        method: 'POST',
        body: JSON.stringify({ found_easter_egg: hasShaken }),
      });
    } catch (e) {
      console.log('complete-guide error', e);
    }
  };

  if (!visible) return null;

  const wiggleRotate = wiggleAnim.interpolate({
    inputRange: [-15, 15],
    outputRange: ['-15deg', '15deg']
  });

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={st.overlay}>
        <Animated.View style={[st.card, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}>
          
          <Animated.ScrollView
            ref={slideRef}
            horizontal
            pagingEnabled
            scrollEnabled={false} // Disable manual swipe to enforce reading
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
          >
            {/* SLIDE 1: DIGITAL BADGE */}
            <View style={st.slide}>
              <View style={st.visualArea}>
                <View style={st.visualBgDeco} />
                <Animated.View style={[st.glowPulse, { transform: [{ scale: pulseAnim }], backgroundColor: 'rgba(14,165,233,0.15)' }]} />
                <Animated.View style={[st.iconWrapper, { transform: [{ translateY: floatAnim }] }]}>
                  <LinearGradient colors={['#38bdf8', '#0284c7']} style={st.iconGradient}>
                    <Ionicons name="qr-code" size={48} color="#fff" />
                  </LinearGradient>
                </Animated.View>
              </View>
              <View style={st.textArea}>
                <Text style={st.subtitle}>YOUR ALL-IN-ONE PASS</Text>
                <Text style={st.title}>Digital Badge</Text>
                <Text style={st.description}>
                  No paper tickets needed. Present your dynamic QR code for instant venue access and automated meal service redemptions.
                </Text>
              </View>
            </View>

            {/* SLIDE 2: SHAKE TO CONNECT */}
            <View style={st.slide}>
              <View style={st.visualArea}>
                <View style={[st.visualBgDeco, { backgroundColor: '#fdf2f8' }]} />
                
                {hasShaken ? (
                  // SHAKEN STATE (SUCCESS)
                  <Animated.View style={[st.iconWrapper, { transform: [{ scale: cardScale }] }]}>
                    <LinearGradient colors={['#10b981', '#059669']} style={st.iconGradient}>
                      <Ionicons name="checkmark-done" size={54} color="#fff" />
                    </LinearGradient>
                  </Animated.View>
                ) : (
                  // IDLE STATE (WIGGLE)
                  <Animated.View style={[st.iconWrapper, { transform: [{ rotate: wiggleRotate }] }]}>
                    <LinearGradient colors={['#f43f5e', '#be123c']} style={st.iconGradient}>
                      <Ionicons name="phone-portrait" size={48} color="#fff" />
                    </LinearGradient>
                  </Animated.View>
                )}
                
                <View style={[st.interactionBox, hasShaken && { backgroundColor: '#d1fae5', borderColor: '#34d399' }]}>
                  <Ionicons name={hasShaken ? "sparkles" : "hardware-chip"} size={16} color={hasShaken ? "#059669" : "#e11d48"} />
                  <Text style={[st.interactionText, hasShaken && { color: '#059669' }]}>
                    {hasShaken ? "Magic! 10 points unlocked." : "Try it out! Shake your phone."}
                  </Text>
                </View>

              </View>
              <View style={st.textArea}>
                <Text style={[st.subtitle, { color: '#e11d48' }]}>INSTANT NETWORKING</Text>
                <Text style={st.title}>Shake to Connect</Text>
                <Text style={st.description}>
                  Met someone interesting? Just shake your phones together to instantly swap contact cards and connect.
                </Text>
              </View>
            </View>

            {/* SLIDE 3: GAMIFICATION */}
            <View style={st.slide}>
              <View style={st.visualArea}>
                <View style={[st.visualBgDeco, { backgroundColor: '#fffbeb' }]} />
                <Animated.View style={[st.glowPulse, { transform: [{ scale: pulseAnim }], backgroundColor: 'rgba(245,158,11,0.15)' }]} />
                <Animated.View style={[st.iconWrapper, { transform: [{ translateY: floatAnim }] }]}>
                  <LinearGradient colors={['#fbbf24', '#d97706']} style={st.iconGradient}>
                    <Ionicons name="trophy" size={48} color="#fff" />
                  </LinearGradient>
                </Animated.View>
              </View>
              <View style={st.textArea}>
                <Text style={[st.subtitle, { color: '#d97706' }]}>CONFERENCE EXPERIENCE</Text>
                <Text style={st.title}>Explore & Earn</Text>
                <Text style={st.description}>
                  Visit sponsor stalls, check into campus selfie spots, and attend live sessions to earn points and top the leaderboard.
                </Text>
              </View>
            </View>

          </Animated.ScrollView>

          {/* BOTTOM CONTROLS */}
          <View style={st.controls}>
            <View style={st.dotsContainer}>
              {[0, 1, 2].map((idx) => (
                <View key={idx} style={[st.dot, currentIndex === idx && st.dotActive]} />
              ))}
            </View>

            <TouchableOpacity 
              style={st.primaryBtn} 
              onPress={handleNext}
              activeOpacity={0.8}
            >
              <Text style={st.primaryBtnText}>
                {currentIndex === 2 ? 'Get Started' : 'Next'}
              </Text>
              <Ionicons name={currentIndex === 2 ? "arrow-forward" : "chevron-forward"} size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* SKIP BUTTON (Only on slide 1 and 2) */}
          {currentIndex < 2 && (
            <TouchableOpacity style={st.skipBtn} onPress={finishOnboarding}>
              <Text style={st.skipBtnText}>Skip tour</Text>
            </TouchableOpacity>
          )}
          
        </Animated.View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: {
    flex: 1, 
    backgroundColor: 'rgba(15, 23, 42, 0.85)', // Deep brand translucent blur
    justifyContent: 'center', 
    alignItems: 'center'
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: '#ffffff',
    borderRadius: 32,
    overflow: 'hidden',
    ...SHADOW.xl,
    elevation: 20,
  },
  slide: {
    width: CARD_W,
    height: CARD_H,
  },
  
  // VISUAL HALF (TOP)
  visualArea: {
    height: 240,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  visualBgDeco: {
    position: 'absolute',
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: '#f0f9ff', // Light blue default
  },
  glowPulse: {
    position: 'absolute',
    width: 140, height: 140, borderRadius: 70,
  },
  iconWrapper: {
    ...SHADOW.lg,
  },
  iconGradient: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
  },
  
  // Shake Interaction Box
  interactionBox: {
    position: 'absolute', bottom: -16,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff1f2',
    paddingHorizontal: SPACE.md, paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: '#fda4af',
    ...SHADOW.sm,
  },
  interactionText: {
    fontSize: 12, fontWeight: FONT.w8, color: '#e11d48'
  },

  // TEXT HALF (BOTTOM)
  textArea: {
    padding: SPACE.xl,
    paddingTop: SPACE.xxl,
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 10, fontWeight: FONT.w9, color: '#0284c7', 
    letterSpacing: 1.5, marginBottom: SPACE.sm,
  },
  title: {
    fontSize: 24, fontWeight: FONT.w9, color: COLORS.text, 
    marginBottom: SPACE.md, textAlign: 'center'
  },
  description: {
    fontSize: 14, fontWeight: FONT.w5, color: COLORS.textSec, 
    textAlign: 'center', lineHeight: 22,
  },

  // CONTROLS
  controls: {
    position: 'absolute', bottom: 32, left: SPACE.xl, right: SPACE.xl,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
  },
  dotsContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 6
  },
  dot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#cbd5e1'
  },
  dotActive: {
    width: 20, backgroundColor: COLORS.brand
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.brandDeep,
    paddingHorizontal: SPACE.xl, paddingVertical: 12,
    borderRadius: RADIUS.full,
  },
  primaryBtnText: {
    fontSize: 14, fontWeight: FONT.w8, color: '#fff'
  },
  
  skipBtn: {
    position: 'absolute', top: SPACE.xl, right: SPACE.xl,
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  skipBtnText: {
    fontSize: 11, fontWeight: FONT.w7, color: COLORS.textTer
  }
});
