"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Center, Float, OrbitControls, useGLTF } from "@react-three/drei";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

/** Khronos 샘플 Duck GLB — 같은 오리진이라 fetch/CORS 이슈 없음 */
const DEFAULT_HERO_MODEL_PATH = "/models/hero-duck.glb";

const heroModelUrl =
  process.env.NEXT_PUBLIC_TEST_HERO_GLTF_URL?.trim() || DEFAULT_HERO_MODEL_PATH;

useGLTF.preload(heroModelUrl);

function HeroCharacter() {
  const { scene } = useGLTF(heroModelUrl);
  return (
    <Float speed={1.85} rotationIntensity={0.14} floatIntensity={0.42}>
      <Center>
        <primitive object={scene} scale={0.45} />
      </Center>
    </Float>
  );
}

export function TestPageHero() {
  return (
    <Card
      padding="none"
      variant="default"
      className={cn(
        "relative h-dvh w-full max-w-none overflow-hidden rounded-none border-0 bg-linear-to-br from-[#2a1845] via-[#151028] to-[#0c1224] p-0 shadow-none",
      )}
    >
      <Canvas
        className="absolute inset-0 h-full w-full touch-none"
        dpr={[1, 2]}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        }}
        camera={{ position: [0, 0.35, 2.75], fov: 40 }}
      >
        <ambientLight intensity={0.85} />
        <directionalLight position={[4.5, 6, 3]} intensity={1.35} />
        <Suspense
          fallback={
            <mesh>
              <sphereGeometry args={[0.06, 16, 16]} />
              <meshStandardMaterial color="#c4b5fd" wireframe />
            </mesh>
          }
        >
          <HeroCharacter />
        </Suspense>
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={1}
          minPolarAngle={Math.PI / 3.25}
          maxPolarAngle={Math.PI / 2.02}
        />
      </Canvas>
      <Card
        padding="sm"
        variant="muted"
        className="pointer-events-none absolute bottom-6 left-1/2 z-10 max-w-[min(92vw,26rem)] -translate-x-1/2 rounded-full border-0 bg-black/40 px-5 py-3 text-center backdrop-blur-md"
      >
        <p className="typo-body-02-bold text-gray-08">3D 히어로 (테스트)</p>
        <p className="mt-1 typo-body-02-regular text-gray-07">
          궤도 자동 회전 + Float. 기본 모델은{" "}
          <em className="not-italic">public/models/hero-duck.glb</em>. 외부
          URL은{" "}
          <em className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[11px] not-italic text-gray-08">
            NEXT_PUBLIC_TEST_HERO_GLTF_URL
          </em>
        </p>
      </Card>
    </Card>
  );
}
