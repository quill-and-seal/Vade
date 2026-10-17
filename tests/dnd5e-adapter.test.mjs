// Tests de l'adaptateur dnd5e, sans Foundry : `node --test` à la racine du dépôt
import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.game = {
  i18n: { lang: "fr", localize: k => k, format: (k, d) => `${k}:${d.level}` },
  system: { id: "dnd5e" }
};
globalThis.CONFIG = {
  DND5E: {
    abilities: { str: { label: "Force", abbreviation: "FOR" }, dex: { label: "Dextérité", abbreviation: "DEX" } },
    skills: { prc: { label: "Perception" } }
  }
};

const { getAdapter } = await import("../scripts/adapters/index.js");
const adapter = getAdapter();

function makeActor() {
  const calls = [];
  const items = [
    { id: "w1", name: "Épée", type: "weapon", system: { equipped: true } },
    { id: "s1", name: "Bouclier", type: "spell", system: { level: 1, preparation: { mode: "prepared", prepared: false } } },
    { id: "s2", name: "Projectile", type: "spell", system: { level: 1, preparation: { mode: "prepared", prepared: true } } },
    { id: "f1", name: "Passif", type: "feat", system: {} }
  ];
  const itemTypes = {};
  for (const item of items) (itemTypes[item.type] ??= []).push(item);
  return {
    calls,
    type: "character",
    itemTypes,
    system: {
      attributes: { hp: { value: 20, max: 31, temp: 4 }, ac: { value: 15 } },
      abilities: { dex: { mod: 3, save: { value: 6 } }, str: { mod: -1, save: -1 } },
      skills: { prc: { total: 4, passive: 14 } },
      spells: { spell1: { value: 2, max: 4 } }
    },
    rollAbilityCheck: o => calls.push(["check", o]),
    rollSavingThrow: o => calls.push(["save", o]),
    rollSkill: o => calls.push(["skill", o]),
    applyDamage: n => calls.push(["damage", n]),
    update: d => calls.push(["update", d])
  };
}

test("les jets passent par l'API dnd5e 4+", async () => {
  const actor = makeActor();
  await adapter.roll(actor, "ability:dex");
  await adapter.roll(actor, "save:str");
  await adapter.roll(actor, "skill:prc");
  assert.deepEqual(actor.calls, [["check", { ability: "dex" }], ["save", { ability: "str" }], ["skill", { skill: "prc" }]]);
});

test("les jets retombent sur l'API 3.x", async () => {
  const calls = [];
  const actor = { rollAbilityTest: k => calls.push(["test", k]), rollSkill: k => calls.push(["skill", k]) };
  await adapter.roll(actor, "ability:str");
  await adapter.roll(actor, "skill:prc");
  assert.deepEqual(calls, [["test", "str"], ["skill", "prc"]]);
});

test("PV : un ajout soigne, un retrait blesse, la saisie est bornée", async () => {
  const actor = makeActor();
  await adapter.adjustResource(actor, "hp", 3);
  await adapter.adjustResource(actor, "hp", -5);
  await adapter.setResource(actor, "hp", 99);
  assert.deepEqual(actor.calls, [["damage", -3], ["damage", 5], ["update", { "system.attributes.hp.value": 31 }]]);
});

test("résumé : sauvegarde objet (4+) ou nombre (3.x)", () => {
  const saves = adapter.character(makeActor()).rollGroups.find(g => g.id === "saves").rolls;
  assert.deepEqual(saves.map(r => r.mod), ["-1", "+6"]); // FOR puis DEX
});

test("actions : sorts groupés par niveau, emplacements, non préparés grisés, passifs exclus", () => {
  const groups = adapter.actions(makeActor());
  assert.deepEqual(groups.map(g => g.id), ["weapons", "spells-1"]);
  const spells = groups[1];
  assert.equal(spells.note, "2/4");
  assert.deepEqual(spells.items.map(i => [i.name, i.dim]), [["Bouclier", true], ["Projectile", false]]);
});
