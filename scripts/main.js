/**
 * Vade — Foundry VTT sur téléphone et tablette.
 * Point d'entrée : réglages, détection de l'appareil, profil de performance, API publique.
 *
 * API (game.modules.get("vade").api) :
 *   device   : description de l'appareil détecté (voir device.js)
 *   mode     : "phone" | "tablet" | "desktop" — mode effectif (réglage forcé ou détection)
 *   touch    : true si Vade traite l'appareil comme tactile
 *   profile  : profil de performance actif (voir PROFILES dans constants.js)
 *   gestures : gestes tactiles de la carte (voir gestures.js), null hors appareil tactile
 *   ui       : interface tactile (voir interface.js), null hors appareil tactile
 *   phone    : interface téléphone (voir phone/phone.js), null hors téléphone
 *   registerAdapter(systemId, adapter) : ajoute un adaptateur de système pour l'interface
 *                                        téléphone (interface décrite dans adapters/generic.js)
 *   report() : affiche le diagnostic dans la console
 *
 * Hook « vadeReady » (api) : appelé une fois Foundry prêt, pour que d'autres modules
 * (Ember, Vellum…) adaptent leurs effets à api.profile.effectScale.
 */

import { MODULE_ID, DEVICE, AUTO_PROFILE, log, t } from "./constants.js";
import { detectDevice } from "./device.js";
import { applyCanvasConfig, applyCoreSettings, resolveProfile } from "./performance.js";
import { setupViewportMeta, trackVisualViewport, suppressLowResolutionWarning } from "./viewport.js";
import { TouchGestures } from "./gestures.js";
import { TouchInterface } from "./interface.js";
import { PhoneInterface } from "./phone/phone.js";
import { registerAdapter } from "./adapters/index.js";

const api = {
  device: null,
  mode: DEVICE.DESKTOP,
  touch: false,
  profile: null,
  gestures: null,
  ui: null,
  phone: null,
  registerAdapter,
  report
};

/* -------------------------------------------- */
/*  Réglages                                    */
/* -------------------------------------------- */

function registerSettings() {
  game.settings.register(MODULE_ID, "mode", {
    name: "VADE.Settings.Mode.Name",
    hint: "VADE.Settings.Mode.Hint",
    scope: "client",
    config: true,
    type: String,
    choices: {
      auto: "VADE.Settings.Mode.Auto",
      phone: "VADE.Device.phone",
      tablet: "VADE.Device.tablet",
      desktop: "VADE.Device.desktop"
    },
    default: "auto",
    requiresReload: true
  });

  game.settings.register(MODULE_ID, "profile", {
    name: "VADE.Settings.Profile.Name",
    hint: "VADE.Settings.Profile.Hint",
    scope: "client",
    config: true,
    type: String,
    choices: {
      auto: "VADE.Settings.Profile.Auto",
      off: "VADE.Profile.off",
      light: "VADE.Profile.light",
      strong: "VADE.Profile.strong"
    },
    default: "auto",
    requiresReload: true
  });

  game.settings.register(MODULE_ID, "gestures", {
    name: "VADE.Settings.Gestures.Name",
    hint: "VADE.Settings.Gestures.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: value => {
      if (!api.gestures) return;
      if (value) api.gestures.enable();
      else api.gestures.disable();
    }
  });

  game.settings.register(MODULE_ID, "touchInterface", {
    name: "VADE.Settings.TouchInterface.Name",
    hint: "VADE.Settings.TouchInterface.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: value => {
      if (!api.ui) return;
      if (value) api.ui.enable();
      else api.ui.disable();
    }
  });

  game.settings.register(MODULE_ID, "phoneInterface", {
    name: "VADE.Settings.PhoneInterface.Name",
    hint: "VADE.Settings.PhoneInterface.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true
  });

  game.settings.register(MODULE_ID, "tapToMove", {
    name: "VADE.Settings.TapToMove.Name",
    hint: "VADE.Settings.TapToMove.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "manageCore", {
    name: "VADE.Settings.ManageCore.Name",
    hint: "VADE.Settings.ManageCore.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true
  });

  game.settings.register(MODULE_ID, "hideLowResWarning", {
    name: "VADE.Settings.HideLowRes.Name",
    hint: "VADE.Settings.HideLowRes.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true
  });

  // Valeurs d'origine des réglages de Foundry modifiés par Vade, pour les restaurer.
  game.settings.register(MODULE_ID, "savedCore", {
    scope: "client",
    config: false,
    type: Object,
    default: {}
  });

  // Dernière combinaison appareil/profil annoncée au joueur (évite de répéter le message).
  game.settings.register(MODULE_ID, "lastReport", {
    scope: "client",
    config: false,
    type: String,
    default: ""
  });
}

