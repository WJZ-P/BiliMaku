import type { LiveEvent, VoiceQueueItem } from "../types/events";

export const demoEvents: LiveEvent[] = [
  {
    id: "evt-1",
    type: "message",
    user: "蓝莓汽水",
    avatar: "蓝",
    content: "晚上好！今天也准时来听直播啦～",
    time: "21:04",
  },
  {
    id: "evt-2",
    type: "gift",
    user: "月岛小熊",
    avatar: "熊",
    content: "投喂了 牛哇牛哇 × 3",
    meta: "礼物",
    time: "21:03",
  },
  {
    id: "evt-3",
    type: "superchat",
    user: "薄荷星球",
    avatar: "薄",
    content: "新音色好自然！可以读一下我的名字吗？",
    meta: "SC ¥30",
    time: "21:02",
  },
  {
    id: "evt-4",
    type: "guard",
    user: "海盐泡芙",
    avatar: "盐",
    content: "开通了舰长，欢迎加入泡泡舰队！",
    meta: "舰长",
    time: "21:01",
  },
];

export const demoQueue: VoiceQueueItem[] = [
  {
    id: "queue-1",
    speaker: "薄荷星球",
    voice: "晴空 · 温柔",
    content: "新音色好自然，可以读一下我的名字吗？",
    duration: "00:06",
    status: "playing",
  },
  {
    id: "queue-2",
    speaker: "海盐泡芙",
    voice: "铃音 · 活泼",
    content: "开通了舰长，欢迎加入泡泡舰队！",
    duration: "00:05",
    status: "waiting",
  },
  {
    id: "queue-3",
    speaker: "橘子海",
    voice: "晴空 · 温柔",
    content: "主播今天准备玩什么呀？",
    duration: "00:04",
    status: "waiting",
  },
];
