import { styled } from "@linaria/react";
import { useMemo, useState, type CSSProperties } from "react";
import { Icon, type IconName } from "../../components/Icon";
import { theme } from "../../styles/theme";

type ConceptId = "spectral" | "danmaku" | "prism";

interface DesignConcept {
  /** 实验方案的稳定标识。 */
  id: ConceptId;
  /** 面向用户展示的方案名称。 */
  name: string;
  /** 方案英文短标。 */
  code: string;
  /** 最适合落地的界面区域。 */
  target: string;
  /** 一句话设计判断。 */
  summary: string;
  /** 视觉语义图标。 */
  icon: IconName;
  /** 各项百分制评分。 */
  scores: { readability: number; identity: number; efficiency: number };
}

const concepts: ReadonlyArray<DesignConcept> = [
  {
    id: "spectral",
    name: "深海光场",
    code: "SPECTRAL FIELD",
    target: "启动页 / 空状态 / 品牌展示",
    summary: "沉浸感最强，适合短时聚焦，不建议承载密集的操作信息。",
    icon: "sparkles",
    scores: { readability: 72, identity: 96, efficiency: 68 },
  },
  {
    id: "danmaku",
    name: "弹幕流场",
    code: "DANMAKU FLOW",
    target: "直播间 / 悬浮播报 / 事件反馈",
    summary: "产品语义最明确，DOM 文字与 WebGL 氛围分层后兼顾清晰度与灵动感。",
    icon: "message",
    scores: { readability: 91, identity: 94, efficiency: 82 },
  },
  {
    id: "prism",
    name: "棱镜玻璃",
    code: "PRISM GLASS",
    target: "设置页 / 资料卡 / 精细工具",
    summary: "最适合长期阅读与操作，可作为 BiliMaku 主界面的基础材质。",
    icon: "sliders",
    scores: { readability: 95, identity: 80, efficiency: 90 },
  },
];

interface DesignDecisionBoardProps {
  /** 将选型同步到 Debug 页顶部的最近操作遥测。 */
  onAction?: (label: string) => void;
}

const Board = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, ${theme.colors.brand} 20%, ${theme.colors.borderStrong});
  border-radius: 9px;
  background: color-mix(in srgb, ${theme.colors.surface} 76%, transparent);
  box-shadow: 0 18px 42px color-mix(in srgb, ${theme.colors.textPrimary} 7%, transparent), inset 0 1px 0 color-mix(in srgb, ${theme.colors.highlight} 82%, transparent);
  backdrop-filter: blur(22px) saturate(1.16);

  @media (max-width: 840px) { grid-template-columns: 1fr; }
`;

const ConceptList = styled.div`
  display: grid;
  min-width: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  padding: 1px;
  background: color-mix(in srgb, ${theme.colors.brand} 13%, ${theme.colors.border});

  @media (max-width: 640px) { grid-template-columns: 1fr; }
`;

const ConceptButton = styled.button`
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 188px;
  align-content: space-between;
  gap: 18px;
  overflow: hidden;
  padding: 16px;
  border: 0;
  border-radius: 0;
  background: color-mix(in srgb, ${theme.colors.surface} 94%, transparent);
  color: ${theme.colors.textSecondary};
  text-align: left;
  isolation: isolate;
  transition: background ${theme.motion.normal}, color ${theme.motion.fast};

  &::before,
  &::after { position: absolute; z-index: -1; content: ""; pointer-events: none; }
  &::before {
    top: 24px;
    right: -30px;
    width: 118px;
    height: 118px;
    border: 1px solid color-mix(in srgb, ${theme.colors.brand} 22%, transparent);
    border-radius: 50%;
    opacity: 0.54;
    transform: scale(0.78);
    transition: opacity ${theme.motion.normal}, transform 680ms cubic-bezier(0.2, 1.22, 0.34, 1);
  }
  &::after {
    inset: 0;
    background: radial-gradient(circle at 88% 22%, color-mix(in srgb, ${theme.colors.cyan} 14%, transparent), transparent 34%), linear-gradient(125deg, color-mix(in srgb, ${theme.colors.brand} 7%, transparent), transparent 52%);
    opacity: 0;
    transition: opacity ${theme.motion.normal};
  }
  &:hover,
  &:focus-visible { color: ${theme.colors.textPrimary}; outline: 0; }
  &:hover::before,
  &:focus-visible::before,
  &[data-active="true"]::before { opacity: 0.88; transform: scale(1.08); }
  &:hover::after,
  &:focus-visible::after,
  &[data-active="true"]::after { opacity: 1; }
  &[data-active="true"] {
    background: color-mix(in srgb, ${theme.colors.brandSubtle} 72%, ${theme.colors.surface});
    color: ${theme.colors.textPrimary};
    box-shadow: inset 0 -3px 0 ${theme.colors.brand};
  }
`;

const ConceptTop = styled.span`display: grid; gap: 12px;`;
const ConceptIcon = styled.span`
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid color-mix(in srgb, ${theme.colors.brand} 25%, ${theme.colors.borderStrong});
  border-radius: 7px;
  background: color-mix(in srgb, ${theme.colors.surface} 62%, transparent);
  color: ${theme.colors.brand};
  box-shadow: inset 0 1px 0 ${theme.colors.highlight};
  transition: color ${theme.motion.fast}, transform ${theme.motion.spring};

  ${ConceptButton}:hover &,
  ${ConceptButton}:focus-visible &,
  ${ConceptButton}[data-active="true"] & { color: ${theme.colors.brandDeep}; transform: translateY(-2px) scale(1.06); }
