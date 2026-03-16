import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/shared/Providers";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { RefReferralStorage } from "@/components/shared/RefReferralStorage";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  "https://oliview.kr";

export const metadata: Metadata = {
  title: "올리뷰 | AI 리뷰 댓글 관리",
  icons: {
    icon: "/logo.svg",
  },
  description: "다중 플랫폼 리뷰 수집·답글 자동화.",
  metadataBase: new URL(siteUrl),
  keywords: [
    "올리뷰",
    "리뷰 관리",
    "AI 리뷰",
    "리뷰 답글",
    "리뷰 자동화",
    "리뷰 답글 자동화",
  ].join(", "),
  openGraph: {
    title: "올리뷰 | AI 리뷰 댓글 관리",
    description:
      "다중 매장 리뷰 수집·답글 반자동화. 네이버 플레이스, 카카오맵 등 리뷰 관리와 AI 답글을 한곳에서.",
    images: ["/landing/img/ogImage.jpg"],
    siteName: "올리뷰",
    url: siteUrl,
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "올리뷰 | AI 리뷰 댓글 관리",
    description:
      "다중 매장 리뷰 수집·답글 반자동화. 네이버 플레이스, 카카오맵 등 리뷰 관리와 AI 답글을 한곳에서.",
    images: ["/landing/img/ogImage.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <RefReferralStorage />
        <Providers>
          <ErrorBoundary>{children}</ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
