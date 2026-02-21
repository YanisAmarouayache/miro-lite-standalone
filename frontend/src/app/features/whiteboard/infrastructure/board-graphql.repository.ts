import { Injectable, inject } from "@angular/core";
import { Apollo } from "apollo-angular";
import { Observable, map, catchError, throwError } from "rxjs";
import { BoardModel } from "../domain/board.model";
import { BoardRepositoryPort } from "../domain/ports/board-repository.port";
import {
  GqlWidgetPayload,
  payloadToWidget,
  widgetToInput,
} from "./board-graphql.mapper";
import { GET_BOARD, SAVE_BOARD } from "./board-graphql.operations";
import { VersionConflictError } from "./board-graphql.errors";
import {
  createBoardSubscriptionStream,
  toWebSocketUrl,
} from "./board-graphql.subscription";
import { WHITEBOARD_GRAPHQL_URL } from "../whiteboard.providers";

@Injectable()
export class BoardGraphqlRepository implements BoardRepositoryPort {
  private readonly apollo = inject(Apollo);
  private readonly graphqlUrl = inject(WHITEBOARD_GRAPHQL_URL);

  load(boardId: string): Observable<BoardModel> {
    return this.apollo
      .query<{
        board: { id: string; version: number; widgets: GqlWidgetPayload[] } | null;
      }>({
        query: GET_BOARD,
        variables: { id: boardId },
        fetchPolicy: "network-only",
      })
      .pipe(
        map(({ data }) => {
          const board = data?.board;
          return {
            id: board?.id ?? boardId,
            version: board?.version ?? 1,
            widgets: board?.widgets?.map(payloadToWidget) ?? [],
          };
        }),
        catchError((err) => {
          const message = extractGraphqlMessage(err) ?? "GraphQL load failed";
          return throwError(() => new Error(message));
        })
      );
  }

  save(board: BoardModel): Observable<number> {
    return this.apollo
      .mutate<{
        saveBoard: { id: string; version: number } | null;
      }>({
        mutation: SAVE_BOARD,
        variables: {
          boardId: board.id,
          version: board.version,
          widgets: board.widgets.map(widgetToInput),
        },
      })
      .pipe(
        map(({ data }) => data?.saveBoard?.version ?? board.version + 1),
        catchError((err) => {
          const msg = extractGraphqlMessage(err) ?? "";
          if (isVersionConflictError(err, msg)) {
            return throwError(
              () => new VersionConflictError(msg || "Version conflict")
            );
          }
          return throwError(() => err);
        })
      );
  }

  subscribe(boardId: string): Observable<BoardModel> {
    return createBoardSubscriptionStream(toWebSocketUrl(this.graphqlUrl), boardId);
  }
}

function extractGraphqlMessage(err: unknown): string | undefined {
  const asAny = err as any;
  return (
    asAny?.graphQLErrors?.[0]?.message ||
    asAny?.errors?.[0]?.message ||
    asAny?.networkError?.result?.errors?.[0]?.message ||
    asAny?.message
  );
}

function isVersionConflictError(err: unknown, message: string): boolean {
  if (message.toLowerCase().includes("version conflict")) return true;
  const asAny = err as any;
  const networkStatus = asAny?.networkError?.statusCode;
  return networkStatus === 409;
}
