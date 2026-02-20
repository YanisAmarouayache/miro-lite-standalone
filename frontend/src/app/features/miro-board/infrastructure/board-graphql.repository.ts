import { Injectable, inject } from "@angular/core";
import { Apollo } from "apollo-angular";
import { Observable, map, catchError, throwError } from "rxjs";
import { BoardModel } from "../domain/board.model";
import { BoardRepositoryPort } from "../domain/ports/board-repository.port";
import { GqlWidgetPayload, payloadToWidget, widgetToInput } from "./board-graphql.mapper";
import { GET_BOARD, SAVE_BOARD } from "./board-graphql.operations";

// ─── Repository ───────────────────────────────────────────────────────────────

@Injectable()
export class BoardGraphqlRepository implements BoardRepositoryPort {
  private readonly apollo = inject(Apollo);

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
      );
  }

  save(board: BoardModel): Observable<void> {
    return this.apollo
      .mutate({
        mutation: SAVE_BOARD,
        variables: {
          boardId: board.id,
          version: board.version,
          widgets: board.widgets.map(widgetToInput),
        },
      })
      .pipe(
        map(() => void 0),
        catchError((err) => {
          const msg = err?.graphQLErrors?.[0]?.message ?? "";
          if (msg.includes("version conflict")) {
            return throwError(() => ({ status: 409, message: msg }));
          }
          return throwError(() => err);
        })
      );
  }
}
