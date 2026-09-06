import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with conflict resolution — the helper every shadcn/ui
 * component expects to import from `@/lib/utils`.
 *
 * clsx flattens conditionals; twMerge then resolves collisions so the last
 * class wins (`px-2 px-4` -> `px-4`), which is what makes a caller's className
 * able to override a component's defaults.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
