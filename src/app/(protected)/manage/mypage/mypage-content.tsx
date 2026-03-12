"use client";

import { useAccountProfile } from "@/lib/hooks/use-account-profile";
import { useFormattedPhone } from "@/lib/hooks/use-formatted-phone";
import { ContentStateMessage } from "@/components/ui/content-state-message";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const CELL_LABEL_CLASS =
  "typo-body-02-medium text-gray-01 border-b border-r border-border py-5 pl-4 align-middle w-40";
const CELL_VALUE_CLASS =
  "typo-body-02-regular text-gray-02 border-b border-border py-4 px-4 align-middle";

export function MypageContent() {
  const { data: profile, isLoading, isError } = useAccountProfile();
  const formattedPhone = useFormattedPhone(profile?.phone ?? null);

  if (isLoading) {
    return <ContentStateMessage variant="loading" message="로딩 중…" />;
  }

  if (isError || !profile) {
    return (
      <ContentStateMessage
        variant="error"
        message="계정 정보를 불러오지 못했습니다."
      />
    );
  }

  return (
    <div className="flex flex-col">
      <h1 className="typo-heading-02-bold text-gray-01 mb-8">내 계정 정보</h1>

      <Card
        variant="default"
        padding="none"
        className="w-full overflow-hidden"
      >
        <table className="w-full border-collapse">
          <tbody className="[&_tr:last-child_td]:border-b-0">
            <tr>
              <td className={CELL_LABEL_CLASS}>이메일</td>
              <td className={CELL_VALUE_CLASS}>{profile.email ?? "-"}</td>
            </tr>
            <tr>
              <td className={CELL_LABEL_CLASS}>휴대전화 번호</td>
              <td className={CELL_VALUE_CLASS}>{formattedPhone}</td>
            </tr>
            <tr>
              <td className={CELL_LABEL_CLASS}>비밀번호</td>
              <td className={CELL_VALUE_CLASS}>
                <div className="flex flex-1 items-center justify-between gap-4 py-0">
                  <span>계정 보안을 위해 인증 완료 후 변경 가능합니다</span>
                  <ButtonLink href="#" variant="secondary" size="md">
                    비밀번호 변경
                  </ButtonLink>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}
