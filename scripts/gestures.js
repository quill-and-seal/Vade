/**
 * Gestes tactiles sur la carte.
 *
 * Vade écoute les événements de pointeur « touch » sur window, en phase de capture :
 * il les voit avant PIXI et Foundry, et décide pour chaque doigt s'il les garde ou les
 * laisse passer. La souris et le stylet ne sont jamais touchés.
 *
 * Avec le calque des tokens actif :
 *   - doigt posé sur un token que le joueur possède : les événements passent à Foundry,
 *     qui gère la sélection et le glisser (avec sa propre mesure de déplacement) ;
 *       · appui long → HUD du token (à la place du clic droit)
 *       · double-tap → fiche du personnage
 *   - doigt posé ailleurs (vide ou token d'un autre) : Vade garde les événements ;
 *       · tap sur un token → l'afficher comme au survol (nom, bordure, infos des autres
 *         modules qui réagissent au survol) ; tap ailleurs → l'effacer
 *       · glisser → déplacer la vue
 *       · appui long sur le vide → ping sur la carte
 *       · appui long sur un token d'un autre → le cibler / ne plus le cibler
 *       · double-tap sur un token → sa fiche, si le joueur a le droit de la voir
 * Sur les autres calques, un doigt seul passe toujours à Foundry (outils du MJ, mesures…).
 * Partout : deux doigts → pincer pour zoomer, glisser pour déplacer la vue. Si un doigt
 * déplaçait un token quand le second se pose, le token est reposé à son point de départ.
 */

import { log } from "./constants.js";

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE = 10; // px : en dessous, le doigt est considéré immobile
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DISTANCE = 30; // px
const HUD_DELAY_MS = 60; // laisse Foundry finir de traiter le relâchement avant d'ouvrir le HUD

const MODE = Object.freeze({
  IDLE: "idle",
  PENDING: "pending", // doigt gardé par Vade, pas encore décidé (tap, appui long ou glisser)
  TOKEN: "token", // doigt sur un token possédé, événements laissés à Foundry
  OTHER: "other", // autre calque, événements laissés à Foundry
  PAN: "pan",
  PINCH: "pinch"
});

export class TouchGestures {
  #enabled = false;
  #mode = MODE.IDLE;
  /** @type {Map<number, {id:number, x:number, y:number, startX:number, startY:number, passthrough:boolean, token:object|null, moved:boolean}>} */
  #pointers = new Map();
  #longTimer = null;
  #longFired = false;
  #anchor = null; // point du monde gardé sous les doigts pendant un pan ou un pincement
  #pinch = null;
  #frame = null;
  #lastTap = null;
  #hovered = null;
  #lastTouch = 0;
  #synthetic = new WeakSet();

  #onDown = this.#handleDown.bind(this);
  #onMove = this.#handleMove.bind(this);
  #onUp = this.#handleUp.bind(this);
  #onContextMenu = this.#handleContextMenu.bind(this);

  /**
   * Appelé sur un tap dans le vide (calque des tokens) avec le point du monde et le point
   * d'écran. Renvoyer true indique que le tap a été utilisé (l'interface téléphone s'en sert
   * pour le déplacement au tap).
   * @type {((world: {x:number, y:number}, screen: {x:number, y:number}) => boolean) | null}
   */
  onEmptyTap = null;

  get enabled() {
    return this.#enabled;
  }

