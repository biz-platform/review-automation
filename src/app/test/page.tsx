import type { Metadata } from "next";
import { TestPageHero } from "@/components/three/TestPageHero";

export const metadata: Metadata = {
  title: "3D 히어로 테스트",
  robots: { index: false, follow: false },
};

export default function TestPage() {
  return <TestPageHero />;
}
