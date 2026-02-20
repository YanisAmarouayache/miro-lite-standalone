import { bootstrapApplication } from "@angular/platform-browser";
import { Component } from "@angular/core";
import { provideHttpClient, withFetch } from "@angular/common/http";
import { provideApollo } from "apollo-angular";
import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
} from "@apollo/client/core";
import { MiroBoardComponent } from "./app/features/miro-board/presentation/miro-board.component";
import { BoardGraphqlRepository } from "./app/features/miro-board/infrastructure/board-graphql.repository";
import { BOARD_REPOSITORY } from "./app/features/miro-board/domain/ports/board-repository.port";
import { environment } from "./environments/environment";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [MiroBoardComponent],
  template: `<miro-board [boardId]="'demo-board'"></miro-board>`,
})
class AppComponent {}

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withFetch()),
    provideApollo(
      () =>
        new ApolloClient({
          link: createHttpLink({ uri: environment.graphqlUrl }),
          cache: new InMemoryCache(),
        })
    ),
    BoardGraphqlRepository,
    { provide: BOARD_REPOSITORY, useExisting: BoardGraphqlRepository },
  ],
}).catch((err) => console.error(err));
