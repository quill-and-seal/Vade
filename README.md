# Vade

**Foundry VTT v14** sur téléphone et tablette, pour les joueurs.

Le nom vient du *vade-mecum*, le petit guide qu'on garde dans sa poche. Vade adapte Foundry aux écrans tactiles. Sur téléphone, il vise une interface simplifiée centrée sur le personnage et ses actions. Sur tablette, il garde la carte complète, rendue utilisable au doigt.

Un module de l'atelier [Quill & Seal](https://github.com/quill-and-seal).

> **État : 0.4.** Vade détecte l'appareil, allège le rendu, rend la carte utilisable au doigt, adapte l'interface de Foundry au tactile et propose une interface dédiée au téléphone. La suite est dans [ROADMAP.md](ROADMAP.md).

## Installation

Dans Foundry, **Modules complémentaires → Installer un module**, puis colle ce lien de manifeste :

```
https://github.com/quill-and-seal/Vade/releases/latest/download/module.json
```

Active ensuite le module dans ton monde. Il n'a aucune dépendance.

## Gestes sur la carte

Sur téléphone et tablette (réglage « Gestes tactiles sur la carte », activé par défaut) :

| Geste | Sur le vide | Sur un token à toi | Sur le token d'un autre |
|---|---|---|---|
| Glisser un doigt | Déplace la vue | Déplace le token (mesure et murs de Foundry) | Déplace la vue |
| Tap | Efface le survol | Sélectionne le token | L'affiche comme au survol (nom, bordure) |
| Double-tap | — | Ouvre sa fiche | Ouvre sa fiche (si tu peux la voir) |
| Appui long | Ping | Ouvre le HUD du token | Le cible / ne plus le cibler |
| Deux doigts | Pincer pour zoomer, glisser pour déplacer la vue | | |

Un appui long reconnu se signale par une vibration brève et un cercle sous le doigt. Si tu poses un second doigt pendant que tu déplaces un token, le déplacement est annulé et le token revient à son point de départ.

Ces gestes s'appliquent quand le calque des tokens est actif, ce qui est le cas pour les joueurs. Sur les autres calques, un doigt seul est laissé à Foundry, et le zoom à deux doigts fonctionne toujours. La souris et le stylet ne sont jamais interceptés.

## Interface téléphone

Réglage « Interface téléphone », activé par défaut sur téléphone. L'interface de Foundry (sidebar, macros, contrôles de scène, liste des joueurs) laisse place à une barre d'onglets en bas de l'écran. Un onglet ouvre un panneau qui couvre le bas de l'écran, et la carte reste visible au-dessus. L'onglet actif, la croix ou un tap sur la carte le referment.

| Onglet | Contenu |
|---|---|
| **Personnage** | Portrait, PV (−5 / −1 / +1 / +5 ou saisie directe), statistiques, jets de caractéristiques, sauvegardes, compétences, initiative, repos, fiche complète |
| **Actions** | Armes, sorts par niveau (avec les emplacements restants), capacités, consommables. Un tap utilise l'objet et referme le panneau pour viser ou poser un gabarit |
| **Dés** | d20, avantage, désavantage en un tap ; réserve de dés avec modificateur ; dernier résultat |
| **Chat** | Les derniers messages, avec les boutons du système, et un champ de saisie (les commandes `/r` marchent). Un badge compte les messages non lus |

**La carte suit ton personnage** : à chaque scène, la vue se centre sur son token et le sélectionne. Un **tap dans le vide** déplace ce token vers la case touchée. Le déplacement est refusé si un mur bloque la destination ou si la partie est en pause. Le glisser du token reste possible, et le réglage « Déplacement au tap » coupe cette fonction.

Le personnage suivi est le token que tu as sélectionné, sinon le personnage que le MJ t'a attribué, sinon le premier personnage que tu possèdes.

**Systèmes de jeu** : dnd5e a un adaptateur complet (jets, PV, repos, armes, sorts, capacités). Pour les autres systèmes, l'onglet Actions liste les objets du personnage, et la fiche complète reste accessible. Un module peut ajouter son propre adaptateur :

```js
Hooks.once("vadeReady", vade => vade.registerAdapter("monsysteme", { character(actor) { … }, actions(actor) { … } }));
```

L'interface attendue est décrite dans `scripts/adapters/generic.js`.

## Interface tactile

Réglage « Interface tactile », activé par défaut sur téléphone et tablette.

- **Fiches en panneaux** : les fiches de personnages, d'objets et de journaux s'ouvrent accrochées au bord de l'écran au lieu de flotter.

  | Appareil | Placement |
  |---|---|
  | Tablette en paysage | À droite, pleine hauteur, à côté des onglets de la sidebar |
  | Tablette en portrait | En bas, sur environ 60 % de la hauteur |
  | Téléphone | Plein écran |

  Les panneaux se replacent quand on tourne l'appareil. Un panneau redimensionné à la main garde sa taille jusqu'à sa fermeture. Les dialogues et les autres fenêtres gardent le comportement de Foundry.
- **Sidebar en tiroir** : elle est repliée au chargement, et un tap sur la carte la referme.
- **Boutons agrandis** : contrôles de scène, onglets, barre de macros et boutons des fenêtres font au moins 44 px.
- **Bulles d'aide** : un appui long sur un bouton affiche sa bulle d'aide sans le déclencher.

## Fondations

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
  // vade.gestures : gestes de la carte (enable() / disable()), null hors tactile
  // vade.ui       : interface tactile (enable() / disable()), null hors tactile
  // vade.phone    : interface téléphone (open(tab), close(), centerOnCharacter()), null hors téléphone
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

## Tests

Les tests de l'adaptateur dnd5e tournent sans Foundry, avec Node 20 ou plus :

```
node --test
```

## Licence

MIT, voir [LICENSE](LICENSE).
