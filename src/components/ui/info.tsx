"use client";

import { cn } from "@/lib/utils/cn";

export interface InfoProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

/** Design System `Info` (desktop) */
export function Info({ title, description, icon, className, ...props }: InfoProps) {
  return (
    <section
      className={cn(
        "flex items-center gap-4 rounded-lg bg-wgray-06 px-4 py-5",
        className,
      )}
      {...props}
    >
      {icon ? <div className="shrink-0">{icon}</div> : null}
      <div className="flex min-w-0 flex-col gap-1">
        <p className="typo-body-01-bold text-gray-01">{title}</p>
        <p className="typo-body-02-regular whitespace-pre-line text-gray-04">
          {description}
        </p>
      </div>
    </section>
  );
}

