# Feuille de route

## 0.1 — Fondations ✅
- Squelette du module (manifeste v14, i18n fr/en, workflow de release)
- Détection téléphone / tablette / ordinateur, avec réglage pour forcer le type
- Profil de performance : résolution du canvas, mode performance et FPS de Foundry
- API `game.modules.get("vade").api` et hook `vadeReady` pour les autres modules
- Confort tactile de base : viewport, clavier virtuel, avertissement de résolution

## 0.2 — Gestes sur la carte (téléphone et tablette)
- Pan à un ou deux doigts, pinch-to-zoom centré sur les doigts
- Tap pour sélectionner un token, double-tap pour ouvrir sa fiche
- Appui long à la place du clic droit (HUD de token)
- Glisser un token au doigt, avec la mesure de déplacement de Foundry

## 0.3 — Interface tablette
- Contrôles de scène agrandis, sidebar en tiroir coulissant
- Fenêtres (fiches, journaux) en panneaux latéraux plutôt que flottantes
- Tap à la place du survol (tooltips, surbrillance des tokens)

## 0.4 — Interface téléphone
- Barre d'onglets : Personnage · Actions · Dés · Chat
- Carte en fond, centrée sur le token du joueur
- Déplacement par tap sur le token puis sur la destination
- Ciblage et ping au tap
- Architecture à adaptateurs par système : dnd5e d'abord, fiche native en plein écran en repli

## Plus tard
- Adaptateurs pour d'autres systèmes
- Réaction d'Ember et de Vellum au profil de performance (`effectScale`)
