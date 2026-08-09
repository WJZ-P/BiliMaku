import type { DanmakuOverlaySettings } from "../../types/overlay";

/** 已经占用某一条全屏弹幕轨道的最小数据结构。 */
export interface DanmakuLaneOccupant {
  /** 从可用区域顶部开始、以 0 为起点的轨道编号。 */
  lane: number;
  /** 到达该时间后，同速的新弹幕可以安全复用这条轨道。 */
  laneReusableAt: number;
}

/** 根据当前窗口和弹幕样式计算出的稳定轨道布局。 */
export interface DanmakuLaneLayout {
  /** 单条轨道所占高度，已经包含轨道间距。 */
  laneHeight: number;
  /** 当前可用区域容纳的轨道数量。 */
  laneCount: number;
  /** 把轨道编号转换为相对窗口顶部的像素坐标。 */
  topForLane: (lane: number) => number;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * 统一计算轨道数量与纵向坐标，避免接收事件和渲染组件使用两套取整规则。
 * 垂直起点与终点界定可用区域；即使配置区间过窄，也至少保留一条轨道。
 */
export function createDanmakuLaneLayout(
  settings: DanmakuOverlaySettings,
  viewportHeight: number,
): DanmakuLaneLayout {
  const height = Math.max(1, viewportHeight);
  const laneHeight = Math.max(1, settings.fontSize * 1.35 + settings.laneGap);
  const startRatio = clamp(settings.verticalStartPercent / 100, 0, 1);
  const endRatio = clamp(settings.verticalEndPercent / 100, startRatio, 1);
  const availableHeight = Math.max(laneHeight, height * (endRatio - startRatio));
  const laneCount = Math.max(1, Math.floor(availableHeight / laneHeight));
  const firstLaneTop = height * startRatio;

  return {
    laneHeight,
    laneCount,
    topForLane: (lane) => (
      firstLaneTop + clamp(Math.floor(lane), 0, laneCount - 1) * laneHeight
    ),
  };
}

/**
 * 顶部优先的最少占用分配器：
 * 1. 已经完全进入屏幕且与新弹幕同速的旧弹幕不再占用入口；
 * 2. 优先选择入口已经空闲的最上方轨道；
 * 3. 所有入口都繁忙时，选择等待弹幕最少且更靠上的轨道。
 */
export function selectTopPriorityLane(
  activeItems: readonly DanmakuLaneOccupant[],
  laneCount: number,
  now: number,
): number {
  const safeLaneCount = Math.max(1, Math.floor(laneCount));
  const occupancy = Array.from({ length: safeLaneCount }, () => 0);

  for (const item of activeItems) {
    if (
      item.laneReusableAt > now
      && Number.isInteger(item.lane)
      && item.lane >= 0
      && item.lane < safeLaneCount
    ) {
      occupancy[item.lane] += 1;
    }
  }

  const firstFreeLane = occupancy.findIndex((count) => count === 0);
  if (firstFreeLane >= 0) return firstFreeLane;

  let selectedLane = 0;
  for (let lane = 1; lane < occupancy.length; lane += 1) {
    if (occupancy[lane] < occupancy[selectedLane]) {
      selectedLane = lane;
    }
  }
  return selectedLane;
}