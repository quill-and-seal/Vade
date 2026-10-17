/**
 * Interface tactile (tablette, et téléphone en attendant son interface dédiée de la 0.4).
 *
 *  - Fiches en panneaux : les fiches de documents (personnages, objets, journaux…) s'ouvrent
 *    accrochées au bord de l'écran au lieu de flotter. Tablette en paysage : panneau à droite,
 *    pleine hauteur ; tablette en portrait : panneau en bas ; téléphone : plein écran.
 *    Les dialogues et les autres fenêtres gardent le comportement de Foundry.
 *  - Sidebar en tiroir : repliée au chargement, refermée par un tap sur la carte ou à
 *    l'ouverture d'un panneau latéral.
 *  - Bulles d'aide : un appui long sur un élément d'interface qui en a une l'affiche
 *    (sur tactile, le survol qui les déclenche d'habitude n'existe pas).
 */

import { DEVICE, log } from "./constants.js";

const TOOLTIP_PRESS_MS = 450;
const MOVE_TOLERANCE = 10; // px
const SIDE_PANEL_MAX_WIDTH = 620; // px
const BOTTOM_PANEL_RATIO = 0.62; // part de la hauteur en portrait

const PANEL_CLASSES = ["vade-panel", "vade-panel-side", "vade-panel-bottom", "vade-panel-full"];

export class TouchInterface {
  #api;
  #enabled = false;
  #hooked = false;
  #panels = new Set();
  #docked = new WeakSet();
  #tooltip = { timer: null, shown: false, swallowClick: false, x: 0, y: 0 };
  #resizeTimer = null;

  #onPointerDown = this.#handlePointerDown.bind(this);
  #onPointerMove = this.#handlePointerMove.bind(this);
  #onPointerUp = this.#handlePointerUp.bind(this);
  #onClick = this.#handleClick.bind(this);
  #onResize = () => {
    clearTimeout(this.#resizeTimer);
    this.#resizeTimer = setTimeout(() => this.#redockAll(), 150);
  };

  constructor(api) {
    this.#api = api;
  }

  get enabled() {
    return this.#enabled;
  }

