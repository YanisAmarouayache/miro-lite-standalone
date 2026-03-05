import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import { BoardModel } from "../board.model";
import { CapaOpsDoughnutSnapshot } from "../capaops.model";
import { DataSourceDefinitionModel } from "../datasource-definition.model";
import { OverlaySummary, UnitSummary } from "../overlay-summary.model";

export interface WidgetSnapshotResult {
  widgetId: string;
  dataSourceCode: string;
  snapshot: CapaOpsDoughnutSnapshot | null;
  updatedAt: string;
}

export interface BoardRepositoryPort {
  load(boardId: string): Observable<BoardModel>;
  listDataSourceDefinitions(): Observable<DataSourceDefinitionModel[]>;
  listAccessibleOverlays(userHuid: string): Observable<OverlaySummary[]>;
  listOverlayUnits(overlayHuid: string): Observable<UnitSummary[]>;
  save(board: BoardModel): Observable<number>;
  fetchWidgetSnapshot(
    boardId: string,
    widgetId: string
  ): Observable<WidgetSnapshotResult>;
  subscribe(boardId: string): Observable<BoardModel>;
}

export const BOARD_REPOSITORY = new InjectionToken<BoardRepositoryPort>(
  "BOARD_REPOSITORY"
);