  enable() {
    if (this.#enabled) return;
    const opts = { capture: true, passive: false };
    window.addEventListener("pointerdown", this.#onDown, opts);
    window.addEventListener("pointermove", this.#onMove, opts);
    window.addEventListener("pointerup", this.#onUp, opts);
    window.addEventListener("pointercancel", this.#onUp, opts);
    window.addEventListener("contextmenu", this.#onContextMenu, opts);
    this.#enabled = true;
    log("Gestes tactiles activés");
  }

  disable() {
    if (!this.#enabled) return;
    const opts = { capture: true };
    window.removeEventListener("pointerdown", this.#onDown, opts);
    window.removeEventListener("pointermove", this.#onMove, opts);
    window.removeEventListener("pointerup", this.#onUp, opts);
    window.removeEventListener("pointercancel", this.#onUp, opts);
    window.removeEventListener("contextmenu", this.#onContextMenu, opts);
    this.#reset();
    this.#enabled = false;
  }

  /* -------------------------------------------- */
  /*  Événements                                  */
  /* -------------------------------------------- */

  #handleDown(event) {
    if (!this.#isOurs(event)) return;
    if (!canvas?.ready || event.target !== canvas.app?.view) return;
    this.#lastTouch = performance.now();

    const p = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      passthrough: false,
      token: null,
      moved: false
    };
    this.#pointers.set(p.id, p);

    if (this.#pointers.size === 1) {
      this.#longFired = false;
      if (canvas.activeLayer !== canvas.tokens) {
        p.passthrough = true;
        this.#mode = MODE.OTHER;
        return;
      }
      p.token = this.#tokenAt(p.x, p.y);
      if (p.token?.isOwner) {
        p.passthrough = true;
        this.#mode = MODE.TOKEN;
        this.#startLongPress(p, false);
        return;
      }
      stop(event);
      this.#mode = MODE.PENDING;
      this.#startLongPress(p, true);
      return;
    }

    stop(event);
    if (this.#pointers.size === 2) this.#startPinch();
    // Trois doigts ou plus : ignorés.
  }

  #handleMove(event) {
    if (!this.#isOurs(event)) return;
    const p = this.#pointers.get(event.pointerId);
    if (!p) return;
    p.x = event.clientX;
    p.y = event.clientY;
    if (!p.moved && Math.hypot(p.x - p.startX, p.y - p.startY) > MOVE_TOLERANCE) {
      p.moved = true;
      this.#clearLongPress();
    }

    if (this.#mode === MODE.PINCH) {
      stop(event);
      this.#schedule();
      return;
    }
    if (p.passthrough) return;

    stop(event);
    if (this.#mode === MODE.PENDING && p.moved) this.#startPan(p, true);
    if (this.#mode === MODE.PAN) this.#schedule();
  }

  #handleUp(event) {
    if (!this.#isOurs(event)) return;
    const p = this.#pointers.get(event.pointerId);
    if (!p) return;
    this.#pointers.delete(p.id);
    this.#clearLongPress();
    const released = event.type === "pointerup";

    if (this.#mode === MODE.PINCH) {
      stop(event);
      if (this.#pointers.size === 1) this.#startPan([...this.#pointers.values()][0]);
      else if (this.#pointers.size === 0) this.#reset();
      return;
    }

    if (p.passthrough) {
      // L'événement continue vers Foundry ; Vade réagit seulement aux taps et appuis longs.
      if (this.#mode === MODE.TOKEN && released && !p.moved) {
        const token = p.token;
        if (this.#longFired) setTimeout(() => this.#openHud(token), HUD_DELAY_MS);
        else if (this.#isDoubleTap(p)) this.#openSheet(token);
      }
      if (this.#pointers.size === 0) this.#reset();
      return;
    }

    stop(event);
    if (this.#mode === MODE.PENDING && released && !this.#longFired) {
      if (this.#isDoubleTap(p) && p.token) this.#openSheet(p.token);
      else if (!p.token && this.#emptyTap(p)) this.#toggleHover(null);
      else this.#toggleHover(p.token);
    }
    if (this.#pointers.size === 0) this.#reset();
  }

  /** Empêche le menu contextuel du navigateur après un appui long sur la carte. */
  #handleContextMenu(event) {
    if (event.target !== canvas?.app?.view) return;
    if (performance.now() - this.#lastTouch > 1500) return;
    stop(event);
  }

  /** Événement tactile réel (pas un des nôtres, ni souris ni stylet). */
  #isOurs(event) {
    return event.pointerType === "touch" && !this.#synthetic.has(event);
  }

  /* -------------------------------------------- */
  /*  Appui long                                  */
  /* -------------------------------------------- */

  /**
   * @param {object} p           pointeur
   * @param {boolean} immediate  true : l'action part dès la fin du délai (événements gardés par Vade) ;
   *                             false : on attend que le doigt se lève (événements laissés à Foundry)
   */
  #startLongPress(p, immediate) {
    this.#clearLongPress();
    this.#longTimer = setTimeout(() => {
      this.#longTimer = null;
      if (p.moved || !this.#pointers.has(p.id) || this.#pointers.size !== 1) return;
      this.#longFired = true;
      feedback(p.x, p.y);
      if (!immediate) return;
      if (p.token) this.#toggleTarget(p.token);
      else this.#ping(p.x, p.y);
    }, LONG_PRESS_MS);
  }

  #clearLongPress() {
    if (this.#longTimer) clearTimeout(this.#longTimer);
    this.#longTimer = null;
  }

  /* -------------------------------------------- */
  /*  Déplacement de la vue                       */
  /* -------------------------------------------- */

  /**
   * @param {object} p             pointeur qui déplace la vue
   * @param {boolean} fromStart    true : ancre au point où le doigt s'est posé (la vue rattrape
   *                               les premiers pixels de mouvement) ; false : à sa position actuelle
   */
  #startPan(p, fromStart = false) {
    this.#mode = MODE.PAN;
    this.#pinch = null;
    this.#anchor = fromStart ? this.#toWorld(p.startX, p.startY) : this.#toWorld(p.x, p.y);
  }

  #startPinch() {
    this.#clearLongPress();
    // Le premier doigt était peut-être confié à Foundry (glisser de token) : on l'annule.
    for (const p of this.#pointers.values()) {
      if (p.passthrough) {
        this.#cancelPassthrough(p);
        p.passthrough = false;
      }
    }
    const { mid, dist } = this.#fingers();
    this.#mode = MODE.PINCH;
    this.#anchor = this.#toWorld(mid.x, mid.y);
    this.#pinch = { startDist: Math.max(dist, 1), startScale: canvas.stage.scale.x };
  }

  #schedule() {
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = null;
      if (!canvas?.ready || !this.#anchor) return;
      if (this.#mode === MODE.PAN) {
        const p = [...this.#pointers.values()][0];
        if (p) this.#keepUnder(this.#anchor, p.x, p.y, null);
      } else if (this.#mode === MODE.PINCH && this.#pointers.size >= 2) {
        const { mid, dist } = this.#fingers();
        const scale = this.#pinch.startScale * (dist / this.#pinch.startDist);
        this.#keepUnder(this.#anchor, mid.x, mid.y, scale);
      }
    });
  }

  /**
   * Place la vue pour que le point du monde « world » se trouve sous le point d'écran (x, y).
   * Foundry contraint le zoom et la position dans canvas.pan : on applique d'abord le zoom,
   * puis on recalcule le centre avec le zoom réellement retenu.
   */
  #keepUnder(world, x, y, scale) {
    if (scale != null) canvas.pan({ scale });
    const s = canvas.stage.scale.x;
    const rect = canvas.app.view.getBoundingClientRect();
    const sx = x - rect.left;
    const sy = y - rect.top;
    canvas.pan({
      x: world.x - (sx - canvas.stage.position.x) / s,
      y: world.y - (sy - canvas.stage.position.y) / s
    });
  }

  /** Milieu et écart des deux premiers doigts. */
  #fingers() {
    const [a, b] = [...this.#pointers.values()];
    return {
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      dist: Math.hypot(a.x - b.x, a.y - b.y)
    };
  }

  /**
   * Termine proprement l'interaction confiée à Foundry : le doigt « revient » à son point
   * de départ puis se lève. Un token en cours de glisser est donc reposé là où il était.
   */
  #cancelPassthrough(p) {
    const view = canvas.app.view;
    for (const type of ["pointermove", "pointerup"]) {
      const ev = new PointerEvent(type, {
        pointerId: p.id,
        pointerType: "touch",
        isPrimary: true,
        clientX: p.startX,
        clientY: p.startY,
        button: type === "pointerup" ? 0 : -1,
        buttons: type === "pointerup" ? 0 : 1,
        bubbles: true,
        cancelable: true,
        composed: true
      });
      this.#synthetic.add(ev);
      view.dispatchEvent(ev);
    }
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  #isDoubleTap(p) {
    const now = performance.now();
    const last = this.#lastTap;
    this.#lastTap = { time: now, x: p.x, y: p.y, token: p.token };
    if (!last || last.token !== p.token) return false;
    if (now - last.time > DOUBLE_TAP_MS) return false;
    if (Math.hypot(p.x - last.x, p.y - last.y) > DOUBLE_TAP_DISTANCE) return false;
    this.#lastTap = null;
    return true;
  }

  #emptyTap(p) {
    if (typeof this.onEmptyTap !== "function") return false;
    try {
      return !!this.onEmptyTap(this.#toWorld(p.x, p.y), { x: p.x, y: p.y });
    } catch (err) {
      console.error("Vade | Erreur dans onEmptyTap", err);
      return false;
    }
  }

  /** Tap : affiche le token comme au survol de la souris ; un second tap, ou un tap ailleurs, l'efface. */
  #toggleHover(token) {
    const previous = this.#hovered;
    this.#hovered = null;
    if (previous && !previous.destroyed) setHover(previous, false);
    if (token && token !== previous) {
      setHover(token, true);
      this.#hovered = token;
    }
  }

  #openSheet(token) {
    const actor = token?.actor;
    if (!actor?.testUserPermission(game.user, "LIMITED")) return;
    actor.sheet?.render(true);
  }

  #openHud(token) {
    if (!token?.isOwner || token.destroyed) return;
    const hud = token.layer?.hud ?? canvas.hud?.token;
    if (!hud) return;
    if (!token.controlled) token.control({ releaseOthers: true });
    hud.bind(token);
  }

  #toggleTarget(token) {
    if (typeof token?.setTarget !== "function") return;
    token.setTarget(!token.isTargeted, { releaseOthers: false });
  }

  #ping(x, y) {
    canvas.ping?.(this.#toWorld(x, y));
  }

  /* -------------------------------------------- */
  /*  Utilitaires                                 */
  /* -------------------------------------------- */

  /** Point de l'écran (coordonnées client) → point du monde. */
  #toWorld(x, y) {
    const rect = canvas.app.view.getBoundingClientRect();
    const s = canvas.stage.scale.x;
    return {
      x: canvas.stage.pivot.x + (x - rect.left - canvas.stage.position.x) / s,
      y: canvas.stage.pivot.y + (y - rect.top - canvas.stage.position.y) / s
    };
  }

  /** Token visible sous le doigt (le plus haut s'il y en a plusieurs). */
  #tokenAt(x, y) {
    const w = this.#toWorld(x, y);
    const hits = canvas.tokens.placeables.filter(t => t.visible && t.bounds?.contains(w.x, w.y));
    if (!hits.length) return null;
    hits.sort((a, b) =>
      ((a.document.elevation ?? 0) - (b.document.elevation ?? 0)) || ((a.document.sort ?? 0) - (b.document.sort ?? 0)));
    return hits.at(-1);
  }

  #reset() {
    this.#clearLongPress();
    if (this.#frame) cancelAnimationFrame(this.#frame);
    this.#frame = null;
    this.#pointers.clear();
    this.#mode = MODE.IDLE;
    this.#anchor = null;
    this.#pinch = null;
    this.#longFired = false;
  }
}

/** Survol d'un token par les méthodes de Foundry, qui préviennent aussi les autres modules (hook hoverToken). */
function setHover(token, on) {
  const handler = on ? token._onHoverIn : token._onHoverOut;
  if (typeof handler !== "function") return;
  try {
    handler.call(token, new PointerEvent(on ? "pointerenter" : "pointerleave"), { hoverOutOthers: true });
  } catch (err) {
    console.warn("Vade | Survol du token impossible", err);
  }
}

function stop(event) {
  if (event.cancelable) event.preventDefault();
  event.stopImmediatePropagation();
}

/** Retour visuel et vibration brève quand un appui long est reconnu. */
export function feedback(x, y) {
  navigator.vibrate?.(12);
  const ring = document.createElement("div");
  ring.className = "vade-press-ring";
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  document.body.appendChild(ring);
  ring.addEventListener("animationend", () => ring.remove(), { once: true });
  setTimeout(() => ring.remove(), 1000);
}
