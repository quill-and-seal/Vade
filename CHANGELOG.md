# Changelog

## 0.1.0

Première version : les fondations.

- Détection de l'appareil (téléphone, tablette, ordinateur) à partir du pointeur et de la taille d'écran, avec un réglage pour forcer le type.
- Profil de performance (désactivé, léger, fort ; automatique par défaut) : plafond de résolution du canvas, mode performance et FPS de Foundry abaissés, valeurs d'origine restaurées si le profil est désactivé.
- API `game.modules.get("vade").api`, hook `vadeReady` et classes CSS sur `<body>` pour les autres modules.
- Sur appareil tactile : zoom du navigateur bloqué, suivi du clavier virtuel, avertissement de résolution de Foundry masqué, menu d'appui long du navigateur désactivé sur l'interface.
