import React, { useRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Stars, Trail } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store/useStore';

// ─── Constants ───────────────────────────────────────────────────────────────
const REGIME_COLORS = {
  0: { primary: '#3B82F6', secondary: '#1D4ED8', glow: '#60A5FA', name: 'MEAN-REVERTING' },
  1: { primary: '#F59E0B', secondary: '#D97706', glow: '#FCD34D', name: 'TRENDING' },
  2: { primary: '#EF4444', secondary: '#B91C1C', glow: '#FCA5A5', name: 'TOXIC FLOW' },
};

// ─── Ambient Particle Field ───────────────────────────────────────────────────
const ParticleField = ({ regime }: { regime: number }) => {
  const count = 300;
  const meshRef = useRef<THREE.Points>(null);
  const colors = REGIME_COLORS[regime as keyof typeof REGIME_COLORS];

  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20 - 10;
      vel[i * 3 + 0] = (Math.random() - 0.5) * 0.01;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.005;
      vel[i * 3 + 2] = 0;
    }
    return [pos, vel];
  }, []);

  const particleColor = useMemo(() => new THREE.Color(colors.glow), [colors.glow]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const posAttr = meshRef.current.geometry.attributes.position;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      posAttr.array[i * 3 + 0] += velocities[i * 3 + 0];
      posAttr.array[i * 3 + 1] += velocities[i * 3 + 1] + Math.sin(t * 0.3 + i) * 0.0015;
      // Wrap around
      if (posAttr.array[i * 3 + 0] > 30) posAttr.array[i * 3 + 0] = -30;
      if (posAttr.array[i * 3 + 0] < -30) posAttr.array[i * 3 + 0] = 30;
      if (posAttr.array[i * 3 + 1] > 15) posAttr.array[i * 3 + 1] = -15;
    }
    posAttr.needsUpdate = true;
    if (meshRef.current.material instanceof THREE.PointsMaterial) {
      // Pulse opacity based on regime
      meshRef.current.material.opacity =
        regime === 2
          ? 0.4 + Math.sin(t * 4) * 0.15
          : 0.25 + Math.sin(t * 1.2) * 0.05;
    }
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.12}
        color={particleColor}
        transparent
        opacity={0.25}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
};

