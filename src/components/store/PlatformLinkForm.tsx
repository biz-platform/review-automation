"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export interface PlatformLinkFormProps {
  title: string;
  description: string;
  extra?: ReactNode;
  successMessage?: string;
  errorMessage?: string | null;
  username: string;
  onUsernameChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  placeholderId?: string;
  placeholderPw?: string;
  onLink: () => void;
  linking: boolean;
}

export function PlatformLinkForm({
  title,
  description,
  extra,
  successMessage,
  errorMessage,
  username,
  onUsernameChange,
  password,
  onPasswordChange,
  placeholderId = "아이디",
  placeholderPw = "비밀번호",
  onLink,
  linking,
}: PlatformLinkFormProps) {
  return (
    <Card padding="lg" className="max-w-md">
      <section>
        <h2 className="mb-4 text-lg font-bold">{title}</h2>
        {extra}
        <p className="mb-4 text-sm text-muted-foreground">{description}</p>
        {successMessage && (
          <p className="mb-4 text-sm text-green-600">{successMessage}</p>
        )}
        {errorMessage && (
          <p className="mb-4 text-sm text-red-600">{errorMessage}</p>
        )}
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">아이디</span>
            <input
              type="text"
              value={username}
              onChange={(e) => onUsernameChange(e.target.value)}
              placeholder={placeholderId}
              className="w-full rounded-md border border-border px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder={placeholderPw}
              className="w-full rounded-md border border-border px-3 py-2"
            />
          </label>
          <Button
            type="button"
            onClick={onLink}
            disabled={linking}
          >
            {linking ? "연동 중…" : "연동하기(로그인)"}
          </Button>
        </div>
      </section>
    </Card>
  );
}
