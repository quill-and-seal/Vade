/**
 * Rendu des onglets de l'interface téléphone.
 * Les vues renvoient du HTML ; les boutons portent data-action, traité par phone.js.
 */

import { t } from "../constants.js";

const DICE = ["d20", "d12", "d10", "d8", "d6", "d4", "d100"];

/** Échappe un texte pour l'insérer dans du HTML. */
export function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function empty(key) {
  return `<p class="vade-empty">${t(key)}</p>`;
}

/* -------------------------------------------- */
/*  Personnage                                  */
/* -------------------------------------------- */

export function renderCharacter(actor, adapter) {
  if (!actor) return empty("Phone.NoActor");
  const data = adapter.character(actor);

  const head = `
    <div class="vade-char-head">
      <img src="${esc(actor.img)}" alt="">
      <div>
        <h3>${esc(actor.name)}</h3>
        ${data.subtitle ? `<p>${esc(data.subtitle)}</p>` : ""}
      </div>
    </div>`;

  const resources = data.resources.map(r => {
    const pct = r.max ? Math.max(0, Math.min(100, (r.value / r.max) * 100)) : 0;
    return `
      <div class="vade-resource">
        <div class="vade-resource-top">
          <span class="vade-resource-label">${esc(r.label)}</span>
          ${r.temp ? `<span class="vade-resource-temp">+${esc(r.temp)}</span>` : ""}
        </div>
        <div class="vade-bar"><span style="width:${pct}%"></span></div>
        <div class="vade-resource-controls">
          <button type="button" data-action="resource" data-id="${esc(r.id)}" data-delta="-5">−5</button>
          <button type="button" data-action="resource" data-id="${esc(r.id)}" data-delta="-1">−1</button>
          <span class="vade-resource-value">
            <input type="number" inputmode="numeric" data-resource-input="${esc(r.id)}" value="${esc(r.value)}">
            <span>/ ${esc(r.max)}</span>
          </span>
          <button type="button" data-action="resource" data-id="${esc(r.id)}" data-delta="1">+1</button>
          <button type="button" data-action="resource" data-id="${esc(r.id)}" data-delta="5">+5</button>
        </div>
      </div>`;
  }).join("");

  const stats = data.stats.length
    ? `<div class="vade-stats">${data.stats.map(s =>
      `<div class="vade-stat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join("")}</div>`
    : "";

  const groups = data.rollGroups.filter(g => g.rolls.length).map(g => `
    <details class="vade-group" ${g.id === "abilities" ? "open" : ""}>
      <summary>${esc(g.label)}</summary>
      <div class="vade-grid" style="--vade-cols:${g.columns ?? 2}">
        ${g.rolls.map(r => `
          <button type="button" class="vade-roll" data-action="roll" data-id="${esc(r.id)}">
            <span>${esc(r.label)}</span>${r.mod != null ? `<b>${esc(r.mod)}</b>` : ""}
          </button>`).join("")}
      </div>
    </details>`).join("");

  const rests = data.rests.length
    ? `<div class="vade-row">${data.rests.map(r =>
      `<button type="button" class="vade-button" data-action="rest" data-id="${esc(r.id)}">${esc(r.label)}</button>`).join("")}</div>`
    : "";

  return head + resources + stats + groups + rests + sheetButton();
}

/* -------------------------------------------- */
/*  Actions                                     */
/* -------------------------------------------- */

export function renderActions(actor, adapter) {
  if (!actor) return empty("Phone.NoActor");
  const groups = adapter.actions(actor);
  if (!groups.length) return empty("Phone.NoActions") + sheetButton();

  return groups.map(g => `
    <section class="vade-action-group">
      <h4>${esc(g.label)}${g.note ? `<span>${esc(g.note)}</span>` : ""}</h4>
      ${g.items.map(item => `
        <button type="button" class="vade-action${item.dim ? " dim" : ""}" data-action="use" data-id="${esc(item.id)}">
          <img src="${esc(item.img)}" alt="">
          <span class="vade-action-name">${esc(item.name)}</span>
          ${item.note ? `<span class="vade-action-note">${esc(item.note)}</span>` : ""}
        </button>`).join("")}
    </section>`).join("");
}

function sheetButton() {
  return `<button type="button" class="vade-button vade-button-wide" data-action="sheet">
    <i class="fa-solid fa-book-open"></i> ${t("Phone.FullSheet")}</button>`;
}

/* -------------------------------------------- */
/*  Dés                                         */
/* -------------------------------------------- */

/** Formule de la réserve de dés : « 2d6 + 1d20 + 3 ». Vide si aucun dé. */
export function buildFormula({ pool, mod }) {
  const parts = DICE.filter(d => pool[d] > 0).map(d => `${pool[d]}${d}`);
  if (!parts.length) return "";
  let formula = parts.join(" + ");
  if (mod > 0) formula += ` + ${mod}`;
  else if (mod < 0) formula += ` - ${Math.abs(mod)}`;
  return formula;
}

