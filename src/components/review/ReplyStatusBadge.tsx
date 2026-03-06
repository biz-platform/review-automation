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
  if (expired) return <Badge variant="expired">기한만료</Badge>;
  if (platformReplyContent) return <Badge variant="success">답변완료</Badge>;
  return <Badge variant="warning">미답변</Badge>;
}
