/** Shared source-canvas and QR geometry for every login character cutout. */
export const LOGIN_CHARACTER_ALIGNMENT = {
  canvasWidthPx: 1536,
  canvasHeightPx: 1024,
  qrSizePx: 300,
} as const;

/** A login artwork and the measured edges of its native transparent opening. */
export interface LoginCharacterArtwork {
  /** Stable identifier exposed in DevTools for the randomly selected artwork. */
  readonly id: string;
  /** Transparent cutout served from the public directory. */
  readonly src: string;
  /** Rightmost source x-coordinate of the left character near the QR opening. */
  readonly innerLeftPx: number;
  /** Leftmost source x-coordinate of the right character near the QR opening. */
  readonly innerRightPx: number;
  /**
   * Extra CSS pixels that EACH side moves toward the center after automatic
   * 300x300 QR-box alignment. Positive values narrow the opening; negative values widen it.
   */
  readonly centerOffsetPx: number;
  /** Extra CSS pixels applied only to this artwork's QR board. Positive moves it down. */
  readonly qrOffsetYPx: number;
}

/**
 * Native opening measurements for the local 1536x1024 cutouts.
 * The layout automatically scales these values and aligns every entry to the 300x300 QR box.
 * Keep centerOffsetPx at 0 for exact box alignment, or fine-tune one image here.
 */
export const LOGIN_CHARACTER_ARTWORKS = [
  { id: "login1", src: "/login1-cutout.png", innerLeftPx: 365, innerRightPx: 1187, centerOffsetPx: 0, qrOffsetYPx: 0 },
  { id: "login2", src: "/login2-cutout.png", innerLeftPx: 446, innerRightPx: 1088, centerOffsetPx: 0, qrOffsetYPx: -2 },
  { id: "login3", src: "/login3-cutout.png", innerLeftPx: 454, innerRightPx: 1078, centerOffsetPx: 0, qrOffsetYPx: 0 },
  { id: "login4", src: "/login4-cutout.png", innerLeftPx: 492, innerRightPx: 1040, centerOffsetPx: 0, qrOffsetYPx: 0 },
  { id: "login5", src: "/login5-cutout.png", innerLeftPx: 453, innerRightPx: 1076, centerOffsetPx: 0, qrOffsetYPx: -2 },
] as const satisfies readonly LoginCharacterArtwork[];