export function renderDice(state) {
  const formula = buildFormula(state);
  const mod = state.mod > 0 ? `+${state.mod}` : String(state.mod);
  return `
    <div class="vade-row vade-quick">
      <button type="button" class="vade-button" data-action="dice-quick" data-formula="1d20">d20</button>
      <button type="button" class="vade-button" data-action="dice-quick" data-formula="2d20kh">${t("Phone.Advantage")}</button>
      <button type="button" class="vade-button" data-action="dice-quick" data-formula="2d20kl">${t("Phone.Disadvantage")}</button>
    </div>
    <div class="vade-dice">
      ${DICE.map(d => `
        <button type="button" class="vade-die" data-action="die" data-id="${d}">
          <span>${d}</span>
          ${state.pool[d] ? `<b>${state.pool[d]}</b>` : ""}
        </button>`).join("")}
    </div>
    <div class="vade-modifier">
      <button type="button" data-action="mod" data-delta="-1">−</button>
      <span>${t("Phone.Modifier")} <b>${esc(mod)}</b></span>
      <button type="button" data-action="mod" data-delta="1">+</button>
    </div>
    <p class="vade-formula">${formula ? esc(formula) : t("Phone.PickDice")}</p>
    <div class="vade-row">
      <button type="button" class="vade-button" data-action="dice-clear">${t("Phone.Clear")}</button>
      <button type="button" class="vade-button vade-primary" data-action="dice-roll" ${formula ? "" : "disabled"}>
        <i class="fa-solid fa-dice"></i> ${t("Phone.Roll")}
      </button>
    </div>
    ${state.last ? `<p class="vade-result">${t("Phone.Result")} <b>${esc(state.last.total)}</b>
      <span>(${esc(state.last.formula)})</span></p>` : ""}`;
}

/* -------------------------------------------- */
/*  Chat                                        */
/* -------------------------------------------- */

const CHAT_HISTORY = 40;

/**
 * Vue du chat : les derniers messages, rendus par Foundry lui-même (le système et les
 * modules y attachent leurs boutons comme dans le chat normal), et un champ de saisie.
 */
export class ChatView {
  #list = null;
  #elements = new Map();

  async attach(container) {
    container.innerHTML = `
      <ol class="vade-chat-log"></ol>
      <form class="vade-chat-form">
        <textarea rows="1" placeholder="${t("Phone.ChatPlaceholder")}" enterkeyhint="send"></textarea>
        <button type="submit" class="vade-icon-button" aria-label="${t("Phone.Send")}">
          <i class="fa-solid fa-paper-plane"></i>
        </button>
      </form>`;
    this.#list = container.querySelector(".vade-chat-log");
    this.#elements.clear();

    // Entrée envoie, Maj+Entrée revient à la ligne.
    const field = container.querySelector("textarea");
    field.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        field.form.requestSubmit();
      }
    });

    const messages = game.messages.contents.filter(m => m.visible).slice(-CHAT_HISTORY);
    for (const message of messages) await this.add(message, false);
    this.#scrollToEnd();
  }

  detach() {
    this.#list = null;
    this.#elements.clear();
  }

  async add(message, scroll = true) {
    if (!this.#list) return;
    const el = await renderMessage(message);
    if (!el || !this.#list) return;
    const li = document.createElement("li");
    li.appendChild(el);
    this.#list.appendChild(li);
    this.#elements.set(message.id, li);
    while (this.#list.children.length > CHAT_HISTORY) {
      const first = this.#list.firstElementChild;
      for (const [id, node] of this.#elements) if (node === first) this.#elements.delete(id);
      first.remove();
    }
    if (scroll) this.#scrollToEnd();
  }

  async update(message) {
    const li = this.#elements.get(message.id);
    if (!li) return;
    const el = await renderMessage(message);
    if (el) li.replaceChildren(el);
  }

  remove(message) {
    this.#elements.get(message.id)?.remove();
    this.#elements.delete(message.id);
  }

  async send(text) {
    if (typeof ui.chat?.processMessage === "function") return ui.chat.processMessage(text);
    const ChatMessage = CONFIG.ChatMessage.documentClass;
    return ChatMessage.create({ content: esc(text), speaker: ChatMessage.getSpeaker() });
  }

  #scrollToEnd() {
    const list = this.#list;
    if (list) requestAnimationFrame(() => list.lastElementChild?.scrollIntoView({ block: "end" }));
  }
}

async function renderMessage(message) {
  try {
    if (typeof message.renderHTML === "function") return await message.renderHTML();
    const html = await message.getHTML();
    return html instanceof HTMLElement ? html : html[0];
  } catch (err) {
    console.warn("Vade | Message impossible à afficher", err);
    return null;
  }
}
