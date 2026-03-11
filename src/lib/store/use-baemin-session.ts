"use client";

import { useEffect, useState } from "react";

export type BaeminSessionData = {
  shop_category?: string | null;
  has_session?: boolean;
};

async function fetchBaeminSession(storeId: string): Promise<BaeminSessionData | null> {
  const res = await fetch(
    `/api/stores/${storeId}/platforms/baemin/session`,
    { credentials: "same-origin" }
  );
  const data = (await res.json().catch(() => ({}))) as {
    result?: BaeminSessionData;
  };
  return data?.result ?? null;
}

export function useBaeminSession(
  storeId: string | null,
  enabled = true
): BaeminSessionData | null {
  const [meta, setMeta] = useState<BaeminSessionData | null>(null);

  useEffect(() => {
    if (!enabled || !storeId) {
      setMeta(null);
      return;
    }
    fetchBaeminSession(storeId)
      .then(setMeta)
      .catch(() => setMeta(null));
  }, [storeId, enabled]);

  return meta;
}
