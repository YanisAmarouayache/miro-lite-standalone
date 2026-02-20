import { Injectable, inject } from "@angular/core";
import { Apollo } from "apollo-angular";
import { Observable, map, catchError, throwError } from "rxjs";
import { print } from "graphql";
import { BoardModel } from "../domain/board.model";
import { BoardRepositoryPort } from "../domain/ports/board-repository.port";
import { GqlWidgetPayload, payloadToWidget, widgetToInput } from "./board-graphql.mapper";
import {
  BOARD_UPDATED_SUBSCRIPTION,
  GET_BOARD,
  SAVE_BOARD,
} from "./board-graphql.operations";
import { WHITEBOARD_GRAPHQL_URL } from "../whiteboard.providers";

// ─── Repository ───────────────────────────────────────────────────────────────

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
          const msg = extractGraphqlMessage(err) ?? "";
          if (isVersionConflictError(err, msg)) {
            return throwError(() => ({ status: 409, message: msg }));
          }
          return throwError(() => err);
        })
      );
  }

  subscribe(boardId: string): Observable<BoardModel> {
    return new Observable<BoardModel>((observer) => {
      const wsUrl = toWebSocketUrl(this.graphqlUrl);
      const socket = new WebSocket(wsUrl, "graphql-transport-ws");
      const operationId = `board-updated-${boardId}-${Date.now()}`;
      let isAcked = false;

      socket.onopen = () => {
        socket.send(JSON.stringify({ type: "connection_init", payload: {} }));
      };

      socket.onmessage = (event) => {
        let payload: any;
        try {
          payload = JSON.parse(event.data as string);
        } catch {
          return;
        }

        if (payload.type === "connection_ack") {
          if (isAcked) return;
          isAcked = true;
          socket.send(
            JSON.stringify({
              id: operationId,
              type: "subscribe",
              payload: {
                query: print(BOARD_UPDATED_SUBSCRIPTION),
                variables: { boardId },
              },
            })
          );
          return;
        }

        if (payload.type === "ping") {
          socket.send(JSON.stringify({ type: "pong" }));
          return;
        }

        if (payload.type === "next" && payload.id === operationId) {
          const board = payload?.payload?.data?.boardUpdated as
            | {
                id: string;
                version: number;
                widgets: GqlWidgetPayload[];
              }
            | undefined;
          if (!board) return;
          observer.next({
            id: board.id ?? boardId,
            version: board.version ?? 1,
            widgets: board.widgets?.map(payloadToWidget) ?? [],
          });
          return;
        }

        if (payload.type === "error" && payload.id === operationId) {
          observer.error(new Error("Subscription error"));
          return;
        }

        if (payload.type === "complete" && payload.id === operationId) {
          observer.complete();
        }
      };

      socket.onerror = () => {
        observer.error(new Error("Subscription connection failed"));
      };

      socket.onclose = () => {
        observer.complete();
      };

      return () => {
        try {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ id: operationId, type: "complete" }));
          }
          socket.close();
        } catch {
          // no-op
        }
      };
    });
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

function toWebSocketUrl(httpUrl: string): string {
  if (httpUrl.startsWith("https://")) {
    return "wss://" + httpUrl.slice("https://".length);
  }
  if (httpUrl.startsWith("http://")) {
    return "ws://" + httpUrl.slice("http://".length);
  }
  return httpUrl;
}
