"use client";

import { Toaster } from "sonner";
import { useTheme } from "next-themes";

// sonner's own theme="system" prop reads the OS color-scheme directly and
// ignores next-themes — so if the user manually switches the app to dark
// while their OS is still light (or vice versa), toasts render in the
// wrong palette while the rest of the app is correct. Reading resolvedTheme
// from next-themes here keeps toasts in sync with whatever theme is
// actually applied to <html>, including manual overrides.
export default function ThemedToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      richColors
      position="top-right"
      theme={(resolvedTheme as "light" | "dark") ?? "system"}
    />
  );
}
