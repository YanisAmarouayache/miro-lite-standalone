import { Injectable, inject } from "@angular/core";
import { Apollo, gql } from "apollo-angular";
import { Observable, map, catchError, throwError } from "rxjs";
import { BoardModel, WidgetModel } from "../domain/board.model";

// ─── GraphQL Operations ───────────────────────────────────────────────────────

const GET_BOARD = gql`
  query GetBoard($id: ID!) {
    board(id: $id) {
      id
      version
      widgets {
        id
        type
        x
        y
        width
        height
        configJson
      }
    }
  }
`;

const SAVE_BOARD = gql`
  mutation SaveBoard($boardId: ID!, $version: Int!, $widgets: [WidgetInput!]!) {
    saveBoard(boardId: $boardId, version: $version, widgets: $widgets) {
      id
      version
    }
  }
`;

// ─── Mapping ──────────────────────────────────────────────────────────────────

interface GqlWidgetPayload {
  id?: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number | null;
  height?: number | null;
  configJson?: string;
}

function payloadToWidget(item: GqlWidgetPayload): WidgetModel {
  return {
    id: item.id ?? crypto.randomUUID(),
    type: asWidgetType(item.type ?? "textarea"),
    x: item.x ?? 0,
    y: item.y ?? 0,
    width: item.width ?? 200,
    height: item.height ?? 150,
    config: parseConfig(item.configJson),
  };
}

function asWidgetType(type: string): WidgetModel["type"] {
  if (type === "sticky_note") {
    return "text";
  }
  if (type === "chart" || type === "table" || type === "counter" || type === "text" || type === "image" || type === "textarea") {
    return type;
  }
  return "textarea";
}

function parseConfig(raw?: string): Record<string, unknown> {
  if (typeof raw !== "string" || !raw.trim()) return {};
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

function widgetToInput(w: WidgetModel) {
  return {
    id: w.id,
    type: w.type,
    x: w.x,
    y: w.y,
    width: w.width,
    height: w.height,
    configJson: JSON.stringify(w.config ?? {}),
  };
}

// ─── Repository ───────────────────────────────────────────────────────────────

@Injectable()
export class BoardGraphqlRepository {
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
