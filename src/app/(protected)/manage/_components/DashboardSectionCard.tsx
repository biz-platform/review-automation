"use client";

import { cn } from "@/lib/utils/cn";

export function DashboardSectionCard({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-[#D9D9D9] bg-white p-4",
        className,
      )}
    >
      <h2 className="typo-body-02-bold text-gray-04">{title}</h2>
      {description ? (
        <p className="mt-1 text-[11px] leading-snug text-gray-03">
          {description}
        </p>
      ) : null}
      {children}
    </section>
  );
}

