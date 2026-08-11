import { styled } from "@linaria/react";
import { Fragment, memo, useMemo, useState } from "react";
import type { LiveMessageEmote } from "../types/events";

const EmoteImage = styled.img`
  display: inline-block;
  width: auto;
  height: var(--live-message-emote-size, 1.35em);
  max-width: 3.2em;
  margin: 0 0.08em;
  object-fit: contain;
  vertical-align: -0.3em;
  pointer-events: none;
  user-select: none;

  &[data-large="true"] {
    height: var(--live-message-large-emote-size, 2.5em);
    max-width: 4em;
    vertical-align: -0.72em;
  }
`;

interface TextPart {
  type: "text";
  value: string;
}

interface EmotePart {
  type: "emote";
  value: LiveMessageEmote;
}

export type LiveMessageContentPart = TextPart | EmotePart;

/** 统一图片协议并过滤掉不可直接渲染的资源地址。 */
function normalizeEmoteUrl(value: string) {
  const url = value.trim();
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("http://")) return `https://${url.slice(7)}`;
  return url.startsWith("https://") ? url : "";
}

/**
 * 按正文实际出现顺序拆分文本和表情；同一位置存在重叠标记时优先匹配更长标记。
 * 上游缺少表情元数据时不会猜测，原始 `[名称]` 文本会完整保留。
 */
export function splitLiveMessageContent(
  content: string,
  emotes: readonly LiveMessageEmote[] | undefined,
): LiveMessageContentPart[] {
  if (!content || !emotes?.length) return [{ type: "text", value: content }];

  const uniqueEmotes = new Map<string, LiveMessageEmote>();
  for (const emote of emotes) {
    const text = emote.text.trim();
    const url = normalizeEmoteUrl(emote.url);
    if (!text || !url || !content.includes(text) || uniqueEmotes.has(text)) continue;
    uniqueEmotes.set(text, { ...emote, text, url });
  }
  const candidates = Array.from(uniqueEmotes.values()).sort(
    (left, right) => right.text.length - left.text.length,
  );
  if (candidates.length === 0) return [{ type: "text", value: content }];

  const parts: LiveMessageContentPart[] = [];
  let cursor = 0;
  while (cursor < content.length) {
    let matched: LiveMessageEmote | undefined;
    let matchedIndex = content.length;
    for (const candidate of candidates) {
      const index = content.indexOf(candidate.text, cursor);
      if (index < 0 || index > matchedIndex) continue;
      if (index < matchedIndex || !matched || candidate.text.length > matched.text.length) {
        matched = candidate;
        matchedIndex = index;
      }
    }

    if (!matched) {
      parts.push({ type: "text", value: content.slice(cursor) });
      break;
    }
    if (matchedIndex > cursor) {
      parts.push({ type: "text", value: content.slice(cursor, matchedIndex) });
    }
    parts.push({ type: "emote", value: matched });
    cursor = matchedIndex + matched.text.length;
  }
  return parts;
}

function LiveEmoteToken({ emote }: { emote: LiveMessageEmote }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{emote.text}</>;
  const large = Math.max(emote.width, emote.height) >= 64;
  return (
    <EmoteImage
      src={emote.url}
      alt={emote.text}
      data-large={large}
      decoding="async"
      draggable={false}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

interface LiveMessageContentProps {
  /** 原始弹幕正文，同时承担图片加载失败时的文本回退。 */
  content: string;
  /** Rust 协议层从当前 DANMU_MSG 中提取的表情映射。 */
  emotes?: readonly LiveMessageEmote[];
}

/** 将弹幕中的 `[表情]` 标记渲染为平台原始图片，并保持无元数据场景的纯文本兼容。 */
export const LiveMessageContent = memo(function LiveMessageContent({
  content,
  emotes,
}: LiveMessageContentProps) {
  const parts = useMemo(() => splitLiveMessageContent(content, emotes), [content, emotes]);
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={`${part.type}-${index}`}>
          {part.type === "text"
            ? part.value
            : <LiveEmoteToken emote={part.value} />}
        </Fragment>
      ))}
    </>
  );
});