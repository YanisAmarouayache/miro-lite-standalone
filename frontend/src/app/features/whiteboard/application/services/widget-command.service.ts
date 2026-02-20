import { Injectable } from "@angular/core";
import { BoardModel, WidgetModel } from "../../domain/board.model";
import { WidgetDefinition } from "../../domain/widget-definition.model";

@Injectable({ providedIn: "root" })
export class WidgetCommandService {
  addWidget(board: BoardModel, definition: WidgetDefinition): BoardModel {
    const widget: WidgetModel = {
      id: crypto.randomUUID(),
      type: definition.type,
      x: 120 + board.widgets.length * 20,
      y: 120 + board.widgets.length * 20,
      width: definition.defaultWidth,
      height: definition.defaultHeight,
      config: { ...definition.defaultConfig },
    };
    return { ...board, widgets: [...board.widgets, widget] };
  }

  addWidgetAt(
    board: BoardModel,
    definition: WidgetDefinition,
    x: number,
    y: number
  ): BoardModel {
    const widget: WidgetModel = {
      id: crypto.randomUUID(),
      type: definition.type,
      x: Math.max(0, x - definition.defaultWidth / 2),
      y: Math.max(0, y - definition.defaultHeight / 2),
      width: definition.defaultWidth,
      height: definition.defaultHeight,
      config: { ...definition.defaultConfig },
    };
    return { ...board, widgets: [...board.widgets, widget] };
  }

  setWidgetFrame(
    board: BoardModel,
    id: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): BoardModel {
    return {
      ...board,
      widgets: board.widgets.map((w) =>
        w.id === id ? { ...w, x, y, width, height } : w
      ),
    };
  }

  updateConfig(
    board: BoardModel,
    id: string,
    partialConfig: Record<string, unknown>
  ): BoardModel {
    return {
      ...board,
      widgets: board.widgets.map((w) =>
        w.id === id
          ? {
              ...w,
              config: { ...(w.config ?? {}), ...partialConfig },
            }
          : w
      ),
    };
  }

  remove(board: BoardModel, id: string): BoardModel {
    return {
      ...board,
      widgets: board.widgets.filter((w) => w.id !== id),
    };
  }

  bringToFront(board: BoardModel, id: string): BoardModel {
    const index = board.widgets.findIndex((widget) => widget.id === id);
    if (index < 0 || index === board.widgets.length - 1) return board;
    const next = [...board.widgets];
    const [widget] = next.splice(index, 1);
    next.push(widget);
    return { ...board, widgets: next };
  }

  sendToBack(board: BoardModel, id: string): BoardModel {
    const index = board.widgets.findIndex((widget) => widget.id === id);
    if (index <= 0) return board;
    const next = [...board.widgets];
    const [widget] = next.splice(index, 1);
    next.unshift(widget);
    return { ...board, widgets: next };
  }

  reorder(board: BoardModel, id: string, direction: 1 | -1): BoardModel {
    const index = board.widgets.findIndex((widget) => widget.id === id);
    if (index < 0) return board;
    const target = index + direction;
    if (target < 0 || target >= board.widgets.length) return board;
    const next = [...board.widgets];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    return { ...board, widgets: next };
  }

  moveWidgetAbove(
    board: BoardModel,
    sourceId: string,
    targetId: string
  ): BoardModel {
    if (sourceId === targetId) return board;
    const sourceIndex = board.widgets.findIndex((widget) => widget.id === sourceId);
    const targetIndex = board.widgets.findIndex((widget) => widget.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return board;
    const next = [...board.widgets];
    const [source] = next.splice(sourceIndex, 1);
    const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    const insertIndex = Math.min(next.length, adjustedTargetIndex + 1);
    next.splice(insertIndex, 0, source);
    return { ...board, widgets: next };
  }
}
