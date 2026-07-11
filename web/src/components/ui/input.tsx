import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      className={cn(
        "h-11 w-full rounded-md border border-border bg-white px-3.5 text-sm text-foreground shadow-[0_1px_2px_rgba(16,19,24,0.04)] outline-none ring-primary/15 transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground focus:border-primary focus:ring-4",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";
