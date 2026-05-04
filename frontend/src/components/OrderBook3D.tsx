import { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store/useStore';

// ─── Regime Config ────────────────────────────────────────────────────────────
const REGIME = {
  0: { primary: '#3B82F6', glow: '#60A5FA', name: 'MEAN-REVERTING', pulse: 0.8 },
  1: { primary: '#F59E0B', glow: '#FCD34D', name: 'TRENDING',       pulse: 1.5 },
  2: { primary: '#EF4444', glow: '#FCA5A5', name: 'TOXIC FLOW',     pulse: 5.0 },
} as const;

// ─── Particles ────────────────────────────────────────────────────────────────
function ParticleField({ regime }: { regime: number }) {
  const ref = useRef<THREE.Points>(null);
  const cfg = REGIME[regime as keyof typeof REGIME];
  const COUNT = 250;

  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const speeds = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 25;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 15 - 5;
      speeds[i] = 0.003 + Math.random() * 0.007;
    }
    return { positions, speeds };
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position.array as Float32Array;
    const t = clock.elapsedTime;
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] += speeds[i];
      pos[i * 3 + 1] += Math.sin(t * 0.4 + i) * 0.002;
      if (pos[i * 3] > 25) pos[i * 3] = -25;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
    const mat = ref.current.material as THREE.PointsMaterial;
    mat.opacity = regime === 2
      ? 0.35 + Math.sin(t * 4) * 0.12
      : 0.2 + Math.sin(t * 1.0) * 0.05;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={COUNT} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.1} color={cfg.glow} transparent opacity={0.2} sizeAttenuation depthWrite={false} />
    </points>
  );
}

// ─── Order Book Bars (instanced, FIXED COLORS) ────────────────────────────────
function DepthBars({ bids, asks }: { bids: any[]; asks: any[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const levels = useMemo(() => {
    const b = [...bids].slice(0, 18).reverse().map(l => ({ ...l, side: 'bid' }));
    const a = [...asks].slice(0, 18).map(l => ({ ...l, side: 'ask' }));
    return [...b, ...a];
  }, [bids, asks]);

  const count = Math.max(levels.length, 1);

  useFrame(({ clock }) => {
    if (!ref.current || levels.length === 0) return;
    const t = clock.elapsedTime;
    const maxQ = Math.max(...levels.map(l => l.qty), 0.01);

    levels.forEach((lv, i) => {
      const h = Math.max((lv.qty / maxQ) * 5.5, 0.08);
      const x = (i - count / 2) * 1.2;
      const sway = Math.sin(t * 1.2 + i * 0.5) * 0.03;

      dummy.position.set(x, h / 2 + sway, 0);
      dummy.scale.set(0.9, h, 0.9);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);

      // ✅ FIX: set color correctly using THREE.Color
      const col = new THREE.Color(lv.side === 'bid' ? '#10D994' : '#FF4466');
      ref.current!.setColorAt(i, col);
    });

    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  });

  if (count === 0) return null;

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        toneMapped={false}
        roughness={0.2}
        metalness={0.4}
        emissive="#000000"
      />
    </instancedMesh>
  );
}

// ─── Glowing Midline ─────────────────────────────────────────────────────────
function Midline() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.6 + Math.sin(clock.elapsedTime * 2.5) * 0.25;
  });
  return (
    <mesh ref={ref} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[48, 0.05]} />
      <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.6} transparent opacity={0.2} toneMapped={false} />
    </mesh>
  );
}

// ─── Regime Label ─────────────────────────────────────────────────────────────
function RegimeLabel({ regime, probs }: { regime: number; probs: number[] }) {
  const ref = useRef<THREE.Group>(null);
  const cfg = REGIME[regime as keyof typeof REGIME];
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = 8 + Math.sin(clock.elapsedTime * 0.7) * 0.12;
  });
  const conf = probs.length ? (Math.max(...probs) * 100).toFixed(1) : '0.0';
  return (
    <group ref={ref} position={[0, 8, 0]}>
      <Text color={cfg.glow} fontSize={0.65} anchorX="center" anchorY="middle" letterSpacing={0.1} fontWeight={700}>{cfg.name}</Text>
      <Text color="#64748B" fontSize={0.3} anchorX="center" anchorY="middle" position={[0, -0.85, 0]} letterSpacing={0.05}>{conf}% CONFIDENCE</Text>
    </group>
  );
}

