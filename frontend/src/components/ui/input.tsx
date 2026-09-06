import * as React from 'react';

import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        // text-base on mobile, text-sm from sm: upward — matching the .input
        // rule in index.css. Anything under 16px makes iOS Safari zoom the
        // viewport on focus, which yanks the layout mid-form.
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm transition-colors',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'sm:text-sm',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export { Input };
