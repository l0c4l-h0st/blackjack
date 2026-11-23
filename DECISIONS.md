# Décisions

Une ligne par décision : **quoi** — pourquoi.

## Outillage

- **Vite 6.4 + Vitest 4.1 + React Router 7** (au lieu des versions plus anciennes) — versions sans vulnérabilité connue à l'installation (`npm audit` = 0) ; React Router 7 reste compatible React 18.
- **`.npmrc` avec `legacy-peer-deps=true`** — contourne un bug de résolution des peer-deps optionnelles de npm 10 (`Cannot read properties of null (reading 'edgesOut')`) ; aucune dépendance n'est réellement en conflit.
- **Polices auto-hébergées via `@fontsource` (Inter, Space Grotesk, sous-ensemble latin)** — pas d'appel réseau tiers, pas de cookie, chargement plus rapide.
- **Deux tsconfig (app / node)** — le code navigateur n'a pas accès aux types Node, et le script de simulation n'a pas accès au DOM.

## Moteur

- **Le solde vit dans l'état moteur (`GameState.balance`)** et non dans `profileStore` — une seule source de vérité, sauvegardée atomiquement avec le tour en cours (impossible de perdre/gagner des crédits via F5).
- **Les mises quittent le solde dès qu'elles sont posées** (comme des jetons sur le tapis) ; retirer/effacer les rend.
- **Le moteur modélise les jetons physiques** (`spots`, `stake`) en plus des mises : chaque mouvement de jetons émet un événement (`PLACE_CHIPS`, `CHIPS_FROM_DEALER`, `CHIPS_TO_PLAYER`, `CHIPS_TO_DEALER`) que l'UI anime.
- **Phases transitoires non persistées** — l'état ne « repose » que dans `BETTING`, `INSURANCE`, `PLAYER_TURNS`, `ROUND_END` ; les autres phases n'existent que sous forme d'événements `PHASE`.
- **Les cartes restent sur la table en `ROUND_END`** jusqu'à la prochaine action de mise (ou `NEW_ROUND`) — le joueur a le temps de lire les résultats ; le re-mélange se fait à ce moment-là.
- **Bust et abandon réglés immédiatement** (jetons ramassés tout de suite), comme en salle.
- **Une main qui atteint 21 se termine automatiquement** (y compris après split) — aucune décision utile possible.
- **`splitAce21IsBlackjack` s'applique à tout 21 en deux cartes après split** (As+10 ou 10+As) — c'est la règle de salle usuelle.
- **Abandon (règle `surrenderAfterSplit`) : l'action « split » n'empêche pas l'abandon** quand la règle l'autorise ; tout autre geste (tirer…) l'empêche.
- **Assurance non abordable → refus automatique** (événement `INSURANCE_DECISION` avec `auto: true`) plutôt qu'une question sans réponse possible. L'even money (coût nul) est toujours proposé.
- **Sans even money (`evenMoney: false`), un BJ face à un As se voit proposer l'assurance classique** (mathématiquement équivalente).
- **Sabot de secours** : si le sabot se vidait en plein tour (impossible avec 70–80 % de pénétration, mais géré), un sabot est reconstitué avec les cartes hors table et un vrai re-mélange suit en fin de tour.
- **Mise maximale d'un side bet = `max / 10` arrondi au multiple de 10 inférieur.**
- **Les montants hors limites sont refusés (`EngineError`)**, pas tronqués ; l'UI utilise `betRoom()` pour proposer un montant valide.
- **Changer de table rend les mises, efface la re-mise et ouvre un nouveau sabot** — nouvelle table, nouveau sabot.
- **`applyAction(state, action, deps?)`** : troisième paramètre optionnel pour injecter le RNG (crypto par défaut).
- **Vue d'affichage (`engine/view.ts`) dans le moteur** — c'est du TypeScript pur ; un fuzz test vérifie que rejouer les événements reproduit exactement l'état projeté.
- **21+3 : RTP théorique 95,38 %** avec la table de paiement imposée (100/40/30/10/5, 6 jeux) — calculé par dénombrement exact ; Perfect Pairs : 93,89 % (1 − 19/311).
- **`npm run test` exécute la couverture** et échoue sous 95 % sur `src/engine/**`.

## Simulation