/* -------------------------------------------- */
/*  Initialisation                              */
/* -------------------------------------------- */

Hooks.once("init", () => {
  log("Initialisation");
  registerSettings();

  api.device = detectDevice();
  const forced = game.settings.get(MODULE_ID, "mode");
  api.mode = forced === "auto" ? api.device.kind : forced;
  api.touch = api.mode !== DEVICE.DESKTOP;
  api.profile = resolveProfile(game.settings.get(MODULE_ID, "profile"), AUTO_PROFILE[api.mode]);

  applyBodyClasses();

  if (api.touch) {
    setupViewportMeta();
    trackVisualViewport();
    if (game.settings.get(MODULE_ID, "hideLowResWarning")) suppressLowResolutionWarning();
  }

  const module = game.modules.get(MODULE_ID);
  if (module) module.api = api;

  log(`Appareil : ${api.device.kind} — mode : ${api.mode} — profil : ${api.profile.id}`);
});

// Appelé par Foundry juste avant de créer le rendu du canvas.
Hooks.on("canvasConfig", config => {
  if (api.profile) applyCanvasConfig(config, api.profile);
});

Hooks.once("setup", async () => {
  await applyCoreSettings(api.profile, game.settings.get(MODULE_ID, "manageCore"));
});

Hooks.once("ready", () => {
  applyBodyClasses();
  if (api.touch) {
    api.gestures = new TouchGestures();
    if (game.settings.get(MODULE_ID, "gestures")) api.gestures.enable();
    api.ui = new TouchInterface(api);
    if (game.settings.get(MODULE_ID, "touchInterface")) api.ui.enable();
    if (api.mode === DEVICE.PHONE && game.settings.get(MODULE_ID, "phoneInterface")) {
      api.phone = new PhoneInterface(api);
      api.phone.enable();
    }
  }
  announce();
  Hooks.callAll("vadeReady", api);
});

/* -------------------------------------------- */
/*  Utilitaires                                 */
/* -------------------------------------------- */

/** Classes CSS sur <body> : vade-phone / vade-tablet / vade-desktop, vade-touch, vade-perf-<profil>. */
function applyBodyClasses() {
  const body = document.body;
  if (!body) return;
  for (const kind of Object.values(DEVICE)) body.classList.toggle(`vade-${kind}`, api.mode === kind);
  body.classList.toggle("vade-touch", api.touch);
  for (const id of ["off", "light", "strong"]) body.classList.toggle(`vade-perf-${id}`, api.profile?.id === id);
}

/** Prévient le joueur, une seule fois par combinaison, quand Vade adapte Foundry. */
function announce() {
  if (!api.touch) return;
  const key = `${api.mode}:${api.profile.id}`;
  if (game.settings.get(MODULE_ID, "lastReport") === key) return;
  ui.notifications.info(t("Notify.Detected", {
    device: t(`Device.${api.mode}`),
    profile: t(`Profile.${api.profile.id}`)
  }));
  game.settings.set(MODULE_ID, "lastReport", key);
}

/** Diagnostic dans la console (utile en débogage à distance sur Android). */
function report() {
  console.group("Vade | Diagnostic");
  console.table({ ...api.device, mode: api.mode, touch: api.touch });
  console.table(api.profile);
  try {
    console.log("Résolution du canvas :", canvas?.app?.renderer?.resolution);
    console.log("core.performanceMode :", game.settings.get("core", "performanceMode"));
    console.log("core.maxFPS :", game.settings.get("core", "maxFPS"));
  } catch {
    /* canvas pas encore prêt */
  }
  console.groupEnd();
  return api;
}
