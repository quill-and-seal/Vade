# Changelog

## 0.2.0

Gestes tactiles sur la carte (téléphone et tablette), activés par défaut et désactivables dans les réglages.

- Glisser un doigt sur le vide pour déplacer la vue ; pincer à deux doigts pour zoomer autour des doigts, et glisser à deux doigts pour déplacer la vue.
- Token qui t'appartient : le glisser au doigt passe par Foundry (mesure et murs compris) ; appui long pour ouvrir son HUD ; double-tap pour sa fiche.
- Token d'un autre : appui long pour le cibler ou ne plus le cibler ; double-tap pour sa fiche si tu as le droit de la voir.
- Appui long sur le vide : ping sur la carte.
- Poser un second doigt pendant le glisser d'un token annule le déplacement (le token revient à son point de départ) et passe en zoom.
- Vibration brève et cercle visuel quand un appui long est reconnu ; plus de menu contextuel du navigateur sur la carte.
- Sur les autres calques que celui des tokens, un doigt seul reste géré par Foundry ; les deux doigts zooment toujours.

## 0.1.0

Première version : les fondations.

- Détection de l'appareil (téléphone, tablette, ordinateur) à partir du pointeur et de la taille d'écran, avec un réglage pour forcer le type.
- Profil de performance (désactivé, léger, fort ; automatique par défaut) : plafond de résolution du canvas, mode performance et FPS de Foundry abaissés, valeurs d'origine restaurées si le profil est désactivé.
- API `game.modules.get("vade").api`, hook `vadeReady` et classes CSS sur `<body>` pour les autres modules.
- Sur appareil tactile : zoom du navigateur bloqué, suivi du clavier virtuel, avertissement de résolution de Foundry masqué, menu d'appui long du navigateur désactivé sur l'interface.
