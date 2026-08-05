export type LoginPhase =
  | "anonymous"
  | "waiting"
  | "scanned"
  | "authenticated"
  | "expired";

export interface AccountProfile {
  uid: string;
  username: string;
  avatar: string;
}

export interface BilibiliLoginStatus {
  phase: LoginPhase;
  message: string;
  profile: AccountProfile | null;
}

export interface QrLoginTicket {
  imageDataUrl: string;
  expiresInSeconds: number;
}
