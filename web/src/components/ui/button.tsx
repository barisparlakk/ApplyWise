import * as React from "react";

import { cn } from "@/lib/utils";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: "sm" | "md" | "icon";
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size = "md", variant = "primary", ...props }, ref) => {
    const variants = {
      primary: "border border-transparent bg-primary text-primary-foreground shadow-[0_5px_16px_rgba(172,45,39,0.18)] hover:bg-[#b83a34]",
      secondary: "border border-border bg-white text-foreground shadow-sm hover:border-[#a8afb8] hover:bg-[#f7f8f9]",
      ghost: "border border-transparent bg-transparent text-foreground hover:bg-muted",
      danger: "border border-[#e3aaa5] bg-white text-[#a62f2a] hover:bg-[#fff3f2]",
    };
    const sizes = {
      sm: "h-9 px-3 text-xs",
      md: "h-10 px-4 text-sm",
      icon: "h-10 w-10 p-0",
    };

    return (
      <button
        className={cn(
          "motion-control inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-semibold focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50",
          variants[variant],
          sizes[size],
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
