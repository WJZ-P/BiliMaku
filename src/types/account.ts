export type LoginPhase =
  | "checking"
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
  persisted: boolean;
  validatedAt: number | null;
}

export type AccountEventKind =
  | "qr-created"
  | "qr-expired"
  | "login"
  | "restored"
  | "validated"
  | "validation-error"
  | "cookie-expired"
  | "session-error"
  | "logout";

export interface BilibiliAccountEvent {
  kind: AccountEventKind;
  status: BilibiliLoginStatus;
  occurredAt: number;
}

export interface QrLoginTicket {
  imageDataUrl: string;
  expiresInSeconds: number;
}
