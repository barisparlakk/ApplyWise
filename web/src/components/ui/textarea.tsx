import * as React from "react";

import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "min-h-24 w-full rounded-md border border-border bg-white px-3 py-2 text-sm shadow-sm outline-none ring-primary/20 transition placeholder:text-muted-foreground focus:border-primary focus:ring-4",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";
