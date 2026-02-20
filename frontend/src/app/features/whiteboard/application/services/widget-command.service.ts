import { Injectable } from "@angular/core";
import {
  BoardModel,
  ChartWidgetConfig,
  CounterWidgetConfig,
  ImageWidgetConfig,
  TableWidgetConfig,
  TextWidgetConfig,
  TextareaWidgetConfig,
  WidgetModel,
  normalizeWidgetConfig,
} from "../../domain/board.model";
import { WidgetDefinition } from "../../domain/widget-definition.model";

@Injectable({ providedIn: "root" })
export class WidgetCommandService {
  addWidget(board: BoardModel, definition: WidgetDefinition): BoardModel {
    const widget = this.createWidget(
      definition,
      120 + board.widgets.length * 20,
      120 + board.widgets.length * 20
    );
    return { ...board, widgets: [...board.widgets, widget] };
  }

  addWidgetAt(
    board: BoardModel,
    definition: WidgetDefinition,
    x: number,
    y: number
  ): BoardModel {
    const widget = this.createWidget(
      definition,
      Math.max(0, x - definition.defaultWidth / 2),
      Math.max(0, y - definition.defaultHeight / 2)
    );
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
        w.id === id ? this.mergeWidgetConfig(w, partialConfig) : w
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

  private createWidget(
    definition: WidgetDefinition,
    x: number,
    y: number
  ): WidgetModel {
    const config = normalizeWidgetConfig(
      definition.type,
      definition.defaultConfig as unknown as Record<string, unknown>
    );
    const base = {
      id: crypto.randomUUID(),
      x,
      y,
      width: definition.defaultWidth,
      height: definition.defaultHeight,
    };
    switch (definition.type) {
      case "chart":
        return { ...base, type: "chart", config: config as ChartWidgetConfig };
      case "table":
        return { ...base, type: "table", config: config as TableWidgetConfig };
      case "counter":
        return { ...base, type: "counter", config: config as CounterWidgetConfig };
      case "text":
        return { ...base, type: "text", config: config as TextWidgetConfig };
      case "image":
        return { ...base, type: "image", config: config as ImageWidgetConfig };
      case "textarea":
        return { ...base, type: "textarea", config: config as TextareaWidgetConfig };
    }
  }

  private mergeWidgetConfig(
    widget: WidgetModel,
    partialConfig: Record<string, unknown>
  ): WidgetModel {
    const mergedConfig = normalizeWidgetConfig(widget.type, {
      ...(widget.config as unknown as Record<string, unknown>),
      ...partialConfig,
    });

    switch (widget.type) {
      case "chart":
        return { ...widget, config: mergedConfig as ChartWidgetConfig };
      case "table":
        return { ...widget, config: mergedConfig as TableWidgetConfig };
      case "counter":
        return { ...widget, config: mergedConfig as CounterWidgetConfig };
      case "text":
        return { ...widget, config: mergedConfig as TextWidgetConfig };
      case "image":
        return { ...widget, config: mergedConfig as ImageWidgetConfig };
      case "textarea":
        return { ...widget, config: mergedConfig as TextareaWidgetConfig };
    }
  }
}
