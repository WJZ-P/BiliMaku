import { useCallback, useEffect, useRef, useState } from "react";
import { getAnchorAnalyticsOverview } from "../../services/desktop";
import type {
  AnchorAnalyticsOverview,
  AnchorAnalyticsRangeType,
} from "../../types/anchorAnalytics";

/** 主播数据面板的加载状态。 */
export type AnchorAnalyticsLoadState = "loading" | "ready" | "error";

/**
 * 加载当前扫码账号自己的主播中心数据。
 *
 * Rust 端按 UID 与统计周期缓存五分钟；forceRefresh 只用于用户主动刷新。
 */
export function useAnchorAnalytics() {
  const [rangeType, setRangeType] = useState<AnchorAnalyticsRangeType>(2);
  const [overview, setOverview] = useState<AnchorAnalyticsOverview | null>(null);
  const [state, setState] = useState<AnchorAnalyticsLoadState>("loading");
  const [error, setError] = useState("");
  const requestSequence = useRef(0);

  const load = useCallback(
    async (forceRefresh = false) => {
      const sequence = ++requestSequence.current;
      if (!forceRefresh) setOverview(null);
      setState("loading");
      setError("");
      try {
        const nextOverview = await getAnchorAnalyticsOverview(
          rangeType,
          forceRefresh,
        );
        if (sequence !== requestSequence.current) return;
        setOverview(nextOverview);
        setState("ready");
      } catch (reason) {
        if (sequence !== requestSequence.current) return;
        setError(reason instanceof Error ? reason.message : String(reason));
        setState("error");
      }
    },
    [rangeType],
  );

  useEffect(() => {
    void load(false);
    return () => {
      requestSequence.current += 1;
    };
  }, [load]);

  return {
    rangeType,
    setRangeType,
    overview,
    state,
    error,
    refresh: () => load(true),
  };
}
