"use client";

import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const cardVariants = cva("rounded-lg border border-border", {
  variants: {
    variant: {
      default: "bg-background",
      muted: "bg-muted/50",
    },
    padding: {
      none: "",
      sm: "p-3",
      md: "p-4",
      lg: "p-6",
    },
  },
  defaultVariants: {
    variant: "default",
    padding: "md",
  },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(cardVariants({ variant, padding, className }))}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";
