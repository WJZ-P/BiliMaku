import { useMemo, useState, type CSSProperties } from "react";
import { Icon, type IconName } from "../../components/Icon";
import {
  PanelHeader,
  PanelHeading,
  PanelTitle,
} from "../../components/ui";
import type {
  AnchorAnalyticsMetric,
  AnchorAnalyticsPoint,
  AnchorAnalyticsRangeType,
  PrimaryAnchorMetricKey,
} from "../../types/anchorAnalytics";
import {
  AnchorAnalyticsSurface,
  AnchorChart,
  AnchorChartAxis,
  AnchorChartCanvas,
  AnchorChartHeader,
  AnchorChartLegend,
  AnchorChartTitle,
  AnchorChartTooltip,
  AnchorChartTooltipDate,
  AnchorChartTooltipValue,
  AnchorMetricCard,
  AnchorMetricContent,
  AnchorMetricDelta,
  AnchorMetricGrid,
  AnchorMetricIcon,
  AnchorMetricLabel,
  AnchorMetricTab,
  AnchorMetricTabs,
  AnchorMetricValue,
  AnchorPanelBody,
  AnchorPanelState,
  AnchorRangeButton,
  AnchorRangeSelector,
  AnchorRefreshButton,
  AnchorToolbar,
  AnchorTrendSvg,
} from "./DashboardStyles";
import { useAnchorAnalytics } from "./useAnchorAnalytics";

interface PrimaryMetricDefinition {
  key: PrimaryAnchorMetricKey;
  icon: IconName;
  tone: "income" | "duration" | "audience" | "followers";
}

const PRIMARY_METRICS: PrimaryMetricDefinition[] = [
  { key: "income", icon: "gift", tone: "income" },
  { key: "broadcast", icon: "clock", tone: "duration" },
  { key: "watchNum", icon: "users", tone: "audience" },
  { key: "changeFans", icon: "sparkles", tone: "followers" },
];

const RANGE_OPTIONS: Array<{
  value: AnchorAnalyticsRangeType;
  label: string;
}> = [
  { value: 1, label: "今日" },
  { value: 2, label: "前 7 日" },
  { value: 3, label: "前 30 日" },
  { value: 4, label: "自然月" },
];

const numberFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 1,
});

const compactFormatter = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function countUnit(key: string) {
  if (["watchNum", "changeFans", "giftNum", "barrageNum", "fans"].includes(key)) {
    return " 人";
  }
  if (key === "barrage") return " 条";
  return "";
}

/** 按官方页面使用的原始单位格式化数值；收益原始值为千分之一元。 */
function formatMetricValue(
  metric: AnchorAnalyticsMetric,
  rawValue: number,
  signed = false,
) {
  const sign = signed && rawValue !== 0 ? (rawValue > 0 ? "+" : "-") : rawValue < 0 ? "-" : "";
  const value = Math.abs(rawValue);
  if (metric.valueKind === "milliYuan") {
    return `${sign}${numberFormatter.format(value / 1000)} 元`;
  }
  if (metric.valueKind === "durationSeconds") {
    if (value >= 3600 || metric.key === "broadcast") {
      return `${sign}${numberFormatter.format(value / 3600)} 小时`;
    }
    if (value >= 60) return `${sign}${numberFormatter.format(value / 60)} 分钟`;
    return `${sign}${numberFormatter.format(value)} 秒`;
  }
  const formatted = value >= 10_000 ? compactFormatter.format(value) : numberFormatter.format(value);
  return `${sign}${formatted}${countUnit(metric.key)}`;
}

function comparisonDirection(value: number) {
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "flat";
}

function shortDate(value: string) {
  const match = value.trim().match(/(?:\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!match) return value.split(/[ T]/, 1)[0] || value;
  return `${match[1].padStart(2, "0")}/${match[2].padStart(2, "0")}`;
}

interface ChartGeometry {
  line: string;
  area: string;
  pointCoordinates: Array<{ x: number; y: number; point: AnchorAnalyticsPoint }>;
  axisPoints: AnchorAnalyticsPoint[];
}

function buildChartGeometry(points: AnchorAnalyticsPoint[]): ChartGeometry | null {
  if (points.length === 0) return null;
  const width = 700;
  const height = 142;
  const left = 20;
  const right = 16;
  const top = 14;
  const bottom = 16;
  const values = points.map((point) => point.value);
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);
  const span = maximum - minimum || 1;
  const pointCoordinates = points.map((point, index) => ({
    x:
      points.length === 1
        ? width / 2
        : left + (index / (points.length - 1)) * (width - left - right),
    y: top + ((maximum - point.value) / span) * (height - top - bottom),
    point,
  }));
  const line = pointCoordinates.map(({ x, y }) => `${x},${y}`).join(" ");
  const baselineY = top + ((maximum - 0) / span) * (height - top - bottom);
  const area = `${pointCoordinates[0].x},${baselineY} ${line} ${pointCoordinates.at(-1)?.x ?? left},${baselineY}`;
  const axisStep = Math.max(1, Math.ceil(points.length / 7));
  const axisPoints = points.filter(
    (_, index) => index === 0 || index === points.length - 1 || index % axisStep === 0,
  );
  return { line, area, pointCoordinates, axisPoints };
}

