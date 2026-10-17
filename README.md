# Vade

**Foundry VTT v14** sur téléphone et tablette, pour les joueurs.

Le nom vient du *vade-mecum*, le petit guide qu'on garde dans sa poche. Vade adapte Foundry aux écrans tactiles. Sur téléphone, il vise une interface simplifiée centrée sur le personnage et ses actions. Sur tablette, il garde la carte complète, rendue utilisable au doigt.

Un module de l'atelier [Quill & Seal](https://github.com/quill-and-seal).

> **État : 0.1, fondations.** Cette version détecte l'appareil et allège le rendu. Les gestes tactiles et les interfaces adaptées arrivent dans les versions suivantes (voir [ROADMAP.md](ROADMAP.md)).

## Installation

Dans Foundry, **Modules complémentaires → Installer un module**, puis colle ce lien de manifeste :

```
https://github.com/quill-and-seal/Vade/releases/latest/download/module.json
```

Active ensuite le module dans ton monde. Il n'a aucune dépendance.

## Ce que fait la 0.1

### Détection de l'appareil

Au chargement, Vade classe l'appareil en **téléphone**, **tablette** ou **ordinateur**. Il ne se fie pas au user-agent :

- un appareil est tactile si son pointeur principal est un doigt ;
- parmi les appareils tactiles, un écran dont le petit côté fait moins de 600 px CSS est un téléphone ;
- un ordinateur portable à écran tactile garde la souris ou le trackpad comme pointeur principal, il reste donc « ordinateur ».

Si la détection se trompe, chaque joueur peut forcer le type dans les réglages du module. Le réglage est propre à son navigateur.

### Profil de performance

| Profil | Par défaut sur | Résolution max de la carte | FPS max | Mode performance de Foundry |
|---|---|---|---|---|
| Désactivé | Ordinateur | inchangée | inchangé | inchangé |
| Léger | Tablette | 1,5× | 60 | Moyen |
| Fort | Téléphone | 1× | 30 | Bas |

La résolution est le levier le plus efficace. Un téléphone a souvent une densité de pixels de 2 à 3, et Foundry rend alors la carte avec 4 à 9 fois plus de pixels qu'à 1×.

Vade ne fait que *baisser* les réglages de Foundry, jamais les remonter. Il garde les valeurs d'origine et les restaure si le profil repasse sur « Désactivé ». Tout reste local au navigateur du joueur : le PC du MJ et les autres joueurs ne sont pas touchés.

### Confort tactile

Sur les appareils tactiles uniquement :

- le zoom du navigateur est bloqué sur la page, pour réserver le pincement à la carte ;
- l'avertissement « résolution trop faible » de Foundry est masqué (réglage) ;
- la page suit la hauteur réelle quand le clavier virtuel s'ouvre (`--vade-viewport-height`, classe `vade-keyboard-open`) ;
- l'appui long ne déclenche plus le menu copier/partager du navigateur sur l'interface. Le chat et les champs restent sélectionnables.

## Pour les autres modules

Vade expose une API et un hook, pour que d'autres modules allègent leurs effets sur mobile :

```js
Hooks.once("vadeReady", vade => {
  // vade.mode    : "phone" | "tablet" | "desktop"
  // vade.touch   : true sur téléphone et tablette
  // vade.profile : { id, resolutionCap, maxFPS, performanceMode, antialias, effectScale }
  const scale = vade.profile.effectScale; // 1 = pleine qualité, 0.3 = profil fort
});

// Ou à tout moment après l'init :
game.modules.get("vade")?.api;
```

Des classes CSS sont aussi posées sur `<body>` : `vade-phone`, `vade-tablet`, `vade-desktop`, `vade-touch`, `vade-perf-off|light|strong`.

## Tester sur Android

L'émulation mobile de Chrome sur PC ne reproduit ni les vrais gestes ni les performances. Pour déboguer sur un vrai appareil :

1. Sur le téléphone : active les **options pour les développeurs**, puis le **débogage USB**.
2. Branche-le au PC et ouvre `chrome://inspect` dans Chrome sur le PC.
3. Ouvre la partie Foundry dans Chrome sur le téléphone, puis clique sur **inspect** en face de l'onglet.
4. Dans la console : `game.modules.get("vade").api.report()` affiche le diagnostic (appareil détecté, profil, résolution réelle du canvas).

## Licence

MIT, voir [LICENSE](LICENSE).
