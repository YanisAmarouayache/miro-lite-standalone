export type WidgetType = 'chart' | 'table' | 'counter' | 'text' | 'image' | 'textarea';

export interface ChartWidgetConfig {
  chartType: string;
}

export interface TableWidgetConfig {
  rows: unknown[];
}

export interface CounterWidgetConfig {
  value: number;
  label: string;
}

export interface TextWidgetConfig {
  text: string;
}

export interface ImageWidgetConfig {
  src: string;
  alt: string;
}

export interface TextareaWidgetConfig {
  text: string;
}

export type WidgetConfig =
  | ChartWidgetConfig
  | TableWidgetConfig
  | CounterWidgetConfig
  | TextWidgetConfig
  | ImageWidgetConfig
  | TextareaWidgetConfig;

interface WidgetBase<TType extends WidgetType, TConfig extends WidgetConfig> {
  id: string;
  type: TType;
  x: number;
  y: number;
  width: number;
  height: number;
  config: TConfig;
}

export type WidgetModel =
  | WidgetBase<"chart", ChartWidgetConfig>
  | WidgetBase<"table", TableWidgetConfig>
  | WidgetBase<"counter", CounterWidgetConfig>
  | WidgetBase<"text", TextWidgetConfig>
  | WidgetBase<"image", ImageWidgetConfig>
  | WidgetBase<"textarea", TextareaWidgetConfig>;

export interface BoardModel {
  id: string;
  version: number;
  widgets: WidgetModel[];
}

export function defaultWidgetConfig(type: WidgetType): WidgetConfig {
  switch (type) {
    case "chart":
      return { chartType: "pie" };
    case "table":
      return { rows: [] };
    case "counter":
      return { value: 0, label: "Metric" };
    case "text":
      return { text: "Yellow box" };
    case "image":
      return { src: "", alt: "Imported image" };
    case "textarea":
      return { text: "" };
  }
}

export function normalizeWidgetConfig(
  type: WidgetType,
  raw: Record<string, unknown> | null | undefined
): WidgetConfig {
  const input = raw ?? {};
  switch (type) {
    case "chart":
      return {
        chartType:
          typeof input["chartType"] === "string" ? input["chartType"] : "pie",
      };
    case "table":
      return {
        rows: Array.isArray(input["rows"]) ? input["rows"] : [],
      };
    case "counter":
      return {
        value: typeof input["value"] === "number" ? input["value"] : 0,
        label: typeof input["label"] === "string" ? input["label"] : "Metric",
      };
    case "text":
      return {
        text: typeof input["text"] === "string" ? input["text"] : "Yellow box",
      };
    case "image":
      return {
        src: typeof input["src"] === "string" ? input["src"] : "",
        alt:
          typeof input["alt"] === "string" ? input["alt"] : "Imported image",
      };
    case "textarea":
      return {
        text: typeof input["text"] === "string" ? input["text"] : "",
      };
  }
}

export function widgetConfigRecord(config: WidgetConfig): Record<string, unknown> {
  return { ...config };
}
