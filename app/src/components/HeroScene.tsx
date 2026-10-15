import { useMemo, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { ContactShadows, Float, RoundedBox } from "@react-three/drei"
import * as THREE from "three"
import { useReducedMotion } from "motion/react"

function DigitalDesk({ reducedMotion, compact }: { reducedMotion: boolean; compact: boolean }) {
  const group = useRef<THREE.Group>(null)
  const lime = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c9f66c", roughness: 0.45 }), [])

  useFrame((state, delta) => {
    if (!group.current || reducedMotion) return
    const targetX = state.pointer.y * 0.13 - 0.1
    const targetY = state.pointer.x * 0.18 - 0.2
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, targetX, 4, delta)
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, targetY, 4, delta)
  })

  return (
    <Float speed={reducedMotion ? 0 : 1.4} rotationIntensity={reducedMotion ? 0 : 0.08} floatIntensity={reducedMotion ? 0 : 0.22}>
      <group ref={group} rotation={[-0.08, -0.2, 0.02]} position={[0, compact ? -0.12 : -0.25, 0]} scale={compact ? 0.72 : 1}>
        <RoundedBox args={[3.25, 0.14, 2.05]} radius={0.1} smoothness={4} position={[0, -0.72, 0.32]} rotation={[-0.09, 0, 0]}>
          <meshStandardMaterial color="#b8c3d8" metalness={0.72} roughness={0.25} />
        </RoundedBox>
        <RoundedBox args={[1.05, 0.025, 0.68]} radius={0.04} position={[0.55, -0.62, 0.24]} rotation={[-0.09, 0, 0]}>
          <meshStandardMaterial color="#9aa8c0" metalness={0.6} roughness={0.35} />
        </RoundedBox>
        <group position={[0, 0.42, -0.55]} rotation={[-0.05, 0, 0]}>
          <RoundedBox args={[3.03, 2.25, 0.13]} radius={0.13} smoothness={4}>
            <meshStandardMaterial color="#0a1022" metalness={0.55} roughness={0.25} />
          </RoundedBox>
          <RoundedBox args={[2.78, 2.02, 0.035]} radius={0.09} smoothness={4} position={[0, 0, 0.08]}>
            <meshStandardMaterial color="#173fd0" roughness={0.32} />
          </RoundedBox>
          <RoundedBox args={[1.1, 0.62, 0.04]} radius={0.06} position={[0.62, 0.48, 0.11]}>
            <primitive object={lime} attach="material" />
          </RoundedBox>
          {[-0.58, -0.12, 0.34].map((x, index) => (
            <RoundedBox key={x} args={[0.34, 0.34, 0.04]} radius={0.05} position={[x, -0.32, 0.11]}>
              <meshStandardMaterial color={index === 1 ? "#c9f66c" : "#7190ff"} roughness={0.4} />
            </RoundedBox>
          ))}
        </group>

        <Float speed={reducedMotion ? 0 : 2} rotationIntensity={reducedMotion ? 0 : 0.12} floatIntensity={reducedMotion ? 0 : 0.18}>
          <group position={[-1.48, 0.25, 0.38]} rotation={[0.02, 0.18, -0.08]}>
            <RoundedBox args={[1.55, 1.18, 0.12]} radius={0.09} smoothness={4}>
              <meshStandardMaterial color="#f7f9ff" roughness={0.38} />
            </RoundedBox>
            <mesh position={[-0.38, 0.15, 0.08]}>
              <cylinderGeometry args={[0.27, 0.27, 0.06, 40, 1, false, 0, Math.PI * 1.55]} />
              <meshStandardMaterial color="#2854ff" />
            </mesh>
            {[0.16, -0.08, -0.3].map((y, index) => (
              <RoundedBox key={y} args={[0.52 - index * 0.08, 0.055, 0.035]} radius={0.025} position={[0.35, y, 0.08]}>
                <meshStandardMaterial color={index === 0 ? "#c9f66c" : "#68738a"} />
              </RoundedBox>
            ))}
          </group>
        </Float>

        <Float speed={reducedMotion ? 0 : 1.7} rotationIntensity={reducedMotion ? 0 : 0.1} floatIntensity={reducedMotion ? 0 : 0.22}>
          <group position={[1.6, 0.15, 0.18]} rotation={[0.04, -0.22, 0.08]}>
            <RoundedBox args={[1.28, 1.65, 0.1]} radius={0.08} smoothness={4}>
              <meshStandardMaterial color="#f8fbff" roughness={0.35} />
            </RoundedBox>
            {[0.42, 0.16, -0.1, -0.36].map((y, index) => (
              <RoundedBox key={y} args={[0.76 - (index % 2) * 0.18, 0.06, 0.035]} radius={0.025} position={[0, y, 0.07]}>
                <meshStandardMaterial color={index === 0 ? "#2854ff" : "#58637a"} />
              </RoundedBox>
            ))}
          </group>
        </Float>

        <group position={[0.58, -0.38, 1.1]} rotation={[0.1, -0.12, 0]}>
          <RoundedBox args={[0.16, 0.72, 0.16]} radius={0.06} rotation={[0, 0, -0.68]} position={[-0.32, 0, 0]}>
            <meshStandardMaterial color="#c9f66c" metalness={0.18} roughness={0.4} />
          </RoundedBox>
          <RoundedBox args={[0.16, 0.72, 0.16]} radius={0.06} rotation={[0, 0, 0.68]} position={[0.32, 0, 0]}>
            <meshStandardMaterial color="#c9f66c" metalness={0.18} roughness={0.4} />
          </RoundedBox>
          <RoundedBox args={[0.14, 0.88, 0.16]} radius={0.06} rotation={[0, 0, 0.18]}>
            <meshStandardMaterial color="#2854ff" metalness={0.25} roughness={0.34} />
          </RoundedBox>
        </group>
      </group>
    </Float>
  )
}

export function HeroSceneCanvas({ compact = false }: { compact?: boolean }) {
  const reducedMotion = Boolean(useReducedMotion())
  return (
    <Canvas
      aria-label="Objek 3D perangkat kerja digital yang mengikuti gerak pointer"
      camera={{ position: [0, compact ? 0.18 : 0.35, compact ? 5.1 : 5.6], fov: compact ? 48 : 42 }}
      dpr={reducedMotion ? 1 : [1, 1.5]}
      frameloop={reducedMotion ? "demand" : "always"}
      gl={{ antialias: !reducedMotion, alpha: true, powerPreference: "high-performance" }}
    >
      <ambientLight intensity={1.5} />
      <directionalLight position={[4, 6, 5]} intensity={3.2} color="#ffffff" />
      <pointLight position={[-4, 1, 3]} intensity={5} color="#6180ff" />
      <DigitalDesk reducedMotion={reducedMotion} compact={compact} />
      <ContactShadows position={[0, -1.1, 0]} opacity={0.32} scale={6.5} blur={2.4} far={3.5} resolution={reducedMotion ? 128 : 256} />
    </Canvas>
  )
}
