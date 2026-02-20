import {
  ChartWidgetConfig,
  CounterWidgetConfig,
  ImageWidgetConfig,
  TableWidgetConfig,
  TextWidgetConfig,
  TextareaWidgetConfig,
  WidgetModel,
  WidgetType,
  normalizeWidgetConfig,
  widgetConfigRecord,
} from "../domain/board.model";

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
  const type = asWidgetType(item.type ?? "textarea");
  const config = normalizeWidgetConfig(type, parseConfigRecord(item.configJson));
  const base = {
    id: item.id ?? crypto.randomUUID(),
    x: item.x ?? 0,
    y: item.y ?? 0,
    width: item.width ?? 200,
    height: item.height ?? 150,
  };
  switch (type) {
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

export function widgetToInput(widget: WidgetModel) {
  return {
    id: widget.id,
    type: widget.type,
    x: widget.x,
    y: widget.y,
    width: widget.width,
    height: widget.height,
    configJson: JSON.stringify(widgetConfigRecord(widget.config)),
  };
}

function asWidgetType(type: string): WidgetType {
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

function parseConfigRecord(raw?: string): Record<string, unknown> {
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
