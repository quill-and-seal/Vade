/**
 * Interface téléphone.
 *
 * L'interface de Foundry (sidebar, barre de macros, contrôles de scène, liste des joueurs)
 * est masquée au profit d'une barre d'onglets en bas : Personnage · Actions · Dés · Chat.
 * Un onglet ouvre un panneau qui couvre le bas de l'écran ; la carte reste visible au-dessus.
 * Toucher l'onglet actif, la croix ou la carte referme le panneau.
 *
 * La carte suit le personnage du joueur : au chargement de la scène, la vue se centre sur
 * son token, qui est sélectionné. Un tap dans le vide déplace ce token vers la case touchée.
 *
 * Personnage du joueur : le token possédé sélectionné, sinon le personnage attribué
 * à l'utilisateur, sinon le premier personnage qu'il possède.
 */

import { MODULE_ID, log, t } from "../constants.js";
import { getAdapter } from "../adapters/index.js";
import { feedback } from "../gestures.js";
import { renderCharacter, renderActions, renderDice, ChatView, buildFormula } from "./views.js";

const TABS = [
  { id: "character", icon: "fa-solid fa-user" },
  { id: "actions", icon: "fa-solid fa-hand-fist" },
  { id: "dice", icon: "fa-solid fa-dice-d20" },
  { id: "chat", icon: "fa-solid fa-comments" }
];

const ACTOR_TABS = new Set(["character", "actions"]);

export class PhoneInterface {
  #api;
  #enabled = false;
  #hooked = false;
  #root = null;
  #body = null;
  #title = null;
  #tab = null;
  #refreshTimer = null;
  #unread = 0;
  #chat = new ChatView();
  #dice = { pool: {}, mod: 0, last: null };

  constructor(api) {
    this.#api = api;
  }

  get enabled() {
    return this.#enabled;
  }

  get tab() {
    return this.#tab;
  }

  /** Personnage suivi par l'interface. */
  get actor() {
    const controlled = canvas?.tokens?.controlled?.find(tk => tk.isOwner && tk.actor);
    if (controlled) return controlled.actor;
    if (game.user.character) return game.user.character;
    const owned = game.actors?.filter(a => a.isOwner) ?? [];
    return owned.find(a => a.type === "character") ?? owned[0] ?? null;
  }