- **La simulation passe par le vrai moteur (`applyAction`)** et non par un simulateur parallèle — c'est le moteur lui-même qui est validé.
- **Verdict avec intervalle de confiance** : ✅ si l'estimation est dans 0,3–0,7 %, ⚠️ si elle est hors plage mais que l'intervalle à 95 % la recoupe (échantillon trop petit), ❌ sinon (code de sortie 1). La plage n'est pas modifiée.
- **`SIMULATION.md` de référence calculé sur 60 M de mains** (erreur standard 0,014 pt) : avec ces règles l'avantage maison réel est ≈ 0,31 %, au bas de la plage, car l'abandon contre 2–10 en ENHC équivaut à un abandon précoce contre le 10 (≈ −0,3 pt). Un run à 2 M de mains (± 0,08 pt) peut donc tomber sous 0,3 % par simple fluctuation ; la décomposition par variante (`--variants`) documente l'effet de chaque règle.
- **Stratégie de base ENHC maison** (pas de double 11 contre 10/As, pas de split A-A / 8-8 contre As, abandon 14–16, 7-7, 8-8 contre 10) ; assurance et even money toujours refusés.
- **Side bets simulés par tirage de 3 cartes distinctes dans un sabot complet** (Fisher-Yates partiel) — même loi qu'un tirage en cours de sabot, sans coût de re-mélange.

## Interface et animations

- **Scène virtuelle à coordonnées fixes (1200 × 700 desktop, 420 × 620 mobile) mise à l'échelle** — toutes les positions (cartes, jetons, cases) viennent d'une fonction de layout pure (`fx/layout.ts`), ce qui rend les trajectoires exactes et le responsive trivial.
- **Carrousel mobile par « caméra »** — les places sont décalées horizontalement autour de la place sélectionnée ; boutons, onglets et balayage pour changer de place, recentrage automatique sur la main active.
- **Perspective `rotateX` appliquée à toute la scène** (14° desktop, 8° mobile) pour que cartes, jetons et tapis restent alignés ; les particules utilisent la même projection.
- **Jetons de mise « concurrents »** — ils volent sans bloquer l'interface ; un événement bloquant (distribution) attend leur atterrissage pour garder la vue cohérente.
- **Un clic n'importe où / Espace accélère** la file en cours ; les boutons d'action sont désactivés pendant la lecture.
- **Les effets (sons, particules) sont isolés** : une erreur d'effet est ignorée, une erreur d'application de vue vide la file et resynchronise la vue sur l'état moteur (aucun blocage possible de la table).
- **Jeton d'appoint « 5 » purement visuel** — pour représenter les montants non multiples de 10 (assurance, gain 3:2 sur 10) ; il n'est pas dans le rack.
- **Le sélecteur de table du haut ouvre une fenêtre rapide** (`TableSelectModal`) ; la page `/lobby` présente les mêmes tuiles avec les règles de la maison.
- **Polices et couleurs : variables CSS hexadécimales + canaux RGB** — la couleur d'accent change par table et reste utilisable avec les opacités Tailwind (`bg-accent/40`).
- **Recharge quotidienne calculée sur le solde + mises posées non distribuées** — on ne pénalise pas un joueur qui a déjà posé ses derniers jetons.
- **Quiz Hi-Lo : la réponse attendue est le running count affiché** (cartes visibles depuis le mélange), le panneau est masqué pendant la question ; « Passer » n'enregistre pas d'essai.
- **Drill true count : tolérance ± 0,5** sur RC ÷ decks restants au demi-jeu près ; la défausse est représentée par une pile graduée en jeux.
- **Sons : un fichier `public/sfx/<nom>.mp3` remplace le son synthétisé s'il existe** (vérification du type MIME pour ignorer le fallback SPA `index.html`).
- **Historique et exercices dans Dexie chargé à la demande** (import dynamique) pour alléger le bundle initial ; la page stats (Recharts) et la page entraînement sont aussi chargées en lazy.
- **Export CSV : une ligne par main, séparateur « ; » et BOM UTF-8** — ouverture directe dans les tableurs francophones.
- **Le solde vit dans la vue animée** : le compteur du haut ne change qu'au moment où les jetons arrivent (pas de « spoiler » avant l'animation).

## Accessibilité et qualité

- **Variantes de l'accent calculées par table (`accentVariants`)** : une teinte éclaircie pour le texte sur fond sombre et une teinte assombrie pour les fonds sous texte blanc, toutes deux ≥ 4,5:1 — la table cyan ou or reste conforme AA.
- **Entrée active l'élément focalisé, Espace reste « distribuer »** sur les cases de mise et le rack — un joueur au clavier peut miser (Tab + Entrée) puis distribuer (Espace) ; un joueur à la souris qui vient de cliquer une case distribue avec Espace sans re-miser par erreur.
- **Compteur de fenêtres modales ouvertes** (hors animation de fermeture) pour les raccourcis clavier, et fermeture des modales en 150 ms sans capter les clics.
- **Solde annoncé aux lecteurs d'écran uniquement à sa valeur finale** (le chiffre animé est `aria-hidden`).
- **Accès au store en développement (`window.__nocturne`)** pour le débogage et les tests de bout en bout ; absent du build de production.
- **Outils d'audit (axe-core, Lighthouse) non ajoutés aux dépendances** — utilisés ponctuellement pour valider la checklist, ils alourdiraient l'installation.
