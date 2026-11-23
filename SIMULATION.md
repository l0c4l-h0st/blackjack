# Simulation Monte-Carlo — Nocturne 21

Générée par `npm run simulate -- --hands 60000000 --sidebets 10000000` le 2026-11-23.

RNG : crypto.getRandomValues. Moteur réel (`applyAction`) avec les règles par défaut (`src/config/rules.ts`).

## Règles simulées

6 jeux, carte de coupe 70–80 %, 1 carte brûlée, S17, ENHC (le joueur perd doubles et splits sur BJ croupier), BJ 3:2, double sur 2 cartes, DAS, re-split jusqu’à 4 mains (pas les As), une carte par As splitté, abandon contre 2–10, assurance refusée (stratégie de base).

## Blackjack (1 place, mise fixe, stratégie de base ENHC)

| Mesure | Valeur |
|---|---|
| Mains jouées | 60 000 000 |
| Sabots utilisés | 1 323 071 |
| **Avantage maison** (perte moyenne / mise initiale) | **0.313 % ± 0.014 %** (1 erreur standard) |
| Intervalle à 95 % | [0.285 % ; 0.342 %] |
| RTP (total rendu / total misé, doubles et splits inclus) | 99.719 % |
| Fréquence blackjack joueur | 4.739 % (théorie ≈ 4,75 %) |
| Fréquence blackjack croupier | 3.157 % |
| Bust croupier (quand il complète sa main) | 29.292 % |
| Bust croupier (sur toutes les mains) | 22.475 % |
| Tours gagnés / perdus / nuls | 42.00 % / 49.60 % / 8.40 % |
| Abandons / doubles / splits (par main) | 6.54 % / 9.01 % / 2.55 % |
| Durée | 268.6 s (223 373 mains/s) |

Plage attendue pour ces règles : 0.3 % à 0.7 %. Résultat : **✅ dans la plage**.

## Décomposition par variante de règles (10 000 000 mains chacune)

Contrôle de cohérence du moteur : on désactive une règle à la fois et on vérifie que l’avantage maison bouge dans le sens et dans l’ordre de grandeur attendus.

Chaque variante est mesurée sur moins de mains (erreur standard ≈ 0,035 pt) : ce sont les **écarts entre variantes** qui valident le moteur ; la valeur absolue de référence est la mesure principale ci-dessus.

| Variante | Avantage maison | Erreur standard |
|---|---|---|
| Règles du jeu (référence) | 0.252 % | ± 0.035 % |
| Sans abandon | 0.591 % | ± 0.036 % |
| Sans abandon, règle OBO (≈ jeu avec carte cachée) | 0.542 % | ± 0.036 % |

Références publiées (6 jeux, S17, DAS, re-split à 4, carte cachée) : ≈ 0,40 % ; règle ENHC « perte totale sur BJ croupier » : ≈ +0,11 pt. En ENHC, l’abandon autorisé contre 2–10 intervient AVANT que le croupier tire sa 2e carte : c’est un abandon précoce contre le 10, proposé sur ~6,5 % des mains (14–16 durs, 7-7, 8-8 contre 10), ce qui explique un avantage maison final proche de 0,3 %.

## Side bets (10 000 000 tirages de 3 cartes sur un sabot complet)

| Side bet | RTP théorique (dénombrement) | RTP mesuré | Écart | Erreur standard | Verdict (< 0,3 pt) |
|---|---|---|---|---|---|
| Perfect Pairs | 93.891 % | 94.048 % | 0.157 pt | 0.123 pt | ✅ |
| 21+3 | 95.379 % | 95.275 % | 0.104 pt | 0.124 pt | ✅ |

### Perfect Pairs — fréquences des combinaisons

| Combinaison | Probabilité théorique | Fréquence mesurée |
|---|---|---|
| perfectPair | 1.6077 % | 1.6109 % |
| coloredPair | 1.9293 % | 1.9339 % |
| mixedPair | 3.8585 % | 3.8606 % |

### 21+3 — fréquences des combinaisons

| Combinaison | Probabilité théorique | Fréquence mesurée |
|---|---|---|
| suitedTrips | 0.0207 % | 0.0206 % |
| straightFlush | 0.2068 % | 0.2070 % |
| threeOfAKind | 0.5041 % | 0.5013 % |
| straight | 3.1021 % | 3.1077 % |
| flush | 5.8424 % | 5.8307 % |

Durée side bets : 3.2 s.