// ─── Instanced Order Book Bars ────────────────────────────────────────────────
const DepthSurface = ({
  bids,
  asks,
  regime,
}: {
  bids: any[];
  asks: any[];
  regime: number;
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colors = REGIME_COLORS[regime as keyof typeof REGIME_COLORS];

  const levels = useMemo(() => {
    const b = [...bids].slice(0, 20).reverse().map((l) => ({ ...l, type: 'bid' }));
    const a = [...asks].slice(0, 20).map((l) => ({ ...l, type: 'ask' }));
    return [...b, ...a];
  }, [bids, asks]);

  const count = Math.max(levels.length, 1);

  const bidColor = useMemo(() => new THREE.Color('#10D994'), []);
  const askColor = useMemo(() => new THREE.Color('#FF4466'), []);

  useFrame((state) => {
    if (!meshRef.current || levels.length === 0) return;
    const t = state.clock.elapsedTime;
    const maxQty = Math.max(...levels.map((l) => l.qty), 0.01);

    levels.forEach((level, i) => {
      const h = Math.max((level.qty / maxQty) * 6, 0.05);
      const x = (i - count / 2) * 1.15;

      // Alive micro-animation: slight Y sway per bar
      const sway = Math.sin(t * 1.5 + i * 0.4) * 0.04;

      dummy.position.set(x, h / 2 + sway, 0);
      dummy.scale.set(0.85, h, 0.85);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      // Color: bids=green, asks=red. Desaturate slightly at non-toxic regimes
      const base = level.type === 'bid' ? bidColor : askColor;
      meshRef.current!.setColorAt(i, base);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  if (count === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        toneMapped={false}
        roughness={0.2}
        metalness={0.7}
        envMapIntensity={1}
      />
    </instancedMesh>
  );
};

// ─── Glowing Mid-Line ─────────────────────────────────────────────────────────
const MidSpreadLine = ({ bids, asks }: { bids: any[]; asks: any[] }) => {
  const ref = useRef<THREE.Mesh>(null);

  const midPrice = useMemo(() => {
    if (!bids.length || !asks.length) return 0;
    return (bids[0]?.price + asks[0]?.price) / 2;
  }, [bids, asks]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    if (ref.current.material instanceof THREE.MeshStandardMaterial) {
      ref.current.material.emissiveIntensity = 0.8 + Math.sin(t * 2) * 0.3;
    }
  });

  return (
    <mesh ref={ref} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[45, 0.06]} />
      <meshStandardMaterial
        color="#FFFFFF"
        emissive="#FFFFFF"
        emissiveIntensity={0.8}
        toneMapped={false}
        transparent
        opacity={0.25}
      />
    </mesh>
  );
};

// ─── Floating Regime Label ────────────────────────────────────────────────────
const RegimeLabel = ({ regime, probs }: { regime: number; probs: number[] }) => {
  const ref = useRef<THREE.Group>(null);
  const colors = REGIME_COLORS[regime as keyof typeof REGIME_COLORS];
  const color = new THREE.Color(colors.glow);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.y = 8.5 + Math.sin(state.clock.elapsedTime * 0.8) * 0.15;
  });

  const confidenceText = probs.length
    ? `${(Math.max(...probs) * 100).toFixed(1)}% confidence`
    : '';

  return (
    <group ref={ref} position={[0, 8.5, 0]}>
      <Text
        color={colors.glow}
        fontSize={0.7}
        fontWeight={700}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
      >
        {colors.name}
      </Text>
      <Text
        color="#94A3B8"
        fontSize={0.35}
        anchorX="center"
        anchorY="middle"
        position={[0, -0.9, 0]}
        letterSpacing={0.05}
      >
        {confidenceText}
      </Text>
    </group>
  );
};

// ─── Dynamic Lighting Rig ─────────────────────────────────────────────────────
const LightingRig = ({ regime }: { regime: number }) => {
  const keyLight = useRef<THREE.SpotLight>(null);
  const fillLight = useRef<THREE.PointLight>(null);
  const colors = REGIME_COLORS[regime as keyof typeof REGIME_COLORS];
  const targetColor = useMemo(() => new THREE.Color(colors.primary), [colors.primary]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (keyLight.current) {
      keyLight.current.color.lerp(targetColor, delta * 1.8);
      keyLight.current.intensity =
        regime === 2
          ? 1.8 + Math.sin(t * 5) * 0.6  // rapid toxic pulse
          : regime === 1
          ? 1.2 + Math.sin(t * 1.5) * 0.2 // gentle trend pulse
          : 0.9;                            // calm MR
    }
    if (fillLight.current) {
      fillLight.current.color.lerp(targetColor, delta * 1.0);
      fillLight.current.intensity = 0.5 + Math.sin(t * 0.5) * 0.1;
    }
  });

  return (
    <>
      <ambientLight intensity={0.25} color="#1E293B" />
      <spotLight
        ref={keyLight}
        position={[-15, 18, 10]}
        intensity={1.2}
        color={colors.primary}
        penumbra={0.8}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight
        ref={fillLight}
        position={[15, 8, -5]}
        intensity={0.5}
        color={colors.secondary}
        distance={40}
      />
      {/* Rim light always cold blue-purple for depth */}
      <pointLight position={[0, -4, 12]} intensity={0.35} color="#7C3AED" />
    </>
  );
};

// ─── Camera Auto-Orbit ────────────────────────────────────────────────────────
const CameraRig = ({ regime }: { regime: number }) => {
  const { camera } = useThree();
  const targetPos = useMemo(
    () =>
      regime === 2
        ? new THREE.Vector3(0, 7, 14)  // closer, more dramatic for toxic
        : new THREE.Vector3(0, 6, 18),
    [regime]
  );

  useFrame((state, delta) => {
    camera.position.lerp(targetPos, delta * 0.5);
    // Very slow drift
    camera.position.x = Math.sin(state.clock.elapsedTime * 0.05) * 2;
  });

  return null;
};

