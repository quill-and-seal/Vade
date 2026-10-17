/** Identifiant du module, utilisé pour les réglages, les classes CSS et l'API. */
export const MODULE_ID = "vade";

/** Types d'appareil reconnus par Vade. */
export const DEVICE = Object.freeze({
  PHONE: "phone",
  TABLET: "tablet",
  DESKTOP: "desktop"
});

/**
 * Plus petit côté de l'écran (en pixels CSS) en dessous duquel un appareil tactile
 * est traité comme un téléphone. On prend le petit côté pour que le résultat
 * ne change pas quand on tourne l'appareil.
 */
export const PHONE_MAX_SHORT_SIDE = 600;

/**
 * Profils de performance.
 *
 * resolutionCap   : résolution maximale du rendu du canvas (null = celle de l'écran).
 *                   Sur mobile, le devicePixelRatio vaut souvent 2 à 3 : rendre la carte
 *                   à cette résolution coûte 4 à 9 fois plus de pixels qu'à 1.
 * maxFPS          : plafond d'images par seconde imposé à Foundry (null = inchangé).
 * performanceMode : mode performance de Foundry (0 bas, 1 moyen, 2 élevé, 3 max ; null = inchangé).
 * antialias       : antialiasing du canvas (null = inchangé).
 * effectScale     : facteur conseillé aux autres modules (particules d'Ember, rasterisation
 *                   de Vellum…) pour alléger leurs effets. 1 = pleine qualité.
 */
export const PROFILES = Object.freeze({
  off: Object.freeze({
    id: "off",
    resolutionCap: null,
    maxFPS: null,
    performanceMode: null,
    antialias: null,
    effectScale: 1
  }),
  light: Object.freeze({
    id: "light",
    resolutionCap: 1.5,
    maxFPS: 60,
    performanceMode: 1,
    antialias: null,
    effectScale: 0.6
  }),
  strong: Object.freeze({
    id: "strong",
    resolutionCap: 1,
    maxFPS: 30,
    performanceMode: 0,
    antialias: false,
    effectScale: 0.3
  })
});

/** Profil choisi en mode automatique selon l'appareil. */
export const AUTO_PROFILE = Object.freeze({
  [DEVICE.PHONE]: "strong",
  [DEVICE.TABLET]: "light",
  [DEVICE.DESKTOP]: "off"
});

/** Préfixe des messages console. */
export function log(...args) {
  console.log("Vade |", ...args);
}

/** Raccourci de traduction. */
export function t(key, data) {
  const full = `VADE.${key}`;
  return data ? game.i18n.format(full, data) : game.i18n.localize(full);
}
