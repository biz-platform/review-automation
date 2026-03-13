"use client";

import { Badge } from "@/components/ui/badge";
import { isReplyExpired } from "@/entities/review/lib/review-utils";

export interface ReplyStatusBadgeProps {
  platformReplyContent: string | null;
  writtenAt: string | null;
  platform?: string;
}

export function ReplyStatusBadge({
  platformReplyContent,
  writtenAt,
  platform,
}: ReplyStatusBadgeProps) {
  const expired = isReplyExpired(writtenAt, platform);
  const pillClass = "rounded-full px-3.5 py-2";
  if (expired)
    return (
      <Badge variant="reviewExpired" className={pillClass}>
        기한만료
      </Badge>
    );
  if (platformReplyContent)
    return (
      <Badge variant="reviewAnswered" className={pillClass}>
        답변완료
      </Badge>
    );
  return (
    <Badge variant="reviewUnanswered" className={pillClass}>
      미답변
    </Badge>
  );
}
