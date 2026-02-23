import {
  EnvironmentProviders,
  InjectionToken,
  makeEnvironmentProviders,
} from "@angular/core";
import { provideApollo } from "apollo-angular";
import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
} from "@apollo/client/core";
import { BOARD_REPOSITORY } from "./domain/ports/board-repository.port";
import { WIDGET_CATALOG } from "./domain/ports/widget-catalog.port";
import { BoardGraphqlRepository } from "./infrastructure/board-graphql.repository";
import { WidgetCatalogRepository } from "./infrastructure/widget-catalog.repository";

export interface WhiteboardProvidersConfig {
  graphqlUrl: string;
}

export const WHITEBOARD_GRAPHQL_URL = new InjectionToken<string>(
  "WHITEBOARD_GRAPHQL_URL"
);

export function provideWhiteboard(
  config: WhiteboardProvidersConfig
): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideApollo(
      () =>
        new ApolloClient({
          link: createHttpLink({ uri: config.graphqlUrl }),
          cache: new InMemoryCache(),
        })
    ),
    BoardGraphqlRepository,
    WidgetCatalogRepository,
    { provide: BOARD_REPOSITORY, useExisting: BoardGraphqlRepository },
    { provide: WIDGET_CATALOG, useExisting: WidgetCatalogRepository },
    { provide: WHITEBOARD_GRAPHQL_URL, useValue: config.graphqlUrl },
  ]);
}
