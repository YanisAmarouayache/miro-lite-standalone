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
- `frontend/`: Angular app + composant standalone `whiteboard`
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
Importer `WhiteboardComponent` depuis:
- `frontend/src/app/features/whiteboard/index.ts`

Providers globaux (Apollo requis, le client `whiteboard` est nommé):
```ts
import { ApplicationConfig } from "@angular/core";
import { provideHttpClient, withFetch } from "@angular/common/http";
import { provideApollo } from "apollo-angular";
import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
} from "@apollo/client/core";
import { provideWhiteboard } from "path/to/whiteboard";
import { WHITEBOARD_APOLLO_CLIENT } from "path/to/whiteboard";

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withFetch()),
    provideApollo((injector) => ({
      default: new ApolloClient({
        cache: new InMemoryCache(),
        link: createHttpLink({
          uri: "https://your-api/graphql",
          injector,
        }),
      }),
      [WHITEBOARD_APOLLO_CLIENT]: new ApolloClient({
        cache: new InMemoryCache(),
        link: createHttpLink({
          uri: "https://whiteboard-api/graphql",
          injector,
        }),
      }),
    })),
    provideWhiteboard({ graphqlUrl: "https://whiteboard-api/graphql" }),
  ],
};
```

Puis dans ton composant hôte:
```ts
@Component({
  standalone: true,
  imports: [WhiteboardComponent],
  template: `<whiteboard [boardId]="'demo-board'"></whiteboard>`
})
export class HostComponent {}
```
