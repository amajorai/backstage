import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { type AcpToolCall, dispatchAcpToolCall } from "@/lib/acp-tools";

export function useAcpToolRunner() {
  useEffect(() => {
    const unlistenPromise = listen<AcpToolCall>("acp-tool-call", (event) => {
      dispatchAcpToolCall(event.payload).catch(() => {});
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);
}