  enable() {
    if (this.#enabled) return;
    this.#enabled = true;
    this.#registerHooks();
    document.body.classList.add("vade-ui");
    document.addEventListener("pointerdown", this.#onPointerDown, { capture: true });
    document.addEventListener("pointermove", this.#onPointerMove, { capture: true, passive: true });
    document.addEventListener("pointerup", this.#onPointerUp, { capture: true });
    document.addEventListener("pointercancel", this.#onPointerUp, { capture: true });
    document.addEventListener("click", this.#onClick, { capture: true });
    window.addEventListener("resize", this.#onResize);
    collapseSidebar();
    log("Interface tactile activée");
  }

  disable() {
    if (!this.#enabled) return;
    this.#enabled = false;
    document.body.classList.remove("vade-ui");
    document.removeEventListener("pointerdown", this.#onPointerDown, { capture: true });
    document.removeEventListener("pointermove", this.#onPointerMove, { capture: true });
    document.removeEventListener("pointerup", this.#onPointerUp, { capture: true });
    document.removeEventListener("pointercancel", this.#onPointerUp, { capture: true });
    document.removeEventListener("click", this.#onClick, { capture: true });
    window.removeEventListener("resize", this.#onResize);
    for (const app of this.#panels) appElement(app)?.classList.remove(...PANEL_CLASSES);
    this.#panels.clear();
    this.#docked = new WeakSet();
  }

  /* -------------------------------------------- */
  /*  Fiches en panneaux                          */
  /* -------------------------------------------- */

  /** Les hooks de Foundry ne se retirent pas un par un : on les pose une fois, gardés par #enabled. */
  #registerHooks() {
    if (this.#hooked) return;
    this.#hooked = true;
    Hooks.on("renderApplicationV2", app => this.#onRender(app));
    Hooks.on("renderApplication", app => this.#onRender(app));
    Hooks.on("closeApplicationV2", app => this.#onClose(app));
    Hooks.on("closeApplication", app => this.#onClose(app));
  }

  #onRender(app) {
    if (!this.#enabled || !isDocumentSheet(app)) return;
    // Une fiche se redessine à chaque modification du document : on ne l'accroche qu'à l'ouverture,
    // pour ne pas défaire un redimensionnement fait par le joueur.
    if (this.#docked.has(app)) return;
    this.#dock(app);
  }

  #onClose(app) {
    this.#panels.delete(app);
    this.#docked.delete(app);
  }

  #dock(app) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    let layout;
    let pos;

    if (this.#api.mode === DEVICE.PHONE) {
      layout = "full";
      pos = { left: 0, top: 0, width: W, height: H };
    } else if (H > W) {
      layout = "bottom";
      const h = Math.round(H * BOTTOM_PANEL_RATIO);
      pos = { left: 0, top: H - h, width: W, height: h };
    } else {
      layout = "side";
      collapseSidebar();
      const right = sidebarTabsWidth();
      const w = Math.min(SIDE_PANEL_MAX_WIDTH, Math.round((W - right) * 0.5));
      pos = { left: W - right - w, top: 0, width: w, height: H };
    }

    try {
      app.setPosition(pos);
    } catch (err) {
      console.warn("Vade | Impossible de placer la fenêtre", app, err);
      return;
    }
    const el = appElement(app);
    el?.classList.remove(...PANEL_CLASSES);
    el?.classList.add("vade-panel", `vade-panel-${layout}`);
    this.#panels.add(app);
    this.#docked.add(app);
  }

  /** Rotation de l'écran ou redimensionnement : on réaccroche les panneaux ouverts. */
  #redockAll() {
    if (!this.#enabled) return;
    for (const app of [...this.#panels]) {
      if (!appElement(app)?.isConnected) {
        this.#onClose(app);
        continue;
      }
      this.#dock(app);
    }
  }

  /* -------------------------------------------- */
  /*  Sidebar et bulles d'aide                    */
  /* -------------------------------------------- */

  #handlePointerDown(event) {
    if (event.pointerType !== "touch") return;
    const tip = this.#tooltip;
    clearTimeout(tip.timer);
    tip.swallowClick = false;

    // Toucher ailleurs referme la bulle affichée.
    if (tip.shown) {
      game.tooltip?.deactivate();
      tip.shown = false;
    }

    // Tap sur la carte : le tiroir de la sidebar se referme (l'événement continue vers les gestes).
    if (event.target === canvas?.app?.view) {
      collapseSidebar();
      return;
    }

    const el = event.target.closest?.("[data-tooltip]");
    if (!el) return;
    tip.x = event.clientX;
    tip.y = event.clientY;
    tip.timer = setTimeout(() => {
      tip.timer = null;
      if (!el.isConnected || !game.tooltip) return;
      game.tooltip.activate(el);
      tip.shown = true;
      tip.swallowClick = true; // le relâchement ne doit pas déclencher le bouton
      navigator.vibrate?.(8);
    }, TOOLTIP_PRESS_MS);
  }

  #handlePointerMove(event) {
    const tip = this.#tooltip;
    if (event.pointerType !== "touch" || !tip.timer) return;
    // Le doigt défile une liste : ce n'est pas un appui long.
    if (Math.hypot(event.clientX - tip.x, event.clientY - tip.y) > MOVE_TOLERANCE) {
      clearTimeout(tip.timer);
      tip.timer = null;
    }
  }

  #handlePointerUp(event) {
    if (event.pointerType !== "touch") return;
    clearTimeout(this.#tooltip.timer);
    this.#tooltip.timer = null;
  }

  #handleClick(event) {
    if (!this.#tooltip.swallowClick) return;
    this.#tooltip.swallowClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

/* -------------------------------------------- */
/*  Utilitaires                                 */
/* -------------------------------------------- */

/** Fiche de document, en ApplicationV2 ou en ancienne Application. */
function isDocumentSheet(app) {
  const V2 = foundry.applications?.api?.DocumentSheetV2;
  const V1 = foundry.appv1?.sheets?.DocumentSheet ?? globalThis.DocumentSheet;
  return (V2 && app instanceof V2) || (V1 && app instanceof V1);
}

/** Élément HTML de la fenêtre (ApplicationV2 : HTMLElement ; ancienne Application : jQuery). */
function appElement(app) {
  const el = app?.element;
  if (!el) return null;
  return el instanceof HTMLElement ? el : el[0] ?? null;
}

function sidebarExpanded() {
  const sidebar = ui.sidebar;
  if (!sidebar) return false;
  if (typeof sidebar.expanded === "boolean") return sidebar.expanded;
  return !sidebar._collapsed;
}

function collapseSidebar() {
  const sidebar = ui.sidebar;
  if (!sidebar || !sidebarExpanded()) return;
  if (typeof sidebar.toggleExpanded === "function") sidebar.toggleExpanded(false);
  else sidebar.collapse?.();
}

/** Largeur de la bande d'onglets de la sidebar repliée, pour ne pas la recouvrir. */
function sidebarTabsWidth() {
  const tabs = document.getElementById("sidebar-tabs");
  return tabs ? Math.round(tabs.getBoundingClientRect().width) : 0;
}
