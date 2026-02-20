import { bootstrapApplication } from "@angular/platform-browser";
import { provideHttpClient, withFetch } from "@angular/common/http";
import { provideApollo } from "apollo-angular";
import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
} from "@apollo/client/core";
import { provideRouter } from "@angular/router";
import { BoardGraphqlRepository } from "./app/features/miro-board/infrastructure/board-graphql.repository";
import { BOARD_REPOSITORY } from "./app/features/miro-board/domain/ports/board-repository.port";
import { environment } from "./environments/environment";
import { AppComponent } from "./app/app.component";
import { appRoutes } from "./app/app.routes";

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(appRoutes),
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