type ChartTooltipStyle = CSSProperties & {
  "--chart-tooltip-x": string;
  "--chart-tooltip-y": string;
};

function TrendChart({ metric }: { metric: AnchorAnalyticsMetric }) {
  const primarySeries = metric.series.find((series) => series.points.length > 0);
  const geometry = useMemo(
    () => buildChartGeometry(primarySeries?.points ?? []),
    [primarySeries],
  );
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  if (!primarySeries || !geometry) {
    return (
      <AnchorPanelState>
        <div>
          <strong>这个指标暂时没有趋势点</strong>
          汇总值仍然可用，平台可能尚未完成逐日数据结算。
        </div>
      </AnchorPanelState>
    );
  }

  const hoveredCoordinate = hoveredPointIndex === null
    ? null
    : geometry.pointCoordinates[hoveredPointIndex] ?? null;
  const tooltipStyle: ChartTooltipStyle | undefined = hoveredCoordinate
    ? {
        "--chart-tooltip-x": `${(hoveredCoordinate.x / 700) * 100}%`,
        "--chart-tooltip-y": `${hoveredCoordinate.y}px`,
      }
    : undefined;

  return (
    <>
      <AnchorChartCanvas onPointerLeave={() => setHoveredPointIndex(null)}>
        <AnchorTrendSvg
          viewBox="0 0 700 142"
          preserveAspectRatio="none"
          role="img"
          aria-label={`${metric.label}趋势图`}
        >
          {[28, 57, 86, 115].map((y) => (
            <line key={y} className="grid" x1="20" x2="684" y1={y} y2={y} />
          ))}
          <polygon className="area" points={geometry.area} />
          <polyline className="line" points={geometry.line} />
          {geometry.pointCoordinates.map(({ x, y, point }, index) => (
            <g
              key={`${point.date}-${point.value}`}
              className="point-target"
              tabIndex={0}
              role="button"
              aria-label={`${point.date}，${metric.label} ${formatMetricValue(metric, point.value)}`}
              onPointerEnter={() => setHoveredPointIndex(index)}
              onFocus={() => setHoveredPointIndex(index)}
              onBlur={() => setHoveredPointIndex(null)}
            >
              <circle className="point-hit-area" cx={x} cy={y} r="12" />
              <circle
                className="point"
                data-active={hoveredPointIndex === index}
                cx={x}
                cy={y}
                r="4"
              />
            </g>
          ))}
        </AnchorTrendSvg>
        {hoveredCoordinate ? (
          <AnchorChartTooltip
            role="tooltip"
            data-edge={
              hoveredPointIndex === 0
                ? "start"
                : hoveredPointIndex === geometry.pointCoordinates.length - 1
                  ? "end"
                  : "middle"
            }
            style={tooltipStyle}
          >
            <AnchorChartTooltipDate>{hoveredCoordinate.point.date.split(/[ T]/, 1)[0]}</AnchorChartTooltipDate>
            <AnchorChartTooltipValue>
              <span>{metric.label}</span>
              {formatMetricValue(metric, hoveredCoordinate.point.value)}
            </AnchorChartTooltipValue>
          </AnchorChartTooltip>
        ) : null}
        <AnchorChartAxis>
          {geometry.axisPoints.map((point) => (
            <span key={point.date}>{shortDate(point.date)}</span>
          ))}
        </AnchorChartAxis>
      </AnchorChartCanvas>
      <AnchorChartLegend>{primarySeries.name || metric.label}</AnchorChartLegend>
    </>
  );
}

