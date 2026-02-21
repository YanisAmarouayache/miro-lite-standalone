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

export interface GqlWidgetInput {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  width: number;
  height: number;
  configJson: string;
}

const DEFAULT_WIDGET_TYPE: WidgetType = "textarea";
const VALID_WIDGET_TYPES = new Set<WidgetType>([
  "chart",
  "table",
  "counter",
  "text",
  "image",
  "textarea",
]);

export function payloadToWidget(item: GqlWidgetPayload): WidgetModel {
  const type = asWidgetType(item.type ?? DEFAULT_WIDGET_TYPE);
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

export function widgetToInput(widget: WidgetModel): GqlWidgetInput {
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
  if (VALID_WIDGET_TYPES.has(type as WidgetType)) {
    return type as WidgetType;
  }
  return DEFAULT_WIDGET_TYPE;
}

function parseConfigRecord(raw?: string): Record<string, unknown> {
  if (typeof raw !== "string") return {};
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}
