# miro-lite-standalone

Projet inspiré de `miro-clone`, orienté **frontend-first** avec Angular et un backend minimal.

## Objectif
- Composant Angular **standalone** réutilisable dans une application existante.
- Architecture clean côté frontend:
  - `domain`: modèles métier
  - `application`: use cases / façade
  - `infrastructure`: accès API
  - `presentation`: composants standalone
- Backend Go minimal (sans auth), uniquement pour charger/sauver l'état d'un board.

## Structure
- `frontend/`: Angular app + composant standalone `miro-board`
- `backend/`: API HTTP minimale avec persistance JSON locale (`backend/data/boards.json`)

## Quick start

### Backend
```bash
cd backend
go run ./cmd/server
# API: http://localhost:8081

# Optionnel: override CORS allowlist
# ALLOWED_ORIGINS="http://localhost:4201,http://localhost:4200" go run ./cmd/server
```

### Frontend
```bash
cd frontend
npm install
npm start
# App: http://localhost:4201
```

## Intégrer le composant standalone dans une autre app Angular
Importer `MiroBoardComponent` depuis:
- `frontend/src/app/features/miro-board/index.ts`

Puis dans ton composant hôte:
```ts
@Component({
  standalone: true,
  imports: [MiroBoardComponent],
  template: `<miro-board [boardId]="'demo-board'"></miro-board>`
})
export class HostComponent {}
```
