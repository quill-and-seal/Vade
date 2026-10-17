/**
 * Adaptateur dnd5e.
 *
 * Fonctionne avec l'API des jets de dnd5e 4 et 5 (rollAbilityCheck({ability}), rollSkill({skill})…)
 * et retombe sur celle de la 3.x (rollAbilityTest, rollSkill(id)…) si elle est absente.
 * Les chemins de données utilisés (attributes.hp, abilities, skills, spells.spellN) sont
 * les mêmes de la 3.x à la 5.x.
 */

import { genericAdapter } from "./generic.js";

const ABILITY_ORDER = ["str", "dex", "con", "int", "wis", "cha"];

function cfg() {
  return CONFIG.DND5E ?? {};
}

/** Libellé d'une entrée de CONFIG.DND5E (objet {label} depuis la 3.x, chaîne avant). */
function label(entry, fallback) {
  if (!entry) return fallback;
  const raw = typeof entry === "string" ? entry : entry.label ?? fallback;
  return game.i18n.localize(raw);
}

function abbreviation(key) {
  const entry = cfg().abilities?.[key];
  const raw = typeof entry === "object" ? entry.abbreviation : null;
  return raw ? game.i18n.localize(raw) : key.toUpperCase();
}

function signed(n) {
  const v = Number(n) || 0;
  return v >= 0 ? `+${v}` : `${v}`;
}

/** Valeur du bonus de sauvegarde (nombre jusqu'en 3.x, objet {value} depuis la 4.x). */
function saveValue(ability) {
  const save = ability?.save;
  return typeof save === "object" ? save?.value ?? 0 : save ?? 0;
}

/** API des jets de dnd5e 4+ ? */
function modernRolls(actor) {
  return typeof actor.rollAbilityCheck === "function";
}

function usesNote(item) {
  const uses = item.system?.uses;
  const max = Number(uses?.max);
  if (!max) return null;
  return `${uses.value ?? 0}/${max}`;
}

/** Sort non préparé (préparation ancienne : system.preparation ; 5.x : system.method + system.prepared). */
function unprepared(item) {
  const s = item.system ?? {};
  if (s.preparation) return s.preparation.mode === "prepared" && !s.preparation.prepared;
  if ("method" in s && "prepared" in s) return s.method === "spell" && !s.prepared;
  return false;
}

function hasActivities(item) {
  const acts = item.system?.activities;
  return !!(acts && (acts.size ?? acts.length ?? Object.keys(acts).length));
}

function row(item, note, dim = false) {
  return { id: item.id, name: item.name, img: item.img, note, dim };
}

