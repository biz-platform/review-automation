import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/shared/Providers";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { RefReferralStorage } from "@/components/shared/RefReferralStorage";
import { getPublicSiteOrigin } from "@/lib/config/public-site";

const siteUrl = getPublicSiteOrigin();

export const metadata: Metadata = {
  title: "올리뷰 | AI 리뷰 댓글 관리",
  icons: {
    icon: "/logo.webp",
  },
  description:
    "다중 매장 리뷰 수집·답글 자동화. 배달의민족, 쿠팡이츠 등 여러 플랫폼의 리뷰 관리와 AI 답글을 한곳에서.",
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
      "다중 매장 리뷰 수집·답글 자동화. 배달의민족, 쿠팡이츠 등 여러 플랫폼의 리뷰 관리와 AI 답글을 한곳에서.",
    images: ["/logo.webp"],
    siteName: "올리뷰",
    url: siteUrl,
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "올리뷰 | AI 리뷰 댓글 관리",
    description:
      "다중 매장 리뷰 수집·답글 자동화. 배달의민족, 쿠팡이츠 등 여러 플랫폼의 리뷰 관리와 AI 답글을 한곳에서.",
    images: ["/logo.webp"],
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
