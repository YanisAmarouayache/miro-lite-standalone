# WhiteboardComponent (standalone)

Composant Angular standalone, intégrable dans une app existante.

## API
- Input: `boardId: string` (required)
- Provider helper: `provideWhiteboard({ graphqlUrl })`

## Intégration (app hôte)
### 1) Providers globaux
```ts
// app.config.ts (ou bootstrapApplication)
import { ApplicationConfig } from "@angular/core";
import { provideHttpClient, withFetch } from "@angular/common/http";
import { provideWhiteboard } from "path/to/whiteboard";

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withFetch()),
    provideWhiteboard({ graphqlUrl: "https://your-api/graphql" }),
  ],
};
```

### 2) Lazy route feature
```ts
// app.routes.ts
import { Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: "boards/:boardId",
    loadComponent: () =>
      import("path/to/whiteboard-page.component").then(
        (m) => m.WhiteboardPageComponent
      ),
  },
];
```

### 3) Usage direct du composant (sans page wrapper)
```ts
// host.component.ts
import { Component } from "@angular/core";
import { WhiteboardComponent } from "path/to/whiteboard";

@Component({
  standalone: true,
  imports: [WhiteboardComponent],
  template: `
    <section style="height: calc(100vh - 64px)">
      <whiteboard [boardId]="'demo-board'"></whiteboard>
    </section>
  `,
})
export class HostComponent {}
```

## Architecture
- `domain/`: types métier
- `application/`: façade de cas d'usage
- `infrastructure/`: repository GraphQL
- `presentation/`: composant standalone

## Notes
- Pas d'auth
- Backend minimal: endpoint GraphQL `board/saveBoard`
- Le composant est container-friendly (`height: 100%`): le host parent pilote la hauteur
