import { Injectable, inject } from "@angular/core";
import { Apollo } from "apollo-angular";
import { Observable, map, catchError, throwError } from "rxjs";
import { BoardModel } from "../domain/board.model";
import {
  BoardRepositoryPort,
  WidgetSnapshotResult,
} from "../domain/ports/board-repository.port";
import {
  GqlWidgetPayload,
  parseCapaOpsDoughnutSnapshot,
  payloadToWidget,
  widgetToInput
} from "./board-graphql.mapper";
import {
  FETCH_WIDGET_SNAPSHOT,
  GET_ACCESSIBLE_OVERLAYS,
  GET_DATA_SOURCE_DEFINITIONS,
  GET_BOARD,
  GET_OVERLAY_UNITS,
  SAVE_BOARD,
} from "./board-graphql.operations";
import { VersionConflictError } from "./board-graphql.errors";
import {
  createBoardSubscriptionStream,
  toWebSocketUrl,
} from "./board-graphql.subscription";
import { WHITEBOARD_GRAPHQL_URL } from "../whiteboard.providers";
import { DataSourceDefinitionModel } from "../domain/datasource-definition.model";
import { OverlaySummary, UnitSummary } from "../domain/overlay-summary.model";

@Injectable()
export class BoardGraphqlRepository implements BoardRepositoryPort {
  private readonly apollo = inject(Apollo);
  private readonly graphqlUrl = inject(WHITEBOARD_GRAPHQL_URL);

  load(boardId: string): Observable<BoardModel> {
    return this.apollo
      .query<{
        board: {
          id: string;
          title: string;
          version: number;
          widgets: GqlWidgetPayload[];
        } | null;
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
            title: board?.title ?? boardId,
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

  listDataSourceDefinitions(): Observable<DataSourceDefinitionModel[]> {
    return this.apollo
      .query<{
        dataSourceDefinitions: Array<{
          id: string;
          code: string;
          version: number;
          protocol: string;
          operationName: string;
          request: string;
          variablesSchemaJson: string;
          resultSchemaJson: string;
        }>;
      }>({
        query: GET_DATA_SOURCE_DEFINITIONS,
        fetchPolicy: "network-only",
      })
      .pipe(
        map(({ data }) =>
          (data?.dataSourceDefinitions ?? []).map((item) => ({
            id: item.id,
            code: item.code,
            version: item.version,
            protocol: item.protocol,
            operationName: item.operationName,
            request: item.request,
            variablesSchema: parseJsonObject(item.variablesSchemaJson),
            resultSchema: parseJsonObject(item.resultSchemaJson),
          }))
        ),
        catchError((err) => {
          const message =
            extractGraphqlMessage(err) ?? "Data source definitions load failed";
          return throwError(() => new Error(message));
        })
      );
  }

  listAccessibleOverlays(userHuid: string): Observable<OverlaySummary[]> {
    return this.apollo
      .query<{
        accessibleOverlays: Array<{
          huid: string;
          name: string;
        }>;
      }>({
        query: GET_ACCESSIBLE_OVERLAYS,
        variables: { userHuid },
        fetchPolicy: "network-only",
      })
      .pipe(
        map(({ data }) =>
          (data?.accessibleOverlays ?? []).map((item) => ({
            huid: item.huid,
            name: item.name,
          }))
        ),
        catchError((err) => {
          const message =
            extractGraphqlMessage(err) ?? "Accessible overlays load failed";
          return throwError(() => new Error(message));
        })
      );
  }

  listOverlayUnits(overlayHuid: string): Observable<UnitSummary[]> {
    return this.apollo
      .query<{
        overlayUnits: Array<{
          huid: string;
          name: string;
        }>;
      }>({
        query: GET_OVERLAY_UNITS,
        variables: { overlayHuid },
        fetchPolicy: "network-only",
      })
      .pipe(
        map(({ data }) =>
          (data?.overlayUnits ?? []).map((item) => ({
            huid: item.huid,
            name: item.name,
          }))
        ),
        catchError((err) => {
          const message = extractGraphqlMessage(err) ?? "Overlay units load failed";
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
        map(({ data }) => {
          const serverVersion = data?.saveBoard?.version;
          if (typeof serverVersion === "number" && Number.isFinite(serverVersion)) {
            return serverVersion;
          }
          // Degraded mode: keep board usable even when backend payload is partial.
          const fallbackVersion = board.version + 1;
          console.warn(
            "[whiteboard] saveBoard returned empty payload, using degraded optimistic fallback version",
            { boardId: board.id, localVersion: board.version, fallbackVersion }
          );
          return fallbackVersion;
        }),
        catchError((err) => {
          const msg = extractGraphqlMessage(err) ?? "";
          if (isVersionConflictError(err, msg)) {
            return throwError(
              () => new VersionConflictError(msg || "Version conflict")
            );
          }
          const message = msg || "GraphQL save failed";
          return throwError(() => new Error(message));
        })
      );
  }

  fetchWidgetSnapshot(
    boardId: string,
    widgetId: string
  ): Observable<WidgetSnapshotResult> {
    return this.apollo
      .mutate<{
        fetchWidgetSnapshot: {
          widgetId: string;
          dataSourceCode: string;
          normalizedValueJson: string;
          updatedAt: string;
        } | null;
      }>({
        mutation: FETCH_WIDGET_SNAPSHOT,
        variables: { boardId, widgetId },
      })
      .pipe(
        map(({ data }) => {
          const payload = data?.fetchWidgetSnapshot;
          if (!payload) {
            throw new Error("Snapshot fetch returned empty payload");
          }
          return {
            widgetId: payload.widgetId,
            dataSourceCode: payload.dataSourceCode,
            snapshot: parseCapaOpsDoughnutSnapshot(payload.normalizedValueJson),
            updatedAt: payload.updatedAt,
          };
        }),
        catchError((err) => {
          const message = extractGraphqlMessage(err) ?? "Snapshot fetch failed";
          return throwError(() => new Error(message));
        })
      );
  }

  subscribe(boardId: string): Observable<BoardModel> {
    return createBoardSubscriptionStream(
      toWebSocketUrl(this.graphqlUrl),
      boardId,
      () => ({})
    );
  }
}

function parseJsonObject(raw: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
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
