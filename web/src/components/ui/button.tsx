import * as React from "react";

import { cn } from "@/lib/utils";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => {
    const variants = {
      primary: "bg-primary text-primary-foreground shadow-sm hover:bg-[#176e60]",
      secondary: "border border-border bg-white text-foreground shadow-sm hover:border-[#6cb5a3] hover:bg-[#f4fbf8]",
      ghost: "bg-transparent text-foreground hover:bg-muted",
    };

    return (
      <button
        className={cn(
          "inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50",
          variants[variant],
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
