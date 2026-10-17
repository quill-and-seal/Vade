/**
 * Profil de performance mobile.
 *
 * Trois leviers :
 *  1. la résolution du rendu du canvas, plafonnée via le hook « canvasConfig »
 *     (appelé par Foundry juste avant de créer l'application PIXI) ;
 *  2. deux réglages client de Foundry, le mode performance et le plafond de FPS,
 *     abaissés si nécessaire (jamais remontés). Les valeurs d'origine sont gardées
 *     et restaurées quand le profil repasse sur « désactivé » ;
 *  3. un facteur effectScale exposé dans l'API, que les autres modules peuvent lire
 *     pour alléger leurs propres effets.
 *
 * Les réglages client de Foundry sont propres à chaque navigateur : les modifier
 * sur le téléphone d'un joueur ne touche ni son ordinateur ni les autres joueurs.
 */

import { MODULE_ID, PROFILES, log } from "./constants.js";

const CORE_KEYS = ["performanceMode", "maxFPS"];

/**
 * Plafonne la résolution et coupe l'antialiasing selon le profil.
 * À appeler depuis le hook « canvasConfig ».
 */
export function applyCanvasConfig(config, profile) {
  if (profile.resolutionCap != null && config.resolution > profile.resolutionCap) {
    log(`Résolution du canvas : ${config.resolution} → ${profile.resolutionCap}`);
    config.resolution = profile.resolutionCap;
  }
  if (profile.antialias === false && config.antialias) {
    config.antialias = false;
  }
}

/** Valeur cible d'un réglage de Foundry pour ce profil (null = ne pas toucher). */
function targetFor(key, profile) {
  return profile[key] ?? null;
}

async function setCore(key, value) {
  try {
    await game.settings.set("core", key, value);
    return true;
  } catch (err) {
    console.warn(`Vade | Impossible de régler core.${key}`, err);
    return false;
  }
}

/**
 * Abaisse les réglages de Foundry pour ce profil, ou restaure ceux d'origine
 * si le profil est « désactivé » ou que la gestion est coupée.
 */
export async function applyCoreSettings(profile, manage) {
  const saved = foundry.utils.deepClone(game.settings.get(MODULE_ID, "savedCore") ?? {});
  let changed = false;

  for (const key of CORE_KEYS) {
    const target = manage ? targetFor(key, profile) : null;
    let current;
    try {
      current = game.settings.get("core", key);
    } catch {
      continue; // réglage absent de cette version de Foundry
    }

    if (target == null) {
      // Rien à imposer : on rend la valeur d'origine si Vade l'avait modifiée
      // et que l'utilisateur n'y a pas touché depuis.
      if (key in saved) {
        if (current === saved[key].applied) await setCore(key, saved[key].original);
        delete saved[key];
        changed = true;
      }
      continue;
    }

    if (current > target) {
      const original = key in saved ? saved[key].original : current;
      if (await setCore(key, target)) {
        saved[key] = { original, applied: target };
        changed = true;
        log(`core.${key} : ${current} → ${target}`);
      }
    }
  }

  if (changed) await game.settings.set(MODULE_ID, "savedCore", saved);
}

/** Résout l'identifiant de profil réglé (auto compris) en objet profil. */
export function resolveProfile(setting, auto) {
  const id = setting === "auto" ? auto : setting;
  return PROFILES[id] ?? PROFILES.off;
}
