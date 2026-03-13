import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/shared/Providers";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://oliview.kr";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "올리뷰 | AI 리뷰 댓글 관리",
  description: "다중 매장 리뷰 수집·답글 반자동화",
  icons: {
    icon: [
      { url: "/landing/img/favicon/favicon.ico", sizes: "any" },
      {
        url: "/landing/img/favicon/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/landing/img/favicon/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
    ],
    apple: "/landing/img/favicon/apple-icon.png",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "올리뷰",
    title: "올리뷰 | AI 리뷰 댓글 관리",
    description: "다중 매장 리뷰 수집·답글 반자동화",
    images: [
      {
        url: "/landing/img/ogImage.jpg",
        width: 1200,
        height: 630,
        alt: "올리뷰",
      },
    ],
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "올리뷰 | AI 리뷰 댓글 관리",
    description: "다중 매장 리뷰 수집·답글 반자동화",
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
        <Providers>
          <ErrorBoundary>{children}</ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