/** 当前账号的主播中心数据面板。 */
export function AnchorAnalyticsPanel() {
  const analytics = useAnchorAnalytics();
  const [activeMetricKey, setActiveMetricKey] =
    useState<PrimaryAnchorMetricKey>("income");
  const metricByKey = useMemo(
    () => new Map(analytics.overview?.metrics.map((metric) => [metric.key, metric]) ?? []),
    [analytics.overview],
  );
  const primaryMetrics = PRIMARY_METRICS.map((definition) => ({
    definition,
    metric: metricByKey.get(definition.key),
  }));
  const activeMetric =
    metricByKey.get(activeMetricKey) ?? primaryMetrics.find((item) => item.metric)?.metric;
  const hasMetrics = (analytics.overview?.metrics.length ?? 0) > 0;
  return (
    <AnchorAnalyticsSurface>
      <PanelHeader>
        <PanelHeading>
          <PanelTitle>主播数据概览</PanelTitle>
        </PanelHeading>
        <AnchorToolbar>
          <AnchorRangeSelector aria-label="主播数据统计周期">
            {RANGE_OPTIONS.map((option) => (
              <AnchorRangeButton
                key={option.value}
                type="button"
                data-active={analytics.rangeType === option.value}
                onClick={() => analytics.setRangeType(option.value)}
              >
                {option.label}
              </AnchorRangeButton>
            ))}
          </AnchorRangeSelector>
          <AnchorRefreshButton
            type="button"
            disabled={analytics.state === "loading"}
            onClick={() => void analytics.refresh()}
          >
            <Icon name="radio" size={12} />
            刷新
          </AnchorRefreshButton>
        </AnchorToolbar>
      </PanelHeader>

      <AnchorPanelBody>
        {!analytics.overview && analytics.state === "loading" ? (
          <AnchorPanelState>
            <div>
              <strong>正在读取主播中心数据</strong>
              Cookie 只在 Rust 本机请求中使用，前端不会接触账号凭据。
            </div>
          </AnchorPanelState>
        ) : !analytics.overview && analytics.state === "error" ? (
          <AnchorPanelState data-error="true">
            <div>
              <strong>主播数据读取失败</strong>
              {analytics.error}
            </div>
          </AnchorPanelState>
        ) : !hasMetrics ? (
          <AnchorPanelState>
            <div>
              <strong>当前周期暂无主播数据</strong>
              普通账号、尚未开播的账号，或平台尚未完成结算时会出现这个状态。
            </div>
          </AnchorPanelState>
        ) : (
          <>
            <AnchorMetricGrid>
              {primaryMetrics.map(({ definition, metric }) => (
                <AnchorMetricCard
                  key={definition.key}
                  type="button"
                  disabled={!metric}
                  data-active={activeMetric?.key === definition.key}
                  onClick={() => setActiveMetricKey(definition.key)}
                >
                  <AnchorMetricIcon data-tone={definition.tone}>
                    <Icon name={definition.icon} size={16} />
                  </AnchorMetricIcon>
                  <AnchorMetricContent>
                    <AnchorMetricLabel>{metric?.label ?? definition.key}</AnchorMetricLabel>
                    <AnchorMetricValue>
                      {metric ? formatMetricValue(metric, metric.value) : "--"}
                    </AnchorMetricValue>
                    <AnchorMetricDelta
                      data-direction={comparisonDirection(metric?.comparisonDelta ?? 0)}
                    >
                      {metric
                        ? `较上一周期 ${formatMetricValue(metric, metric.comparisonDelta, true)}`
                        : "当前账号不提供此指标"}
                    </AnchorMetricDelta>
                  </AnchorMetricContent>
                </AnchorMetricCard>
              ))}
            </AnchorMetricGrid>

            {activeMetric ? (
              <AnchorChart>
                <AnchorChartHeader>
                  <AnchorChartTitle>
                    {activeMetric.label}趋势
                    <span>{analytics.overview?.rangeLabel}逐日数据</span>
                  </AnchorChartTitle>
                  <AnchorMetricTabs aria-label="趋势指标">
                    {primaryMetrics.map(({ definition, metric }) => (
                      <AnchorMetricTab
                        key={definition.key}
                        type="button"
                        disabled={!metric}
                        data-active={activeMetric.key === definition.key}
                        onClick={() => setActiveMetricKey(definition.key)}
                      >
                        {metric?.label ?? definition.key}
                      </AnchorMetricTab>
                    ))}
                  </AnchorMetricTabs>
                </AnchorChartHeader>
                <TrendChart key={activeMetric.key} metric={activeMetric} />
              </AnchorChart>
            ) : null}
          </>
        )}
      </AnchorPanelBody>
    </AnchorAnalyticsSurface>
  );
}
