import { useEffect, useState } from "react";
import { resolveWorkspaceView } from "@/app/feature-registry";
import type { View } from "@/lib/views";

/** Single navigation authority for the existing hash-route contract. */
export function useHashView() {
  const [view, setView] = useState<View>(() => resolveWorkspaceView(window.location.hash));
  useEffect(() => {
    const listener = () => setView(resolveWorkspaceView(window.location.hash));
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  const navigate = (next: View) => {
    window.location.hash = next;
    setView(next);
  };
  return [view, navigate] as const;
}