// ─── Lighting ─────────────────────────────────────────────────────────────────
function Lights({ regime }: { regime: number }) {
  const key = useRef<THREE.SpotLight>(null);
  const fill = useRef<THREE.PointLight>(null);
  const cfg = REGIME[regime as keyof typeof REGIME];
  const target = useMemo(() => new THREE.Color(cfg.primary), [cfg.primary]);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    if (key.current) {
      key.current.color.lerp(target, delta * 2);
      key.current.intensity = regime === 2
        ? 1.6 + Math.sin(t * cfg.pulse) * 0.5
        : 1.0 + Math.sin(t * cfg.pulse) * 0.15;
    }
    if (fill.current) {
      fill.current.color.lerp(target, delta * 1.2);
    }
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <spotLight ref={key} position={[-12, 18, 8]} intensity={1.2} color={cfg.primary} penumbra={0.9} castShadow />
      <pointLight ref={fill} position={[12, 6, -4]} intensity={0.5} color={cfg.primary} distance={35} />
      <pointLight position={[0, -3, 10]} intensity={0.3} color="#7C3AED" />
    </>
  );
}

// ─── Camera Rig ───────────────────────────────────────────────────────────────
function CameraRig({ regime }: { regime: number }) {
  const { camera } = useThree();
  const target = useMemo(() => regime === 2 ? new THREE.Vector3(0, 6, 13) : new THREE.Vector3(0, 5.5, 17), [regime]);
  useFrame(({ clock }, delta) => {
    camera.position.lerp(target, delta * 0.4);
    camera.position.x = Math.sin(clock.elapsedTime * 0.04) * 1.5;
  });
  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export const OrderBook3D: React.FC = () => {
  const bids      = useStore(s => s.bids);
  const asks      = useStore(s => s.asks);
  const regime    = useStore(s => s.regime);
  const probs     = useStore(s => s.probs);
  const connected = useStore(s => s.isConnected);
  const cfg = REGIME[regime as keyof typeof REGIME];

  return (
    <div
      className="w-full h-full rounded-xl overflow-hidden relative"
      style={{
        background: 'linear-gradient(145deg,#020617 0%,#080d1a 100%)',
        border: '1px solid rgba(148,163,184,0.07)',
        boxShadow: `0 0 50px ${cfg.glow}14, 0 0 100px ${cfg.glow}06`,
      }}
    >
      {/* Header overlay */}
      <div className="absolute top-0 inset-x-0 z-10 flex justify-between items-start px-4 pt-3 pb-8 pointer-events-none"
        style={{ background: 'linear-gradient(180deg,rgba(2,6,23,0.9) 0%,transparent 100%)' }}>
        <div>
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase mb-0.5" style={{ color: cfg.glow }}>
            Live Depth Topography
          </p>
          <p className="text-[9px] text-slate-600 tracking-widest uppercase">
            {bids.length + asks.length} order book levels · BTC/USDT
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: connected ? '#10D994' : '#EF4444', boxShadow: `0 0 6px ${connected ? '#10D994' : '#EF4444'}` }} />
          <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: connected ? '#10D994' : '#EF4444' }}>
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Bottom overlays */}
      <div className="absolute bottom-3 inset-x-3 z-10 flex justify-between items-end pointer-events-none">
        <div className="px-2.5 py-1 rounded-full text-[9px] font-bold tracking-widest uppercase"
          style={{ background: `${cfg.primary}1A`, border: `1px solid ${cfg.primary}44`, color: cfg.glow }}>
          {cfg.name}
        </div>
        <div className="flex gap-1.5">
          {probs.map((p, i) => (
            <div key={i} className="px-2 py-0.5 rounded text-[8px] font-semibold"
              style={{
                background: `${['#3B82F6','#F59E0B','#EF4444'][i]}${Math.round(p * 70).toString(16).padStart(2,'0')}`,
                color: ['#93C5FD','#FCD34D','#FCA5A5'][i],
                border: `1px solid ${['#3B82F6','#F59E0B','#EF4444'][i]}33`,
              }}>
              {['MR','TR','TX'][i]} {(p*100).toFixed(0)}%
            </div>
          ))}
        </div>
      </div>

      <Canvas camera={{ position: [0, 5.5, 17], fov: 50 }} gl={{ antialias: true }} shadows dpr={[1, 1.5]}>
        <fog attach="fog" args={['#020617', 22, 50]} />
        <Lights regime={regime} />
        <CameraRig regime={regime} />
        <ParticleField regime={regime} />
        <DepthBars bids={bids} asks={asks} />
        <Midline />
        <RegimeLabel regime={regime} probs={probs} />
        <gridHelper args={[50, 40, cfg.primary, '#0F172A']} position={[0, -0.1, 0]} />
        <OrbitControls enableDamping dampingFactor={0.06} minPolarAngle={Math.PI / 5} maxPolarAngle={Math.PI / 2.1} minDistance={8} maxDistance={32} rotateSpeed={0.35} />
      </Canvas>
    </div>
  );
};
