import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store/useStore';

const DepthSurface = ({ bids, asks }: { bids: any[], asks: any[] }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  // Combine and sort for visualization
  const levels = useMemo(() => {
    const b = [...bids].reverse().map(l => ({ ...l, type: 'bid' }));
    const a = [...asks].map(l => ({ ...l, type: 'ask' }));
    return [...b, ...a];
  }, [bids, asks]);

  const count = levels.length;
  
  // Create an instanced mesh for performance
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    if (!meshRef.current) return;
    
    let maxQty = Math.max(...levels.map(l => l.qty), 0.01);

    levels.forEach((level, i) => {
      // Normalize height
      const h = (level.qty / maxQty) * 5; 
      dummy.position.set((i - count / 2) * 1.2, h / 2, 0);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
      
      const color = new THREE.Color(level.type === 'bid' ? '#10B981' : '#EF4444');
      meshRef.current!.setColorAt(i, color);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  if (count === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <boxGeometry args={[1, 1, 4]} />
      <meshStandardMaterial toneMapped={false} />
    </instancedMesh>
  );
};

const DynamicLighting = () => {
  const regime = useStore(state => state.regime);
  const spotLightRef = useRef<THREE.SpotLight>(null);
  
  // Target colors based on regime (0=MR, 1=TREND, 2=TOXIC)
  const targetColor = useMemo(() => {
    if (regime === 2) return new THREE.Color('#EF4444'); // Red for Toxic
    if (regime === 1) return new THREE.Color('#F59E0B'); // Amber for Trend
    return new THREE.Color('#3B82F6'); // Blue for MR
  }, [regime]);

  useFrame((state, delta) => {
    if (spotLightRef.current) {
      // Smooth color transition
      spotLightRef.current.color.lerp(targetColor, delta * 2);
      // Pulsating intensity effect if Toxic
      if (regime === 2) {
        spotLightRef.current.intensity = 1 + Math.sin(state.clock.elapsedTime * 5) * 0.5;
      } else {
        spotLightRef.current.intensity = THREE.MathUtils.lerp(spotLightRef.current.intensity, 0.8, delta * 2);
      }
    }
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={0.5} />
      <spotLight 
        ref={spotLightRef}
        position={[-10, 10, -10]} 
        intensity={0.8} 
        color="#3B82F6" 
        penumbra={1}
      />
    </>
  );
};

export const OrderBook3D: React.FC = () => {
  const bids = useStore(state => state.bids);
  const asks = useStore(state => state.asks);

  return (
    <div className="w-full h-full min-h-[300px] bg-slate-900/50 rounded-xl overflow-hidden relative border border-slate-700/50 shadow-2xl backdrop-blur-md">
      <div className="absolute top-4 left-4 z-10">
        <h2 className="text-xl font-bold tracking-wider text-slate-200">5D TOPOGRAPHY</h2>
        <p className="text-xs text-slate-400 uppercase tracking-widest">Real-time Depth Surface + Dynamic Lighting</p>
      </div>
      
      <Canvas camera={{ position: [0, 5, 15], fov: 45 }}>
        <DynamicLighting />
        <DepthSurface bids={bids} asks={asks} />
        
        <OrbitControls 
          enableDamping 
          dampingFactor={0.05} 
          minPolarAngle={Math.PI / 4} 
          maxPolarAngle={Math.PI / 2.2}
        />
        
        {/* Base Grid */}
        <gridHelper args={[30, 30, '#334155', '#1e293b']} position={[0, -0.1, 0]} />
      </Canvas>
    </div>
  );
};