// ─── Floor Grid ───────────────────────────────────────────────────────────────
const FloorGrid = ({ regime }: { regime: number }) => {
  const ref = useRef<THREE.GridHelper>(null);
  const colors = REGIME_COLORS[regime as keyof typeof REGIME_COLORS];

  useFrame((state, delta) => {
    if (ref.current) {
      // @ts-ignore
      ref.current.material.opacity = THREE.MathUtils.lerp(
        // @ts-ignore
        ref.current.material.opacity,
        0.35,
        delta * 2
      );
    }
  });

  return (
    // @ts-ignore — drei gridHelper props accepted
    <gridHelper
      ref={ref}
      args={[50, 40, colors.primary, '#1E293B']}
      position={[0, -0.15, 0]}
    />
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const OrderBook3D: React.FC = () => {
  const bids = useStore((state) => state.bids);
  const asks = useStore((state) => state.asks);
  const regime = useStore((state) => state.regime);
  const probs = useStore((state) => state.probs);
  const isConnected = useStore((state) => state.isConnected);
  const colors = REGIME_COLORS[regime as keyof typeof REGIME_COLORS];

  return (
    <div className="w-full h-full min-h-[300px] rounded-xl overflow-hidden relative border border-slate-700/40 shadow-2xl"
      style={{
        background: 'linear-gradient(135deg, #020617 0%, #0a0f1e 60%, #060a14 100%)',
        boxShadow: `0 0 40px ${colors.glow}18, 0 0 80px ${colors.glow}08`,
      }}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 px-4 py-3 flex justify-between items-start pointer-events-none"
        style={{ background: 'linear-gradient(180deg, rgba(2,6,23,0.85) 0%, transparent 100%)' }}
      >
        <div>
          <h2 className="text-base font-bold tracking-[0.2em] uppercase"
            style={{ color: colors.glow, textShadow: `0 0 12px ${colors.glow}60` }}
          >
            Live Depth Topography
          </h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] mt-0.5">
            Real-time Order Book · {bids.length + asks.length} Levels
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full animate-pulse"
            style={{ background: isConnected ? '#10D994' : '#EF4444', boxShadow: `0 0 8px ${isConnected ? '#10D994' : '#EF4444'}` }}
          />
          <span className="text-[10px] font-semibold tracking-widest uppercase"
            style={{ color: isConnected ? '#10D994' : '#EF4444' }}
          >
            {isConnected ? 'LIVE' : 'RECONNECTING'}
          </span>
        </div>
      </div>

      {/* Regime badge bottom-left */}
      <div className="absolute bottom-3 left-4 z-10 pointer-events-none">
        <div
          className="px-3 py-1 rounded-full text-[10px] font-bold tracking-[0.2em] uppercase"
          style={{
            background: `${colors.primary}22`,
            border: `1px solid ${colors.primary}55`,
            color: colors.glow,
            textShadow: `0 0 8px ${colors.glow}80`,
          }}
        >
          {colors.name}
        </div>
      </div>

      {/* Signal pills bottom-right */}
      <div className="absolute bottom-3 right-4 z-10 flex gap-2 pointer-events-none">
        {probs.map((p, i) => (
          <div
            key={i}
            className="px-2 py-0.5 rounded text-[9px] font-semibold tracking-wider"
            style={{
              background: `${['#3B82F6', '#F59E0B', '#EF4444'][i]}${Math.round(p * 80).toString(16).padStart(2, '0')}`,
              color: ['#93C5FD', '#FCD34D', '#FCA5A5'][i],
              border: `1px solid ${['#3B82F6', '#F59E0B', '#EF4444'][i]}44`,
            }}
          >
            {['MR', 'TRD', 'TOX'][i]} {(p * 100).toFixed(0)}%
          </div>
        ))}
      </div>

      <Canvas
        camera={{ position: [0, 6, 18], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        shadows
        dpr={[1, 1.5]}
      >
        <fog attach="fog" args={['#020617', 25, 55]} />
        <LightingRig regime={regime} />
        <CameraRig regime={regime} />

        <ParticleField regime={regime} />
        <DepthSurface bids={bids} asks={asks} regime={regime} />
        <MidSpreadLine bids={bids} asks={asks} />
        <RegimeLabel regime={regime} probs={probs} />
        <FloorGrid regime={regime} />

        <OrbitControls
          enableDamping
          dampingFactor={0.06}
          enableZoom
          minPolarAngle={Math.PI / 5}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={8}
          maxDistance={35}
          rotateSpeed={0.4}
        />
      </Canvas>
    </div>
  );
};
