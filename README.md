# Nocturne 21

Blackjack européen solo, 100 % dans le navigateur : moteur ENHC rigoureux (sabot de 6 jeux,
split/re-split, abandon, assurance, side bets), animations soignées (cartes 3D, physique des
jetons, particules, sons synthétisés), progression XP / niveaux / tables, entraîneur au comptage
Hi-Lo et statistiques complètes.

> **Jeu gratuit. Crédits fictifs sans valeur, non échangeables, non remboursables. Aucun achat,
> aucun dépôt, aucun retrait.** Aucun backend, aucun compte, aucun cookie tiers : tout est stocké
> dans votre navigateur (localStorage + IndexedDB).

## Lancer en local

Prérequis : Node.js ≥ 20.

```bash
npm install
npm run dev
```

Puis ouvrir <http://localhost:5173>. Version de production : `npm run build && npm run preview`.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement Vite |
| `npm run build` | Vérification TypeScript stricte + build de production (`dist/`) |
| `npm run preview` | Sert le build de production |
| `npm run lint` | ESLint (0 warning toléré) + vérification Prettier |
| `npm run format` | Formate le code avec Prettier |
| `npm run test` | Tests Vitest + couverture (seuil 95 % sur `src/engine/`) |
| `npm run simulate -- --hands 2000000` | Simulation Monte-Carlo (voir ci-dessous) |

## Tests

```bash
npm run test
```

Plus de 200 tests : règles du moteur sur sabot truqué (blackjack, ENHC, assurance, abandon,
split/re-split, doubles, side bets…), χ² du mélange Fisher-Yates, sérialisation, fuzz de
50 000 tours (montants entiers, solde jamais négatif, vue animée toujours cohérente avec l'état),
progression, comptage, statistiques, persistance et animation director.

## Simulation

```bash
npm run simulate -- --hands 2000000
```

Options : `--sidebets 10000000` (tirages pour Perfect Pairs / 21+3), `--variants 10000000`
(décomposition par variante de règles), `--seed 42` (RNG reproductible), `--out SIMULATION.md`.
La simulation joue la stratégie de base ENHC à travers le vrai moteur et écrit ses résultats dans
[`SIMULATION.md`](SIMULATION.md) (référence : 60 M de mains, avantage maison 0,313 % ± 0,014 %).

## Déployer sur Vercel (3 commandes)

```bash
npm i -g vercel
vercel login
vercel --prod
```

`vercel.json` configure le build Vite et la réécriture SPA vers `index.html` (les routes `/lobby`,
`/stats`, `/training` fonctionnent en accès direct).

## Personnaliser

- **Règles** : `src/config/rules.ts` (une ligne par règle).
- **Tables et paliers** : `src/config/tables.ts` ; **XP et recharge** : `src/config/progression.ts`.
- **Jetons** : `src/config/chips.ts`.
- **Sons** : tous les sons sont synthétisés (Web Audio). Pour en remplacer un, déposez un fichier
  `public/sfx/<nom>.mp3` parmi `cardSlide`, `flip`, `chip`, `chipStack`, `shuffle`, `win`, `lose`,
  `push`, `bust`, `blackjack`, `levelUp`, `jackpot`, `click`.

## Raccourcis clavier

`Espace` / `Entrée` distribuer (ou accélérer une animation) · `H` tirer · `S` rester · `D` doubler ·
`P` séparer · `R` abandonner · `I` / `N` assurance oui / non · `C` panneau de comptage ·
`1`–`8` choisir un jeton · `Tab` puis `Entrée` sur une case pour miser · clic droit pour retirer.

## Architecture

```
src/engine/   moteur pur (aucun import React) : règles, sabot, RNG, side bets, Hi-Lo, vue, stratégie
src/config/   règles, tables, progression, jetons
src/store/    stores Zustand (partie, profil, réglages) persistés dans la clé `nocturne21:v1`
src/fx/       animation director, géométrie de la scène, physique, particules, effets
src/audio/    synthèse Web Audio
src/db/       Dexie (historique des mains, exercices de comptage)
src/stats/    calculs statistiques purs
scripts/      simulation Monte-Carlo
tests/        tests Vitest
```

Le moteur expose `applyAction(state, action) → { state, events }`. L'interface n'affiche qu'une
**vue** reconstruite événement par événement par l'animation director ; un test de fuzz garantit
que rejouer les événements redonne exactement l'état du moteur. Voir [`PLAN.md`](PLAN.md) et
[`DECISIONS.md`](DECISIONS.md).