  enable() {
    if (this.#enabled) return;
    this.#enabled = true;
    this.#build();
    this.#registerHooks();
    document.body.classList.add("vade-phone-ui");
    if (this.#api.gestures) this.#api.gestures.onEmptyTap = (world, screen) => this.#onEmptyTap(world, screen);
    if (canvas?.ready) this.centerOnCharacter(false);
    log("Interface téléphone activée");
  }

  disable() {
    if (!this.#enabled) return;
    this.#enabled = false;
    document.body.classList.remove("vade-phone-ui");
    if (this.#api.gestures) this.#api.gestures.onEmptyTap = null;
    this.#root?.remove();
    this.#root = this.#body = this.#title = null;
    this.#tab = null;
  }

  /* -------------------------------------------- */
  /*  Structure                                   */
  /* -------------------------------------------- */

  #build() {
    const root = document.createElement("div");
    root.id = "vade-phone";
    root.innerHTML = `
      <section class="vade-sheet" hidden>
        <header class="vade-sheet-header">
          <h2 class="vade-sheet-title"></h2>
          <button type="button" class="vade-icon-button" data-action="close" aria-label="${t("Phone.Close")}">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </header>
        <div class="vade-sheet-body"></div>
      </section>
      <nav class="vade-tabbar">
        ${TABS.map(tab => `
          <button type="button" class="vade-tab" data-tab="${tab.id}">
            <i class="${tab.icon}"></i>
            <span>${t(`Phone.Tab.${tab.id}`)}</span>
            ${tab.id === "chat" ? '<b class="vade-badge" hidden></b>' : ""}
          </button>`).join("")}
      </nav>`;
    document.body.appendChild(root);
    this.#root = root;
    this.#body = root.querySelector(".vade-sheet-body");
    this.#title = root.querySelector(".vade-sheet-title");

    root.querySelector(".vade-tabbar").addEventListener("click", event => {
      const button = event.target.closest("[data-tab]");
      if (button) this.open(button.dataset.tab);
    });
    root.querySelector('[data-action="close"]').addEventListener("click", () => this.close());
    this.#body.addEventListener("click", event => this.#onClick(event));
    this.#body.addEventListener("change", event => this.#onChange(event));
    this.#body.addEventListener("submit", event => this.#onSubmit(event));
  }

  /** Ouvre un onglet ; toucher l'onglet déjà ouvert referme le panneau. */
  open(tabId) {
    if (!this.#root) return;
    if (this.#tab === tabId) return this.close();
    this.#tab = tabId;
    this.#title.textContent = t(`Phone.Tab.${tabId}`);
    this.#root.querySelector(".vade-sheet").hidden = false;
    this.#root.classList.add("open");
    for (const button of this.#root.querySelectorAll("[data-tab]")) {
      button.classList.toggle("active", button.dataset.tab === tabId);
    }
    if (tabId === "chat") this.#setUnread(0);
    this.render();
  }

  close() {
    if (!this.#root) return;
    this.#tab = null;
    this.#root.querySelector(".vade-sheet").hidden = true;
    this.#root.classList.remove("open");
    for (const button of this.#root.querySelectorAll("[data-tab]")) button.classList.remove("active");
    this.#chat.detach();
    this.#body.innerHTML = "";
  }

  async render() {
    if (!this.#body || !this.#tab) return;
    const actor = this.actor;
    const adapter = getAdapter();
    switch (this.#tab) {
      case "character":
        this.#body.innerHTML = renderCharacter(actor, adapter);
        break;
      case "actions":
        this.#body.innerHTML = renderActions(actor, adapter);
        break;
      case "dice":
        this.#body.innerHTML = renderDice(this.#dice);
        break;
      case "chat":
        await this.#chat.attach(this.#body);
        break;
    }
    if (this.#tab !== "chat") this.#chat.detach();
  }

  /* -------------------------------------------- */
  /*  Événements du panneau                       */
  /* -------------------------------------------- */

  async #onClick(event) {
    const el = event.target.closest("[data-action]");
    if (!el) return;
    const actor = this.actor;
    const adapter = getAdapter();
    const { action, id } = el.dataset;

    try {
      switch (action) {
        case "roll":
          if (actor) await adapter.roll(actor, id);
          break;
        case "resource":
          if (actor) await adapter.adjustResource(actor, id, Number(el.dataset.delta));
          break;
        case "rest":
          if (actor) await adapter.rest(actor, id);
          break;
        case "sheet":
          actor?.sheet?.render(true);
          break;
        case "use":
          if (!actor) break;
          // Le panneau se ferme : l'objet peut demander de viser ou de poser un gabarit sur la carte.
          this.close();
          await adapter.useAction(actor, id);
          break;
        case "die":
          this.#dice.pool[id] = (this.#dice.pool[id] ?? 0) + 1;
          this.render();
          break;
        case "mod":
          this.#dice.mod += Number(el.dataset.delta);
          this.render();
          break;
        case "dice-clear":
          this.#dice.pool = {};
          this.#dice.mod = 0;
          this.#dice.last = null;
          this.render();
          break;
        case "dice-roll":
          await this.#roll(buildFormula(this.#dice));
          break;
        case "dice-quick":
          await this.#roll(el.dataset.formula);
          break;
      }
    } catch (err) {
      console.error("Vade |", err);
      ui.notifications.error(t("Phone.Error"));
    }
  }

  async #onChange(event) {
    const input = event.target.closest("[data-resource-input]");
    if (!input) return;
    const actor = this.actor;
    const value = Number(input.value);
    if (!actor || !Number.isFinite(value)) return;
    await getAdapter().setResource(actor, input.dataset.resourceInput, value);
  }

  async #onSubmit(event) {
    const form = event.target.closest(".vade-chat-form");
    if (!form) return;
    event.preventDefault();
    const field = form.querySelector("textarea");
    const text = field.value.trim();
    if (!text) return;
    field.value = "";
    await this.#chat.send(text);
  }

  async #roll(formula) {
    if (!formula) return;
    const actor = this.actor;
    const RollClass = foundry.dice?.Roll ?? globalThis.Roll;
    const roll = new RollClass(formula, getAdapter().rollData(actor) ?? {});
    const speaker = CONFIG.ChatMessage.documentClass.getSpeaker({ actor });
    await roll.toMessage({ speaker });
    this.#dice.last = { formula, total: roll.total };
    if (this.#tab === "dice") this.render();
  }

  /* -------------------------------------------- */
  /*  Carte                                       */
  /* -------------------------------------------- */

  /** Token du personnage sur la scène affichée. */
  characterToken() {
    const actor = this.actor;
    return actor?.getActiveTokens?.()?.find(tk => tk.isOwner) ?? null;
  }

  /** Centre la vue sur le token du personnage et le sélectionne. */
  centerOnCharacter(animate = true) {
    if (!canvas?.ready) return;
    const token = this.characterToken();
    if (!token) return;
    if (!token.controlled) token.control({ releaseOthers: true });
    const view = { x: token.center.x, y: token.center.y, scale: Math.max(canvas.stage.scale.x, 1) };
    if (animate) canvas.animatePan({ ...view, duration: 400 });
    else canvas.pan(view);
  }

  /** Tap dans le vide : ferme le panneau s'il est ouvert, sinon déplace le token sélectionné. */
  #onEmptyTap(world, screen) {
    if (this.#tab) {
      this.close();
      return true;
    }
    if (!game.settings.get(MODULE_ID, "tapToMove")) return false;
    const owned = canvas.tokens.controlled.filter(tk => tk.isOwner);
    if (owned.length !== 1) return false;
    this.#moveTo(owned[0], world, screen);
    return true;
  }

  async #moveTo(token, world, screen) {
    if (game.paused && !game.user.isGM) {
      ui.notifications.warn(t("Phone.Paused"));
      return;
    }
    const doc = token.document;
    const w = token.w ?? doc.width * canvas.grid.size;
    const h = token.h ?? doc.height * canvas.grid.size;

    // Position du coin haut-gauche qui met le centre du token sur le point touché, alignée sur la grille.
    let target = { x: world.x - w / 2, y: world.y - h / 2 };
    if (typeof token.getSnappedPosition === "function") target = token.getSnappedPosition(target);
    else if (canvas.grid?.getSnappedPoint) {
      target = canvas.grid.getSnappedPoint(target, { mode: CONST.GRID_SNAPPING_MODES.TOP_LEFT_CORNER });
    }
    if (target.x === doc.x && target.y === doc.y) return;

    const destination = { x: target.x + w / 2, y: target.y + h / 2 };
    if (!game.user.isGM && token.checkCollision?.(destination, { type: "move", mode: "any" })) {
      ui.notifications.warn(t("Phone.Blocked"));
      return;
    }

    feedback(screen.x, screen.y);
    try {
      if (typeof doc.move === "function") await doc.move({ x: target.x, y: target.y });
      else await doc.update({ x: target.x, y: target.y });
    } catch (err) {
      console.warn("Vade | Déplacement impossible", err);
      ui.notifications.warn(t("Phone.MoveFailed"));
    }
  }

  /* -------------------------------------------- */
  /*  Mises à jour                                */
  /* -------------------------------------------- */

  #registerHooks() {
    if (this.#hooked) return;
    this.#hooked = true;

    const onDocument = doc => {
      const actor = this.actor;
      if (!actor) return;
      if (doc === actor || doc.parent === actor) this.#scheduleRefresh();
    };
    for (const hook of ["updateActor", "createItem", "updateItem", "deleteItem",
      "createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
      Hooks.on(hook, onDocument);
    }

    Hooks.on("controlToken", () => this.#scheduleRefresh());
    Hooks.on("canvasReady", () => {
      if (this.#enabled) this.centerOnCharacter(false);
    });

    Hooks.on("createChatMessage", message => {
      if (!this.#enabled || !message.visible) return;
      if (this.#tab === "chat") this.#chat.add(message);
      else this.#setUnread(this.#unread + 1);
    });
    Hooks.on("updateChatMessage", message => {
      if (this.#enabled && this.#tab === "chat") this.#chat.update(message);
    });
    Hooks.on("deleteChatMessage", message => {
      if (this.#enabled && this.#tab === "chat") this.#chat.remove(message);
    });
  }

  /** Redessine l'onglet Personnage ou Actions, sans gêner une saisie en cours. */
  #scheduleRefresh() {
    if (!this.#enabled || !ACTOR_TABS.has(this.#tab)) return;
    clearTimeout(this.#refreshTimer);
    this.#refreshTimer = setTimeout(() => {
      if (this.#body?.contains(document.activeElement) && document.activeElement.matches("input, textarea")) {
        this.#scheduleRefresh();
        return;
      }
      this.render();
    }, 120);
  }

  #setUnread(count) {
    this.#unread = count;
    const badge = this.#root?.querySelector(".vade-badge");
    if (!badge) return;
    badge.hidden = count === 0;
    badge.textContent = count > 99 ? "99+" : String(count);
  }
}
