import { WidgetModel } from "../domain/board.model";

export interface GqlWidgetPayload {
  id?: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number | null;
  height?: number | null;
  configJson?: string;
}

export function payloadToWidget(item: GqlWidgetPayload): WidgetModel {
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

export function widgetToInput(widget: WidgetModel) {
  return {
    id: widget.id,
    type: widget.type,
    x: widget.x,
    y: widget.y,
    width: widget.width,
    height: widget.height,
    configJson: JSON.stringify(widget.config ?? {}),
  };
}

function asWidgetType(type: string): WidgetModel["type"] {
  if (
    type === "chart" ||
    type === "table" ||
    type === "counter" ||
    type === "text" ||
    type === "image" ||
    type === "textarea"
  ) {
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