`;
const ConceptCode = styled.span`
  color: ${theme.colors.textMuted};
  font-family: ${theme.typography.mono};
  font-size: 8px;
  font-weight: 760;
  letter-spacing: 0.11em;
`;
const ConceptName = styled.strong`
  display: block;
  margin-top: 4px;
  color: ${theme.colors.textPrimary};
  font-size: 15px;
  font-weight: 880;
  letter-spacing: -0.02em;
`;
const ConceptTarget = styled.span`
  display: block;
  max-width: 170px;
  color: ${theme.colors.textMuted};
  font-size: 10px;
  font-weight: 650;
  line-height: 1.55;
`;

const Detail = styled.aside`
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 18px;
  padding: 18px;
  border-left: 1px solid ${theme.colors.borderStrong};
  background: linear-gradient(145deg, color-mix(in srgb, ${theme.colors.brand} 8%, transparent), transparent 55%), color-mix(in srgb, ${theme.colors.surfaceMuted} 86%, transparent);

  @media (max-width: 840px) { border-top: 1px solid ${theme.colors.borderStrong}; border-left: 0; }
`;
const DetailHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`;
const DetailTitle = styled.div`
  display: grid;
  gap: 4px;
  span { color: ${theme.colors.brand}; font-family: ${theme.typography.mono}; font-size: 8px; font-weight: 850; letter-spacing: 0.12em; }
  strong { color: ${theme.colors.textPrimary}; font-size: 17px; font-weight: 900; }
`;
const SelectedMark = styled.span`
  display: inline-flex;
  height: 24px;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, ${theme.colors.success} 30%, ${theme.colors.border});
  border-radius: 5px;
  background: color-mix(in srgb, ${theme.colors.successSoft} 72%, transparent);
  color: ${theme.colors.success};
  font-family: ${theme.typography.mono};
  font-size: 8px;
  font-weight: 850;
`;
const Summary = styled.p`
  margin: 0;
  color: ${theme.colors.textSecondary};
  font-size: 11px;
  line-height: 1.75;
`;
const ScoreList = styled.div`display: grid; gap: 10px;`;
const Score = styled.div`
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 9px;
  color: ${theme.colors.textMuted};
  font-size: 9px;
  font-weight: 720;
  strong { color: ${theme.colors.textPrimary}; font-family: ${theme.typography.mono}; font-size: 9px; text-align: right; }
`;
const ScoreTrack = styled.span`
  height: 4px;
  overflow: hidden;
  border-radius: 1px;
  background: color-mix(in srgb, ${theme.colors.brand} 10%, ${theme.colors.border});
  i {
    display: block;
    width: var(--score-width);
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, ${theme.colors.brand}, ${theme.colors.cyan});
    box-shadow: 0 0 9px color-mix(in srgb, ${theme.colors.cyan} 54%, transparent);
    transform-origin: left;
    animation: bilimaku-score-enter 560ms cubic-bezier(0.2, 1.2, 0.3, 1) both;
  }
  @keyframes bilimaku-score-enter { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  @media (prefers-reduced-motion: reduce) { i { animation: none; } }
`;
const TargetLine = styled.div`
  display: grid;
  gap: 5px;
  padding-top: 13px;
  border-top: 1px solid ${theme.colors.borderStrong};
  span { color: ${theme.colors.textMuted}; font-family: ${theme.typography.mono}; font-size: 8px; letter-spacing: 0.1em; }
  strong { color: ${theme.colors.brandDeep}; font-size: 11px; font-weight: 820; }
`;

/** 三套视觉实验的交互式决策矩阵，不额外创建 WebGL 上下文。 */
export function DesignDecisionBoard({ onAction }: DesignDecisionBoardProps) {
  const [selectedId, setSelectedId] = useState<ConceptId>("danmaku");
  const selected = useMemo(() => concepts.find((item) => item.id === selectedId) ?? concepts[1], [selectedId]);
  const scoreRows = [["可读性", selected.scores.readability], ["辨识度", selected.scores.identity], ["运行效率", selected.scores.efficiency]] as const;

  return (
    <Board>
      <ConceptList aria-label="视觉方案选择">
        {concepts.map((concept) => (
          <ConceptButton key={concept.id} type="button" data-active={selectedId === concept.id} aria-pressed={selectedId === concept.id} onClick={() => { setSelectedId(concept.id); onAction?.(`选型 · ${concept.name}`); }}>
            <ConceptTop>
              <ConceptIcon><Icon name={concept.icon} size={16} /></ConceptIcon>
              <span><ConceptCode>{concept.code}</ConceptCode><ConceptName>{concept.name}</ConceptName></span>
            </ConceptTop>
            <ConceptTarget>{concept.target}</ConceptTarget>
          </ConceptButton>
        ))}
      </ConceptList>
      <Detail aria-live="polite">
        <DetailHeader>
          <DetailTitle><span>SELECTED CONCEPT</span><strong>{selected.name}</strong></DetailTitle>
          <SelectedMark><Icon name="check" size={11} /> ACTIVE</SelectedMark>
        </DetailHeader>
        <Summary>{selected.summary}</Summary>
        <ScoreList>
          {scoreRows.map(([label, score]) => (
            <Score key={`${selected.id}-${label}`}><span>{label}</span><ScoreTrack style={{ "--score-width": `${score}%` } as CSSProperties}><i /></ScoreTrack><strong>{score}</strong></Score>
          ))}
        </ScoreList>
        <TargetLine><span>RECOMMENDED SURFACE</span><strong>{selected.target}</strong></TargetLine>
      </Detail>
    </Board>
  );
}
