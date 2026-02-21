import { Observable } from "rxjs";
import { print } from "graphql";
import { BoardModel } from "../domain/board.model";
import { payloadToWidget } from "./board-graphql.mapper";
import { BOARD_UPDATED_SUBSCRIPTION } from "./board-graphql.operations";
import { parseWsMessage } from "./board-graphql.ws-types";

export function toWebSocketUrl(httpUrl: string): string {
  if (httpUrl.startsWith("https://")) {
    return "wss://" + httpUrl.slice("https://".length);
  }
  if (httpUrl.startsWith("http://")) {
    return "ws://" + httpUrl.slice("http://".length);
  }
  return httpUrl;
}

export function createBoardSubscriptionStream(
  wsUrl: string,
  boardId: string
): Observable<BoardModel> {
  return new Observable<BoardModel>((observer) => {
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
      if (disposed || reconnectTimer !== null) return;
      connect();
    };

    const waitForOnline = (): void => {
      if (waitingForOnline || typeof window === "undefined") return;
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

    const teardownSocket = (): void => {
      if (!socket) return;
      try {
        if (socket.readyState === WebSocket.OPEN && activeOperationId) {
          socket.send(JSON.stringify({ id: activeOperationId, type: "complete" }));
        }
        socket.close();
      } catch {
        // no-op
      } finally {
        socket = null;
        activeOperationId = null;
      }
    };

    const connect = (): void => {
      if (disposed) return;
      const currentSocket = new WebSocket(wsUrl, "graphql-transport-ws");
      socket = currentSocket;
      let reconnectRequested = false;

      const requestReconnect = (): void => {
        if (reconnectRequested) return;
        reconnectRequested = true;
        if (socket === currentSocket) {
          socket = null;
          activeOperationId = null;
        }
        scheduleReconnect();
      };

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
        const payload = parseWsMessage(event.data);
        if (!payload) return;

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
          const board = payload.payload?.data?.boardUpdated;
          if (!board) return;
          observer.next({
            id: board.id ?? boardId,
            version: board.version ?? 1,
            widgets: board.widgets?.map(payloadToWidget) ?? [],
          });
          return;
        }

        if (payload.type === "error" && payload.id === operationId) {
          requestReconnect();
          return;
        }

        if (payload.type === "complete" && payload.id === operationId) {
          requestReconnect();
        }
      };

      currentSocket.onerror = () => {
        requestReconnect();
      };

      currentSocket.onclose = () => {
        requestReconnect();
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
      teardownSocket();
    };
  });
}
