import * as React from "react";

import { cn } from "@/lib/utils";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      className={cn(
        "h-10 w-full rounded-md border border-border bg-white px-3 text-sm shadow-sm outline-none ring-primary/20 transition-[border-color,box-shadow] duration-200 focus:border-primary focus:ring-4",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Select.displayName = "Select";
