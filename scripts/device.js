/**
 * Détection de l'appareil : téléphone, tablette ou ordinateur.
 *
 * On ne lit pas le user-agent (trompeur, et les tablettes se font souvent passer pour
 * des ordinateurs). On regarde ce que le navigateur dit du pointeur et de l'écran :
 *  - un appareil est tactile si son pointeur principal est grossier (un doigt),
 *    ou s'il a des points de contact et aucun pointeur fin (souris, trackpad) ;
 *  - parmi les appareils tactiles, le plus petit côté de l'écran sépare téléphone et tablette.
 * Un ordinateur portable à écran tactile garde un pointeur principal fin : il reste « ordinateur ».
 */

import { DEVICE, PHONE_MAX_SHORT_SIDE } from "./constants.js";

function matches(query) {
  try {
    return window.matchMedia?.(query).matches ?? false;
  } catch {
    return false;
  }
}

/**
 * Décrit l'appareil courant.
 * @returns {{kind: string, touch: boolean, coarse: boolean, anyFine: boolean,
 *            touchPoints: number, shortSide: number, longSide: number, dpr: number}}
 */
export function detectDevice() {
  const coarse = matches("(pointer: coarse)");
  const anyFine = matches("(any-pointer: fine)");
  const touchPoints = navigator.maxTouchPoints ?? 0;
  const touch = coarse || (touchPoints > 0 && !anyFine);

  const w = window.screen?.width || window.innerWidth;
  const h = window.screen?.height || window.innerHeight;
  const shortSide = Math.min(w, h);
  const longSide = Math.max(w, h);

  let kind = DEVICE.DESKTOP;
  if (touch) kind = shortSide < PHONE_MAX_SHORT_SIDE ? DEVICE.PHONE : DEVICE.TABLET;

  return {
    kind,
    touch,
    coarse,
    anyFine,
    touchPoints,
    shortSide,
    longSide,
    dpr: window.devicePixelRatio || 1
  };
}
