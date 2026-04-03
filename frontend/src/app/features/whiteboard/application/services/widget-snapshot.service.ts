import { Injectable } from "@angular/core";
import { Observable, map } from "rxjs";
import { BoardModel } from "../../domain/board.model";
import { CapaOpsDoughnutSnapshot } from "../../domain/capaops.model";
import { BoardRepositoryPort } from "../../domain/ports/board-repository.port";

@Injectable({ providedIn: "root" })
export class WidgetSnapshotService {
  fetch(
    repo: BoardRepositoryPort,
    boardId: string,
    widgetId: string
  ): Observable<{ widgetId: string; snapshot: CapaOpsDoughnutSnapshot | null }> {
    return repo.fetchWidgetSnapshot(boardId, widgetId).pipe(
      map((payload) => ({
        widgetId: payload.widgetId,
        snapshot: payload.snapshot,
      }))
    );
  }

  store(
    current: ReadonlyMap<string, CapaOpsDoughnutSnapshot>,
    widgetId: string,
    snapshot: CapaOpsDoughnutSnapshot
  ): ReadonlyMap<string, CapaOpsDoughnutSnapshot> {
    const next = new Map(current);
    next.set(widgetId, snapshot);
    return next;
  }

  extract(board: BoardModel): ReadonlyMap<string, CapaOpsDoughnutSnapshot> {
    const map = new Map<string, CapaOpsDoughnutSnapshot>();
    for (const widget of board.widgets) {
      if (widget.type !== "chart") {
        continue;
      }
      const snapshot = widget.config.snapshot;
      if (!snapshot) {
        continue;
      }
      map.set(widget.id, snapshot);
    }
    return map;
  }

  merge(
    board: BoardModel,
    currentBoard: BoardModel,
    current: ReadonlyMap<string, CapaOpsDoughnutSnapshot>
  ): ReadonlyMap<string, CapaOpsDoughnutSnapshot> {
    const next = new Map<string, CapaOpsDoughnutSnapshot>();
    const currentWidgetsByID = new Map(
      currentBoard.widgets.map((widget) => [widget.id, widget] as const)
    );
    for (const widget of board.widgets) {
      if (widget.type !== "chart") {
        continue;
      }
      const fromBoard = widget.config.snapshot;
      if (fromBoard) {
        next.set(widget.id, fromBoard);
        continue;
      }
      const existing = current.get(widget.id);
      if (existing) {
        const currentWidget = currentWidgetsByID.get(widget.id);
        if (!this.hasSameBindingSignature(currentWidget, widget)) {
          continue;
        }
        next.set(widget.id, existing);
      }
    }
    return next;
  }

  private hasSameBindingSignature(
    currentWidget: BoardModel["widgets"][number] | undefined,
    incomingWidget: BoardModel["widgets"][number]
  ): boolean {
    if (!currentWidget || currentWidget.type !== "chart" || incomingWidget.type !== "chart") {
      return false;
    }
    const currentBinding = currentWidget.config.bindings?.[0];
    const incomingBinding = incomingWidget.config.bindings?.[0];
    return (
      this.bindingString(currentBinding?.dataSourceCode) ===
        this.bindingString(incomingBinding?.dataSourceCode) &&
      this.bindingString(currentBinding?.overlayHuid) ===
        this.bindingString(incomingBinding?.overlayHuid) &&
      this.bindingString(currentBinding?.unitHuid) ===
        this.bindingString(incomingBinding?.unitHuid) &&
      this.bindingString(currentBinding?.variablesMapping?.["overlayHuid"]) ===
        this.bindingString(incomingBinding?.variablesMapping?.["overlayHuid"]) &&
      this.bindingString(currentBinding?.variablesMapping?.["unitHuid"]) ===
        this.bindingString(incomingBinding?.variablesMapping?.["unitHuid"])
    );
  }

  private bindingString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
  }
}
