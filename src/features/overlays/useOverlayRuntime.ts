import { useEffect, useState } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { listenToLiveEvents } from "../../services/desktop";
import {
  defaultOverlaySettings,
  getRuntimeOverlaySettings,
  listenToOverlayPreview,
  listenToOverlaySettings,
} from "../../services/overlays";
import type { LiveEvent } from "../../types/events";
import type { OverlaySettings } from "../../types/overlay";

export function useOverlaySettings() {
  const [settings, setSettings] = useState<OverlaySettings>(defaultOverlaySettings);

  useEffect(() => {
    let active = true;
    let unlisten: UnlistenFn | undefined;
    void getRuntimeOverlaySettings().then((current) => {
      if (active && current) setSettings(current);
    });
    void listenToOverlaySettings((next) => {
      if (active) setSettings(next);
    }).then((stop) => {
      if (active) unlisten = stop;
      else stop();
    });
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  return settings;
}

export function useOverlayEvents(callback: (event: LiveEvent) => void) {
  useEffect(() => {
    let active = true;
    const unlisteners: UnlistenFn[] = [];
    const receive = (event: LiveEvent) => {
      if (active) callback(event);
    };
    void Promise.all([
      listenToLiveEvents(receive),
      listenToOverlayPreview(receive),
    ]).then((values) => {
      if (active) unlisteners.push(...values);
      else values.forEach((unlisten) => unlisten());
    });
    return () => {
      active = false;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [callback]);
}
