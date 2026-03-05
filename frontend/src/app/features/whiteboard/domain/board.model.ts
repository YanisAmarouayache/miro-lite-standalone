import { CapaOpsDoughnutSnapshot } from "./capaops.model";

export type WidgetType = 'chart' | 'table' | 'counter' | 'text' | 'image' | 'textarea';

export interface WidgetDataBindingConfig {
  dataSourceCode: string;
  overlayHuid?: string;
  unitHuid?: string;
  variablesMapping?: Record<string, unknown>;
  fieldMapping?: Record<string, unknown>;
  displayRules?: Record<string, unknown>;
}

export interface ChartWidgetConfig {
  chartType: string;
  bindings?: WidgetDataBindingConfig[];
  snapshot?: CapaOpsDoughnutSnapshot;
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
  title: string;
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
  return cloneWidgetConfig(config);
}

export function normalizeWidgetConfig(
  type: WidgetType,
  raw: Record<string, unknown> | null | undefined
): WidgetConfig {
  const input = raw ?? {};
  switch (type) {
    case "chart": {
      const defaults = getDefaultWidgetConfig("chart") as ChartWidgetConfig;
      const rawBindings = Array.isArray(input["bindings"]) ? input["bindings"] : [];
      const bindings = rawBindings
        .filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item))
        .map((rawBinding) => {
          const dataSourceCode =
            typeof rawBinding["dataSourceCode"] === "string"
              ? rawBinding["dataSourceCode"].trim()
              : "";
          const variablesMapping =
            rawBinding["variablesMapping"] &&
            typeof rawBinding["variablesMapping"] === "object" &&
            !Array.isArray(rawBinding["variablesMapping"])
              ? cloneRecord(rawBinding["variablesMapping"] as Record<string, unknown>)
              : undefined;
          const unitHuid =
            typeof rawBinding["unitHuid"] === "string"
              ? rawBinding["unitHuid"].trim()
              : typeof variablesMapping?.["unitHuid"] === "string"
                ? String(variablesMapping["unitHuid"]).trim()
                : "";
          const overlayHuid =
            typeof rawBinding["overlayHuid"] === "string"
              ? rawBinding["overlayHuid"].trim()
              : typeof variablesMapping?.["overlayHuid"] === "string"
                ? String(variablesMapping["overlayHuid"]).trim()
                : "";
          const fieldMapping =
            rawBinding["fieldMapping"] &&
            typeof rawBinding["fieldMapping"] === "object" &&
            !Array.isArray(rawBinding["fieldMapping"])
              ? cloneRecord(rawBinding["fieldMapping"] as Record<string, unknown>)
              : undefined;
          const displayRules =
            rawBinding["displayRules"] &&
            typeof rawBinding["displayRules"] === "object" &&
            !Array.isArray(rawBinding["displayRules"])
              ? cloneRecord(rawBinding["displayRules"] as Record<string, unknown>)
              : undefined;
          return {
            dataSourceCode,
            overlayHuid,
            unitHuid,
            variablesMapping,
            fieldMapping,
            displayRules,
          };
        })
        .filter((binding) => !!binding.dataSourceCode || !!binding.overlayHuid || !!binding.unitHuid);
      const rawSnapshot = input["snapshot"];
      const snapshot = isCapaOpsDoughnutSnapshot(rawSnapshot)
        ? cloneSnapshot(rawSnapshot)
        : undefined;

      return {
        chartType:
          typeof input["chartType"] === "string"
            ? input["chartType"]
            : defaults.chartType,
        bindings: bindings.length > 0 ? cloneBindings(bindings) : undefined,
        snapshot,
      };
    }
    case "table": {
      const defaults = getDefaultWidgetConfig("table") as TableWidgetConfig;
      return {
        rows: cloneRows(Array.isArray(input["rows"]) ? input["rows"] : defaults.rows),
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
  if ("chartType" in config) {
    const chart = config as ChartWidgetConfig;
    return {
      chartType: chart.chartType,
      bindings: chart.bindings ? cloneBindings(chart.bindings) : undefined,
      snapshot: chart.snapshot ? cloneSnapshot(chart.snapshot) : undefined,
    };
  }
  if ("rows" in config) {
    const table = config as TableWidgetConfig;
    return { rows: cloneRows(table.rows) };
  }
  return { ...config };
}

function cloneWidgetConfig(config: WidgetConfig): WidgetConfig {
  if ("chartType" in config) {
    const chart = config as ChartWidgetConfig;
    return {
      chartType: chart.chartType,
      bindings: chart.bindings ? cloneBindings(chart.bindings) : undefined,
      snapshot: chart.snapshot ? cloneSnapshot(chart.snapshot) : undefined,
    };
  }
  if ("rows" in config) {
    const table = config as TableWidgetConfig;
    return { rows: cloneRows(table.rows) };
  }
  return { ...config };
}

function cloneBindings(
  bindings: WidgetDataBindingConfig[]
): WidgetDataBindingConfig[] {
  return bindings.map((binding) => ({
    dataSourceCode: binding.dataSourceCode,
    overlayHuid: binding.overlayHuid,
    unitHuid: binding.unitHuid,
    variablesMapping: binding.variablesMapping
      ? cloneRecord(binding.variablesMapping)
      : undefined,
    fieldMapping: binding.fieldMapping ? cloneRecord(binding.fieldMapping) : undefined,
    displayRules: binding.displayRules ? cloneRecord(binding.displayRules) : undefined,
  }));
}

function cloneRows(rows: unknown[]): unknown[] {
  return rows.map((row) => cloneUnknown(row));
}

function cloneSnapshot(snapshot: CapaOpsDoughnutSnapshot): CapaOpsDoughnutSnapshot {
  return {
    quarters: snapshot.quarters.map((quarter) => ({
      key: quarter.key,
      value: quarter.value,
    })),
    center: {
      operationalStatusCode: snapshot.center.operationalStatusCode ?? null,
    },
  };
}

function cloneRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, cloneUnknown(value)])
  );
}

function cloneUnknown<T>(value: T): T {
  if (!value || typeof value !== "object") {
    return value;
  }
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

function isCapaOpsDoughnutSnapshot(value: unknown): value is CapaOpsDoughnutSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw["quarters"])) {
    return false;
  }
  const quartersValid = raw["quarters"].every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return false;
    }
    const quarter = item as Record<string, unknown>;
    return (
      typeof quarter["key"] === "string" &&
      typeof quarter["value"] === "number" &&
      Number.isFinite(quarter["value"])
    );
  });
  if (!quartersValid) {
    return false;
  }
  const center = raw["center"];
  if (!center || typeof center !== "object" || Array.isArray(center)) {
    return false;
  }
  const status = (center as Record<string, unknown>)["operationalStatusCode"];
  return (
    status === undefined ||
    status === null ||
    typeof status === "string"
  );
}
