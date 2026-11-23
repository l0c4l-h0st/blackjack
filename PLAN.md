# Nocturne 21 — Plan de développement

Blackjack européen (ENHC) solo, 100 % navigateur, crédits fictifs. Ce document décrit
l'architecture retenue et l'ordre de construction. Les arbitrages ponctuels sont dans
`DECISIONS.md`.

## Principes d'architecture

1. **Moteur pur** (`src/engine/`) : TypeScript sans React ni DOM. API
   `applyAction(state, action) → { state, events }` et `getAvailableActions(state)`.
   - `GameState` est un objet JSON pur (sabot, défausse, carte de coupe, mises, mains,
     solde, phase). Il est persisté après chaque action → reprise exacte après F5.
   - Le moteur traverse automatiquement les phases transitoires (`DEALING`, `SIDE_BETS`,
     `DEALER_TURN`, `SETTLEMENT`, `SHUFFLING`) et ne « repose » que dans les phases qui
     attendent une décision : `BETTING`, `INSURANCE`, `PLAYER_TURNS`, `ROUND_END`.
   - Chaque micro-étape émet un `GameEvent` typé (distribution, retournement, jetons, résultats…).
   - Le RNG est injectable (`Rng`) : crypto en production, sabot truqué dans les tests.
2. **Modèle d'affichage** (`src/engine/view.ts`) : `projectView(state)` produit la vue « au
   repos », `reduceView(view, event)` applique un événement. Invariant testé par fuzz :
   rejouer les événements d'une action sur la vue précédente donne exactement
   `projectView(nouvelEtat)`. L'UI n'affiche que la vue → animations parfaitement synchrones.
3. **Animation director** (`src/fx/animationDirector.ts`) : consomme la file d'événements un
   par un (durée × vitesse), applique la vue, déclenche sons/particules. Clic ou `Espace` =
   accélère la fin de la file. `prefers-reduced-motion` → vitesse instantanée par défaut.
4. **Stores Zustand** : `gameStore` (état moteur + vue + file), `profileStore` (XP, niveau,
   recharge), `settingsStore`. Persistance dans **une seule clé** `nocturne21:v1` avec
   versions de schéma et migrations.
5. **Dexie** : historique des tours (`hands`) et des exercices de comptage (`countDrills`).
6. **Rendu** : scène virtuelle (coordonnées fixes, mise à l'échelle CSS) avec perspective ; les
   positions des cartes/jetons sont calculées par une fonction de layout pure (desktop/mobile,
   carrousel par « caméra » sur mobile). Cartes et jetons 100 % SVG générés.

## Phases

| Phase | Contenu | Fichiers principaux | Sortie |
|---|---|---|---|
| 0 | Outillage Vite/TS strict/Tailwind/ESLint/Prettier/Vitest, `PLAN.md`, `DECISIONS.md`, `vercel.json` | configs | build OK |
| 1 | Moteur complet + tests (≥ 95 % couverture `engine/`) | `engine/*`, `config/rules.ts`, `tests/engine/*` | tests verts |
| 2 | Stratégie de base ENHC + simulation Monte-Carlo, `SIMULATION.md` | `engine/strategy/basic.ts`, `scripts/simulate.ts` | avantage maison 0,3–0,7 % |
| 3 | Design system : thème, cartes/jetons SVG, table statique, layout desktop + mobile | `components/cards`, `components/chips`, `components/table`, `fx/layout.ts` | rendu §8 |
| 4 | Branchement moteur ↔ UI : stores, persistance, director, barre d'actions, clavier | `store/*`, `fx/animationDirector.ts`, `components/actions` | partie jouable |
| 5 | Animations ultra (arcs, flip 3D, suspense), physique jetons, particules Canvas, sons Web Audio | `fx/physics.ts`, `fx/particles.ts`, `audio/soundEngine.ts` | 60 fps, reduced-motion |
| 6 | Progression : XP, niveaux, tables, lobby, recharge quotidienne, modale level-up | `config/progression.ts`, `config/tables.ts`, `pages/LobbyPage.tsx` | tests progression |
| 7 | Hi-Lo : panneau, quiz en jeu, page d'entraînement (2 drills) | `components/count/*`, `pages/TrainingPage.tsx` | tests comptage |
| 8 | Stats & historique (Dexie, Recharts lazy, filtres, détail, export CSV) | `db/dexie.ts`, `pages/StatsPage.tsx`, `components/stats/*` | page lazy + CSV |
| 9 | Polish : responsive 375/768/1440, a11y, perf/bundle, réglages (export/import/reset), README | — | checklist §16 |

Chaque phase se termine par `npm run lint && npm run test && npm run build` puis un commit.

## Flux d'un tour (moteur)

```
BETTING ──DEAL──► DEALING ► SIDE_BETS ► [INSURANCE si As] ► PLAYER_TURNS ► DEALER_TURN ► SETTLEMENT ► ROUND_END
   ▲                                                                                                    │
   └──────────── (NEW_ROUND / première mise : cartes → défausse, [SHUFFLING si coupe atteinte]) ◄───────┘
```

Les cartes restent visibles en `ROUND_END` jusqu'à la prochaine interaction de mise (ou la
re-mise automatique), pour laisser le temps de lire les résultats.

## État

Toutes les phases (0 à 9) sont terminées. Vérifications finales :

- `npm run lint`, `npm run test` (210 tests, couverture `engine/` > 99 %), `npm run build` : 0 erreur.
- Simulation : avantage maison 0,313 % ± 0,014 % sur 60 M de mains (`SIMULATION.md`).
- axe-core : 0 violation (table, modales, lobby, stats, entraînement).
- Lighthouse desktop : Performance 100, Accessibilité 100, Bonnes pratiques 100 ; mobile : 95 / 100 / 96.
- Bundle initial ≈ 150 Ko gzip (page stats et Dexie chargés à la demande).
