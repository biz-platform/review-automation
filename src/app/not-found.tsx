import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-08 px-4">
      <p className="typo-heading-01-bold text-gray-02">404</p>
      <p className="typo-body-01-regular text-gray-04">페이지를 찾을 수 없습니다.</p>
      <ButtonLink href="/" variant="primary" size="lg">
        홈으로
      </ButtonLink>
    </main>
  );
}
