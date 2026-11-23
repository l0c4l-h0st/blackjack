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
