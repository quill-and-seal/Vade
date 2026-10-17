# Changelog

## 0.4.0

Interface téléphone, activée par défaut sur téléphone et désactivable dans les réglages.

- L'interface de Foundry (sidebar, macros, contrôles de scène, joueurs) laisse place à une barre d'onglets : Personnage · Actions · Dés · Chat. Un onglet ouvre un panneau en bas de l'écran ; la carte reste visible au-dessus. L'onglet actif, la croix ou un tap sur la carte le referment.
- La carte se centre sur le token du personnage au chargement de chaque scène, et le sélectionne.
- Déplacement au tap : un tap dans le vide déplace le token sélectionné vers la case touchée (aligné sur la grille). Refusé si un mur bloque la destination ou si la partie est en pause. Réglage « Déplacement au tap ».
- Personnage : portrait, PV avec boutons −5/−1/+1/+5 et saisie directe, statistiques, jets de caractéristiques, sauvegardes, compétences, initiative et jet contre la mort, repos court et long, accès à la fiche complète.
- Actions : armes, sorts par niveau (emplacements restants dans l'en-tête, sorts non préparés grisés), capacités avec utilisations, consommables avec quantité. Un tap utilise l'objet et referme le panneau pour viser ou poser un gabarit.
- Dés : d20, avantage, désavantage en un tap ; réserve de dés (d4 à d100) avec modificateur ; dernier résultat affiché. Les jets utilisent les données du personnage (@prof, @abilities…).
- Chat : les 40 derniers messages rendus par Foundry (boutons du système compris), champ de saisie (commandes /r comprises), badge de messages non lus sur l'onglet.
- Adaptateurs de système : dnd5e (API des jets 4 et 5, repli 3.x) et un adaptateur générique pour les autres systèmes. D'autres modules peuvent en ajouter avec `api.registerAdapter(systemId, adapter)`.

## 0.3.0

Interface tactile (tablette, et téléphone en attendant son interface dédiée), activée par défaut et désactivable dans les réglages.

- Fiches en panneaux : les fiches de personnages, d'objets et de journaux s'ouvrent accrochées au bord de l'écran. Tablette en paysage : à droite, pleine hauteur ; tablette en portrait : en bas ; téléphone : plein écran. Les panneaux se replacent quand on tourne l'appareil. Les dialogues gardent le comportement de Foundry.
- Sidebar en tiroir : repliée au chargement, refermée par un tap sur la carte ou à l'ouverture d'un panneau latéral.
- Boutons agrandis (contrôles de scène, onglets de la sidebar, barre de macros, en-têtes de fenêtres) et poignée de redimensionnement plus grande.
- Appui long sur un bouton : affiche sa bulle d'aide, sans déclencher le bouton.
- Tap sur le token d'un autre : l'affiche comme au survol de la souris (nom, bordure, infos des modules qui réagissent au survol). Un second tap, ou un tap ailleurs, l'efface.

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
