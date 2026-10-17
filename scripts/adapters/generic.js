/**
 * Adaptateur générique : utilisé pour tout système de jeu sans adaptateur dédié.
 *
 * Interface commune des adaptateurs (toutes les méthodes reçoivent l'acteur) :
 *   character(actor) → { subtitle, resources: [{id, label, value, max, temp?}],
 *                        stats: [{label, value}], rollGroups: [{id, label, columns?, rolls: [{id, label, mod?}]}],
 *                        rests: [{id, label}] }
 *   roll(actor, id)              lance le jet identifié (ids fournis par character)
 *   adjustResource(actor, id, delta)   ajoute delta à la ressource (négatif = retirer)
 *   setResource(actor, id, value)      fixe la ressource
 *   rest(actor, id)
 *   actions(actor) → [{id, label, note?, items: [{id, name, img, note?, dim?}]}]
 *   useAction(actor, itemId)
 *   rollData(actor) → données passées aux jets de la vue Dés (null = aucune)
 *
 * Le générique ne connaît pas les règles : il liste les objets de l'acteur et
 * les utilise par la méthode la plus courante que les systèmes leur donnent.
 */

export const genericAdapter = {
  id: "generic",

  character(actor) {
    return { subtitle: "", resources: [], stats: [], rollGroups: [], rests: [] };
  },

  async roll() {},
  async adjustResource() {},
  async setResource() {},
  async rest() {},

  actions(actor) {
    const items = actor.items.contents
      .slice()
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
      .map(item => ({ id: item.id, name: item.name, img: item.img, note: typeLabel(item) }));
    return items.length ? [{ id: "items", label: game.i18n.localize("VADE.Phone.Items"), items }] : [];
  },

  async useAction(actor, itemId) {
    const item = actor.items.get(itemId);
    if (!item) return;
    if (typeof item.use === "function") return item.use();
    if (typeof item.roll === "function") return item.roll();
    return item.sheet?.render(true);
  },

  rollData(actor) {
    return actor?.getRollData?.() ?? null;
  }
};

/** Libellé du type d'objet, traduit par le système s'il le fournit. */
export function typeLabel(item) {
  const key = CONFIG.Item?.typeLabels?.[item.type];
  return key ? game.i18n.localize(key) : item.type;
}
