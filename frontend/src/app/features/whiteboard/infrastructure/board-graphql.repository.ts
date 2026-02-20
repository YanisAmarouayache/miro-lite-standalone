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
            return throwError(() => ({ status: 409, message: msg }));
          }
          return throwError(() => err);
        })
      );
  }

  subscribe(boardId: string): Observable<BoardModel> {
    return new Observable<BoardModel>((observer) => {
      const wsUrl = toWebSocketUrl(this.graphqlUrl);
      let socket: WebSocket | null = null;
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
      let disposed = false;
      let reconnectAttempt = 0;
      let activeOperationId: string | null = null;
      let waitingForOnline = false;
      const baseReconnectDelayMs = 250;
      const maxReconnectDelayMs = 5000;

      const isOnline = (): boolean =>
        typeof navigator === "undefined" || navigator.onLine !== false;

      const onOnline = (): void => {
        waitingForOnline = false;
        if (disposed) return;
        if (reconnectTimer !== null) return;
        connect();
      };

      const waitForOnline = (): void => {
        if (waitingForOnline) return;
        if (typeof window === "undefined") return;
        waitingForOnline = true;
        window.addEventListener("online", onOnline, { once: true });
      };

      const scheduleReconnect = (): void => {
        if (disposed || reconnectTimer !== null) return;
        if (!isOnline()) {
          waitForOnline();
          return;
        }
        const exponentialDelay = Math.min(
          maxReconnectDelayMs,
          baseReconnectDelayMs * Math.pow(2, reconnectAttempt)
        );
        const jitterMultiplier = 0.5 + Math.random();
        const delay = Math.min(
          maxReconnectDelayMs,
          Math.floor(exponentialDelay * jitterMultiplier)
        );
        reconnectAttempt += 1;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, delay);
      };

      const connect = (): void => {
        if (disposed) return;
        const currentSocket = new WebSocket(wsUrl, "graphql-transport-ws");
        socket = currentSocket;
        const operationId = `board-updated-${boardId}-${Date.now()}`;
        activeOperationId = operationId;
        let isAcked = false;

        currentSocket.onopen = () => {
          reconnectAttempt = 0;
          waitingForOnline = false;
          currentSocket.send(
            JSON.stringify({ type: "connection_init", payload: {} })
          );
        };

        currentSocket.onmessage = (event) => {
          let payload: any;
          try {
            payload = JSON.parse(event.data as string);
          } catch {
            return;
          }

          if (payload.type === "connection_ack") {
            if (isAcked) return;
            isAcked = true;
            currentSocket.send(
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
            currentSocket.send(JSON.stringify({ type: "pong" }));
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
            scheduleReconnect();
            return;
          }

          if (payload.type === "complete" && payload.id === operationId) {
            scheduleReconnect();
          }
        };

        currentSocket.onerror = () => {
          scheduleReconnect();
        };

        currentSocket.onclose = () => {
          if (socket === currentSocket) {
            socket = null;
            activeOperationId = null;
          }
          scheduleReconnect();
        };
      };

      connect();

      return () => {
        disposed = true;
        if (reconnectTimer !== null) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        if (waitingForOnline && typeof window !== "undefined") {
          window.removeEventListener("online", onOnline);
          waitingForOnline = false;
        }
        try {
          if (socket?.readyState === WebSocket.OPEN && activeOperationId) {
            socket.send(
              JSON.stringify({ id: activeOperationId, type: "complete" })
            );
          }
          socket?.close();
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