export const dnd5eAdapter = {
  id: "dnd5e",

  character(actor) {
    const sys = actor.system ?? {};
    const attr = sys.attributes ?? {};
    const t = key => game.i18n.localize(`VADE.Dnd5e.${key}`);

    // Sous-titre : espèce et classes (ou FP pour un PNJ).
    const species = actor.itemTypes?.race?.[0]?.name;
    const classes = (actor.itemTypes?.class ?? []).map(c => `${c.name} ${c.system?.levels ?? ""}`.trim());
    let subtitle = [species, ...classes].filter(Boolean).join(" · ");
    if (!subtitle && sys.details?.cr != null) subtitle = `${t("CR")} ${sys.details.cr}`;

    const hp = attr.hp ?? {};
    const resources = [{
      id: "hp",
      label: t("HP"),
      value: hp.value ?? 0,
      max: hp.effectiveMax ?? hp.max ?? 0,
      temp: hp.temp || 0
    }];

    const stats = [];
    if (attr.ac?.value != null) stats.push({ label: t("AC"), value: attr.ac.value });
    const init = attr.init?.total ?? attr.init?.mod;
    if (init != null) stats.push({ label: t("Init"), value: signed(init) });
    const walk = attr.movement?.walk;
    if (walk) stats.push({ label: t("Speed"), value: `${walk} ${attr.movement.units ?? ""}`.trim() });
    if (attr.prof != null) stats.push({ label: t("Prof"), value: signed(attr.prof) });
    const passive = sys.skills?.prc?.passive;
    if (passive != null) stats.push({ label: t("Passive"), value: passive });

    const abilityKeys = Object.keys(sys.abilities ?? {}).sort(
      (a, b) => (ABILITY_ORDER.indexOf(a) + 1 || 99) - (ABILITY_ORDER.indexOf(b) + 1 || 99));

    const rollGroups = [
      {
        id: "abilities",
        label: t("Abilities"),
        columns: 3,
        rolls: abilityKeys.map(k => ({ id: `ability:${k}`, label: abbreviation(k), mod: signed(sys.abilities[k].mod) }))
      },
      {
        id: "saves",
        label: t("Saves"),
        columns: 3,
        rolls: abilityKeys.map(k => ({ id: `save:${k}`, label: abbreviation(k), mod: signed(saveValue(sys.abilities[k])) }))
      },
      {
        id: "skills",
        label: t("Skills"),
        columns: 2,
        rolls: Object.entries(sys.skills ?? {})
          .map(([k, s]) => ({ id: `skill:${k}`, label: label(cfg().skills?.[k], k), mod: signed(s.total ?? s.mod) }))
          .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang))
      },
      {
        id: "other",
        label: t("Other"),
        columns: 2,
        rolls: [
          { id: "init", label: t("Initiative") },
          ...(actor.type === "character" ? [{ id: "death", label: t("DeathSave") }] : [])
        ]
      }
    ];

    const rests = [];
    if (typeof actor.shortRest === "function") rests.push({ id: "short", label: t("ShortRest") });
    if (typeof actor.longRest === "function") rests.push({ id: "long", label: t("LongRest") });

    return { subtitle, resources, stats, rollGroups, rests };
  },

  async roll(actor, id) {
    const [kind, key] = id.split(":");
    const modern = modernRolls(actor);
    switch (kind) {
      case "ability":
        return modern ? actor.rollAbilityCheck({ ability: key }) : actor.rollAbilityTest?.(key);
      case "save":
        return modern ? actor.rollSavingThrow({ ability: key }) : actor.rollAbilitySave?.(key);
      case "skill":
        return modern ? actor.rollSkill({ skill: key }) : actor.rollSkill?.(key);
      case "init":
        return actor.rollInitiativeDialog?.() ?? actor.rollInitiative?.({ createCombatants: true });
      case "death":
        return actor.rollDeathSave?.();
    }
  },

  async adjustResource(actor, id, delta) {
    if (id !== "hp" || !delta) return;
    // applyDamage gère les PV temporaires et les bornes ; une valeur négative soigne.
    if (typeof actor.applyDamage === "function") return actor.applyDamage(-delta);
    const hp = actor.system.attributes.hp;
    return this.setResource(actor, id, (hp.value ?? 0) + delta);
  },

  async setResource(actor, id, value) {
    if (id !== "hp") return;
    const hp = actor.system.attributes.hp;
    const max = hp.effectiveMax ?? hp.max ?? value;
    const clamped = Math.max(0, Math.min(Math.round(value), max));
    return actor.update({ "system.attributes.hp.value": clamped });
  },

  async rest(actor, id) {
    if (id === "short") return actor.shortRest?.();
    if (id === "long") return actor.longRest?.();
  },

  actions(actor) {
    const t = key => game.i18n.localize(`VADE.Dnd5e.${key}`);
    const types = actor.itemTypes ?? {};
    const groups = [];
    const bySort = (a, b) => (a.sort ?? 0) - (b.sort ?? 0);

    const weapons = (types.weapon ?? []).slice().sort((a, b) =>
      (Number(!!b.system?.equipped) - Number(!!a.system?.equipped)) || bySort(a, b));
    if (weapons.length) {
      groups.push({
        id: "weapons",
        label: t("Weapons"),
        items: weapons.map(w => row(w, usesNote(w), w.system?.equipped === false))
      });
    }

    // Sorts groupés par niveau, avec les emplacements restants dans l'en-tête.
    const spells = (types.spell ?? []).slice().sort(bySort);
    const levels = [...new Set(spells.map(s => s.system?.level ?? 0))].sort((a, b) => a - b);
    for (const level of levels) {
      const slot = actor.system?.spells?.[`spell${level}`];
      const note = level > 0 && slot?.max ? `${slot.value ?? 0}/${slot.max}` : null;
      groups.push({
        id: `spells-${level}`,
        label: level === 0 ? t("Cantrips") : game.i18n.format("VADE.Dnd5e.SpellLevel", { level }),
        note,
        items: spells.filter(s => (s.system?.level ?? 0) === level).map(s => row(s, usesNote(s), unprepared(s)))
      });
    }

    const features = (types.feat ?? []).filter(f => hasActivities(f) || usesNote(f)).sort(bySort);
    if (features.length) {
      groups.push({ id: "features", label: t("Features"), items: features.map(f => row(f, usesNote(f))) });
    }

    const consumables = (types.consumable ?? []).filter(c => (c.system?.quantity ?? 1) > 0).sort(bySort);
    if (consumables.length) {
      groups.push({
        id: "consumables",
        label: t("Consumables"),
        items: consumables.map(c => row(c, usesNote(c) ?? `×${c.system?.quantity ?? 1}`))
      });
    }

    return groups;
  },

  useAction: genericAdapter.useAction,
  rollData: genericAdapter.rollData
};
