import { useCallback, useEffect, useState } from "react";
import {
  getBilibiliLoginStatus,
  listenToBilibiliAccountEvents,
} from "../../services/desktop";
import type { BilibiliLoginStatus } from "../../types/account";

/** React 鉴权门使用的初始账号状态。 */
export const checkingAccountStatus: BilibiliLoginStatus = {
  phase: "checking",
  message: "正在检查本地登录态",
  profile: null,
  persisted: false,
  validatedAt: null,
};

/**
 * 订阅 Rust 账号 Store，并在首次渲染时等待持久化 Cookie 恢复完成。
 * 后续登录、过期和退出均复用同一条事件流更新鉴权门。
 */
export function useAccountSession() {
  const [status, setStatusState] = useState<BilibiliLoginStatus>(checkingAccountStatus);
  const [error, setError] = useState("");

  const setStatus = useCallback((nextStatus: BilibiliLoginStatus) => {
    setStatusState(nextStatus);
    if (nextStatus.phase !== "checking") setError("");
  }, []);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;

    void listenToBilibiliAccountEvents((event) => {
      if (!active) return;
      setStatusState(event.status);
      setError(event.kind === "session-error" ? event.status.message : "");
    }).then((stop) => {
      if (active) unlisten = stop;
      else stop();
    });

    void getBilibiliLoginStatus()
      .then((nextStatus) => {
        if (!active) return;
        setStatusState(nextStatus);
        setError("");
      })
      .catch((reason) => {
        if (!active) return;
        const message = reason instanceof Error ? reason.message : String(reason);
        setError(message);
        setStatusState({
          phase: "anonymous",
          message: "本地登录态读取异常，请重新扫码建立会话",
          profile: null,
          persisted: false,
          validatedAt: null,
        });
      });

    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  return { status, error, setStatus };
}
