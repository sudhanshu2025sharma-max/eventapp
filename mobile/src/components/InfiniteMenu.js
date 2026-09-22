import React, { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import {
  View, StyleSheet, Dimensions, Image, Text,
  PanResponder, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GradientAvatar } from '../components';

const { width: SW, height: SH } = Dimensions.get('window');
const MAX_NODES = 350;
const MAX_PAINT = 45;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

function qMul(a, b) {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}
function qConj(q) { return { x: -q.x, y: -q.y, z: -q.z, w: q.w }; }
function qNorm(q) {
  const l = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w) || 1;
  return { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l };
}
function qRot(q, vx, vy, vz) {
  const qv = { x: vx, y: vy, z: vz, w: 0 };
  return qMul(qMul(q, qv), qConj(q));
}
function qAxis(ax, ay, az, ang) {
  const h = ang * 0.5;
  const s = Math.sin(h);
  const l = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
  return { x: (ax / l) * s, y: (ay / l) * s, z: (az / l) * s, w: Math.cos(h) };
}

function fibonacciSphere(n, radius) {
  const pts = new Array(n);
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / Math.max(1, n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = GOLDEN * i;
    pts[i] = {
      x: Math.cos(th) * r * radius,
      y: y * radius,
      z: Math.sin(th) * r * radius,
    };
  }
  return pts;
}

const Disc = memo(function Disc({ x, y, r, a, z, uri, name }) {
  const size = r * 2;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - r,
        top: y - r,
        width: size,
        height: size,
        borderRadius: r,
        opacity: a,
        zIndex: (z * 50) | 0,
        overflow: 'hidden',
        backgroundColor: '#e2e8f0',
        borderWidth: 2.5,
        borderColor: '#fff',
        elevation: 3,
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} />
      ) : (
        <GradientAvatar name={name || '?'} size={size} radius={r} />
      )}
    </View>
  );
}, (p, n) =>
  p.x === n.x && p.y === n.y && p.r === n.r && p.a === n.a &&
  p.uri === n.uri && p.name === n.name
);

