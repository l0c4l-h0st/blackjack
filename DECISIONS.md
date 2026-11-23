# Décisions

Une ligne par décision : **quoi** — pourquoi.

## Outillage

- **Vite 6.4 + Vitest 4.1 + React Router 7** (au lieu des versions plus anciennes) — versions sans vulnérabilité connue à l'installation (`npm audit` = 0) ; React Router 7 reste compatible React 18.
- **`.npmrc` avec `legacy-peer-deps=true`** — contourne un bug de résolution des peer-deps optionnelles de npm 10 (`Cannot read properties of null (reading 'edgesOut')`) ; aucune dépendance n'est réellement en conflit.
- **Polices auto-hébergées via `@fontsource` (Inter, Space Grotesk, sous-ensemble latin)** — pas d'appel réseau tiers, pas de cookie, chargement plus rapide.
- **Deux tsconfig (app / node)** — le code navigateur n'a pas accès aux types Node, et le script de simulation n'a pas accès au DOM.
