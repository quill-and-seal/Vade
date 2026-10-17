/**
 * Choix de l'adaptateur selon le système de jeu du monde.
 * Pour ajouter un système : écrire un adaptateur sur le modèle de dnd5e.js
 * (interface décrite dans generic.js) et l'ajouter à ADAPTERS.
 */

import { genericAdapter } from "./generic.js";
import { dnd5eAdapter } from "./dnd5e.js";

const ADAPTERS = {
  dnd5e: dnd5eAdapter
};

/** Adaptateurs ajoutés par d'autres modules via l'API de Vade. */
const registered = {};

export function registerAdapter(systemId, adapter) {
  registered[systemId] = { ...genericAdapter, ...adapter };
}

export function getAdapter() {
  const id = game.system?.id;
  return registered[id] ?? ADAPTERS[id] ?? genericAdapter;
}