export default function InfiniteMenu({ items = [], onSelectPerson, style }) {
  const people = useMemo(() => (items || []).slice(0, MAX_NODES), [items]);
  const n = people.length;

  const radius = useMemo(() => {
    if (n <= 10) return 1.15;
    if (n <= 60) return 1.25;
    if (n <= 120) return 1.35;
    return 1.45;
  }, [n]);

  const verts = useMemo(() => (n ? fibonacciSphere(n, radius) : []), [n, radius]);

  const [discs, setDiscs] = useState([]);
  const rootRef = useRef(null);
  const origin = useRef({ x: 0, y: 0 }); // window offset of root
  const ori = useRef({ x: 0, y: 0, z: 0, w: 1 });
  const vel = useRef({ x: 0.0032, y: 0.0018 });
  const dragging = useRef(false);
  const lastTouch = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const discsRef = useRef([]);
  const peopleRef = useRef(people);
  const vertsRef = useRef(verts);
  const raf = useRef(0);
  const acc = useRef(0);
  const idleFrames = useRef(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const onSelectRef = useRef(onSelectPerson);
  onSelectRef.current = onSelectPerson;

  peopleRef.current = people;
  vertsRef.current = verts;

  const PROJ = n > 1000 ? 78 : n > 40 ? 88 : 96;
  const BASE_R = n > 85 ? 0.18 : n > 40 ? 0.2 : 0.24;
  const CAM_Z = 2.5;
  const CX = SW * 0.5;
  const CY = Math.min(SH * 0.36, 260);

  const measureOrigin = useCallback(() => {
    rootRef.current?.measureInWindow?.((x, y) => {
      origin.current = { x: x || 0, y: y || 0 };
    });
  }, []);

  const project = useCallback(() => {
    const list = peopleRef.current;
    const vs = vertsRef.current;
    const count = list.length;
    if (!count) return [];

    const q = ori.current;
    const buf = [];

    for (let i = 0; i < count; i++) {
      const v = vs[i];
      const w = qRot(q, v.x, v.y, v.z);
      if (w.z < -radius * 0.15) continue;

      const p = CAM_Z / (CAM_Z - w.z);
      const sx = CX + w.x * p * PROJ;
      const sy = CY - w.y * p * PROJ;
      const zf = (Math.abs(w.z) / radius) * 0.35 + 0.65;
      let r = zf * BASE_R * p * PROJ;
      if (count > 100) r *= 0.85;
      r = Math.max(12, Math.min(36, r));
      const a = Math.max(0.22, Math.min(1, (w.z / radius) * 0.5 + 0.55));
      const person = list[i];
      buf.push({
        x: sx, y: sy, r, a,
        z: w.z + radius,
        uri: person.profile_photo_url || null,
        name: person.name || '',
        id: person.id,
        person,
        idx: i,
      });
    }

    buf.sort((a, b) => b.z - a.z);
    return buf.length > MAX_PAINT ? buf.slice(0, MAX_PAINT) : buf;
  }, [radius, PROJ, BASE_R, CAM_Z, CX, CY]);

  const pushDiscs = useCallback(() => {
    const next = project();
    discsRef.current = next;
    setDiscs(next);
  }, [project]);

  useEffect(() => {
    let alive = true;
    let last = Date.now();
    measureOrigin();

    const tick = () => {
      if (!alive) return;
      const now = Date.now();
      const dt = Math.min(40, now - last);
      last = now;
      const ts = dt / 16;

      if (!dragging.current) {
        const rx = qAxis(0, 1, 0, vel.current.x * ts);
        const ry = qAxis(1, 0, 0, vel.current.y * ts);
        ori.current = qNorm(qMul(qMul(rx, ry), ori.current));
        vel.current.x = vel.current.x * 0.975 + 0.0032 * 0.025;
        vel.current.y = vel.current.y * 0.975 + 0.0018 * 0.025;
        const speed = Math.abs(vel.current.x) + Math.abs(vel.current.y);
        if (speed < 0.0035) idleFrames.current++;
        else idleFrames.current = 0;
      } else {
        idleFrames.current = 0;
      }

      if (idleFrames.current > 10 && !dragging.current) {
        raf.current = requestAnimationFrame(tick);
        return;
      }

      acc.current += dt;
      const budget = dragging.current ? 40 : 70;
      if (acc.current >= budget) {
        acc.current = 0;
        pushDiscs();
      }
      raf.current = requestAnimationFrame(tick);
    };

    pushDiscs();
    raf.current = requestAnimationFrame(tick);
    return () => {
      alive = false;
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [pushDiscs, n, measureOrigin]);

  useEffect(() => {
    idleFrames.current = 0;
    pushDiscs();
  }, [people, verts, pushDiscs]);

  const setInteract = (on) => {
    Animated.spring(scaleAnim, {
      toValue: on ? 1.12 : 1,
      friction: 6,
      tension: 140,
      useNativeDriver: true,
    }).start();
  };

  // page coords → local (accounts for scale transform around center)
  const toLocal = (pageX, pageY) => {
    const sc = dragging.current ? 1.12 : 1;
    const ox = origin.current.x;
    const oy = origin.current.y;
    const lx = pageX - ox;
    const ly = pageY - oy;
    // inverse of scale about component center
    const cx = SW * 0.5;
    const cy = (SH * 0.5); // approx; stage is full flex area
    return {
      x: cx + (lx - cx) / sc,
      y: cy + (ly - cy) / sc,
    };
  };

  const hitTest = (pageX, pageY) => {
    const { x, y } = toLocal(pageX, pageY);
    const list = discsRef.current;
    // front-first; slightly generous hit radius
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      const dx = x - d.x;
      const dy = y - d.y;
      const rr = d.r + 6;
      if (dx * dx + dy * dy <= rr * rr) return d;
    }
    return null;
  };

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 3,
    onPanResponderGrant: (e) => {
      measureOrigin();
      dragging.current = true;
      moved.current = false;
      idleFrames.current = 0;
      lastTouch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
      setInteract(true);
    },
    onPanResponderMove: (e) => {
      const x = e.nativeEvent.pageX;
      const y = e.nativeEvent.pageY;
      const dx = x - lastTouch.current.x;
      const dy = y - lastTouch.current.y;
      if (dx * dx + dy * dy > 9) moved.current = true;
      lastTouch.current = { x, y };

      const f = 0.007;
      const ry = qAxis(0, 1, 0, dx * f);
      const rx = qAxis(1, 0, 0, -dy * f);
      ori.current = qNorm(qMul(qMul(ry, rx), ori.current));
      vel.current = { x: dx * 0.004, y: -dy * 0.004 };
      idleFrames.current = 0;
    },
    onPanResponderRelease: (e) => {
      dragging.current = false;
      setInteract(false);
      if (!moved.current) {
        const hit = hitTest(e.nativeEvent.pageX, e.nativeEvent.pageY);
        if (hit?.person) {
          // defer so scale spring doesn't eat the press
          setTimeout(() => onSelectRef.current?.(hit.person), 30);
        }
      }
    },
    onPanResponderTerminate: () => {
      dragging.current = false;
      setInteract(false);
    },
  }), [measureOrigin]);

  if (!n) {
    return (
      <View style={[styles.root, style]}>
        <Ionicons name="planet-outline" size={40} color="#cbd5e1" />
        <Text style={styles.emptyT}>No attendees yet</Text>
      </View>
    );
  }

  return (
    <View
      ref={rootRef}
      onLayout={measureOrigin}
      style={[styles.root, style]}
      {...pan.panHandlers}
    >
      <Animated.View
        style={[styles.stage, { transform: [{ scale: scaleAnim }] }]}
        pointerEvents="none"
      >
        <View style={styles.glow} />
        {discs.map((d) => (
          <Disc
            key={d.id != null ? String(d.id) : 'i' + d.idx}
            x={d.x}
            y={d.y}
            r={d.r}
            a={d.a}
            z={d.z}
            uri={d.uri}
            name={d.name}
          />
        ))}
      </Animated.View>

      <View style={styles.hud} pointerEvents="none">
        <Text style={styles.countT}>{n} people</Text>
        <Text style={styles.hintT}>Drag to explore · Tap a face to connect</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff', overflow: 'hidden' },
  stage: { ...StyleSheet.absoluteFillObject },
  glow: {
    position: 'absolute',
    top: Math.min(SH * 0.36, 260) - 70,
    left: SW * 0.5 - 70,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(226,232,240,0.45)',
  },
  hud: {
    position: 'absolute', bottom: 110, left: 0, right: 0,
    alignItems: 'center', gap: 4,
  },
  countT: { fontSize: 11, fontWeight: '800', color: '#64748b', letterSpacing: 0.4 },
  hintT: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  emptyT: { marginTop: 10, fontSize: 14, fontWeight: '700', color: '#94a3b8', textAlign: 'center' },
});
