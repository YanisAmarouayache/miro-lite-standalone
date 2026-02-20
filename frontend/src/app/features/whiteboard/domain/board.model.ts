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

const WIDGET_CONFIG_DEFAULTS = {
  chart: { chartType: "pie" } as ChartWidgetConfig,
  table: { rows: [] } as TableWidgetConfig,
  counter: { value: 0, label: "Metric" } as CounterWidgetConfig,
  text: { text: "Yellow box" } as TextWidgetConfig,
  image: { src: "", alt: "Imported image" } as ImageWidgetConfig,
  textarea: { text: "" } as TextareaWidgetConfig,
} satisfies Record<WidgetType, WidgetConfig>;

export function getDefaultWidgetConfig(type: WidgetType): WidgetConfig {
  const config = WIDGET_CONFIG_DEFAULTS[type];
  return { ...config };
}

export function normalizeWidgetConfig(
  type: WidgetType,
  raw: Record<string, unknown> | null | undefined
): WidgetConfig {
  const input = raw ?? {};
  switch (type) {
    case "chart": {
      const defaults = getDefaultWidgetConfig("chart") as ChartWidgetConfig;
      return {
        chartType:
          typeof input["chartType"] === "string"
            ? input["chartType"]
            : defaults.chartType,
      };
    }
    case "table": {
      const defaults = getDefaultWidgetConfig("table") as TableWidgetConfig;
      return {
        rows: Array.isArray(input["rows"]) ? input["rows"] : defaults.rows,
      };
    }
    case "counter": {
      const defaults = getDefaultWidgetConfig("counter") as CounterWidgetConfig;
      return {
        value: typeof input["value"] === "number" ? input["value"] : defaults.value,
        label: typeof input["label"] === "string" ? input["label"] : defaults.label,
      };
    }
    case "text": {
      const defaults = getDefaultWidgetConfig("text") as TextWidgetConfig;
      return {
        text: typeof input["text"] === "string" ? input["text"] : defaults.text,
      };
    }
    case "image": {
      const defaults = getDefaultWidgetConfig("image") as ImageWidgetConfig;
      return {
        src: typeof input["src"] === "string" ? input["src"] : defaults.src,
        alt: typeof input["alt"] === "string" ? input["alt"] : defaults.alt,
      };
    }
    case "textarea": {
      const defaults = getDefaultWidgetConfig("textarea") as TextareaWidgetConfig;
      return {
        text: typeof input["text"] === "string" ? input["text"] : defaults.text,
      };
    }
  }
}

export function widgetConfigRecord(config: WidgetConfig): Record<string, unknown> {
  return { ...config };
}
