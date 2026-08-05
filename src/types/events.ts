export type LiveEventType =
  | "message"
  | "interaction"
  | "gift"
  | "superchat"
  | "guard"
  | "system";

export interface LiveEvent {
  id: string;
  sessionId?: number;
  roomId?: number;
  type: LiveEventType;
  user: string;
  avatar: string;
  content: string;
  meta?: string;
  rawCommand?: string;
  emittedAt?: number;
  time?: string;
}

export interface VoiceQueueItem {
  id: string;
  speaker: string;
  voice: string;
  content: string;
  duration: string;
  status: "playing" | "waiting";
}

export type LiveConnectionPhase =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export interface RoomConnectionInfo {
  sessionId: number;
  requestedRoomId: number;
  roomId: number;
  ownerUid: number;
  title: string;
  liveStatus: number;
  accessMode: "web-anonymous" | "web-authenticated" | "open-live";
  viewerUid: number | null;
}

export interface LiveStatusPayload {
  sessionId: number;
  roomId: number;
  state: LiveConnectionPhase;
  message: string;
  attempt: number;
}

export interface PopularityUpdate {
  sessionId: number;
  roomId: number;
  popularity: number;
}

export interface ConnectionSnapshot {
  connected: boolean;
  sessionId: number | null;
  roomId: number | null;
}
