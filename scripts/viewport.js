/**
 * Réglages de la fenêtre pour les appareils tactiles :
 *  - balise viewport : on bloque le zoom du navigateur sur toute la page, pour que
 *    le pincement soit réservé au canvas (gestes de l'étape 2) ;
 *  - clavier virtuel : la hauteur visible réelle est exposée en variable CSS
 *    (--vade-viewport-height) et la classe vade-keyboard-open signale le clavier ouvert ;
 *  - avertissement « résolution trop faible » de Foundry : masqué si le réglage est actif.
 */

import { log } from "./constants.js";

const LOW_RES_KEY = "ERROR.LowResolution";

/** Force une balise viewport adaptée au tactile. */
export function setupViewportMeta() {
  let meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "viewport";
    document.head.appendChild(meta);
  }
  meta.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
}

/** Suit la zone visible (qui rétrécit quand le clavier virtuel s'ouvre). */
export function trackVisualViewport() {
  const vv = window.visualViewport;
  const root = document.documentElement;
  const update = () => {
    const height = vv?.height ?? window.innerHeight;
    root.style.setProperty("--vade-viewport-height", `${Math.round(height)}px`);
    // Un clavier virtuel masque au moins un quart de l'écran.
    document.body?.classList.toggle("vade-keyboard-open", height < window.innerHeight * 0.75);
  };
  update();
  vv?.addEventListener("resize", update);
  vv?.addEventListener("scroll", update);
  window.addEventListener("resize", update);
}

/**
 * Filtre l'avertissement de résolution de Foundry. On enveloppe la méthode notify
 * du gestionnaire de notifications : tout autre message passe sans changement.
 */
export function suppressLowResolutionWarning() {
  const Notifications = foundry.applications?.ui?.Notifications ?? globalThis.Notifications;
  const proto = Notifications?.prototype;
  if (!proto?.notify || proto.notify.__vade) return;

  const original = proto.notify;
  const wrapped = function (message, type, options = {}) {
    if (isLowResolutionMessage(message)) {
      log("Avertissement de résolution de Foundry masqué");
      return null;
    }
    return original.call(this, message, type, options);
  };
  wrapped.__vade = true;
  proto.notify = wrapped;
}

function isLowResolutionMessage(message) {
  if (typeof message !== "string") return false;
  if (message === LOW_RES_KEY) return true;
  const localized = game.i18n?.localize(LOW_RES_KEY);
  if (!localized || localized === LOW_RES_KEY) return false;
  // Le texte peut être formaté avec la taille de l'écran : on compare son début.
  return message.startsWith(localized.slice(0, 40));
}
