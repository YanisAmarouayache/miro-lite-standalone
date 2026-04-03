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
import { CapaOpsDoughnutSnapshot } from "../domain/capaops.model";

export interface GqlWidgetPayload {
  id?: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number | null;
  height?: number | null;
  configJson?: string;
  widgetBindingJson?: string | null;
  latestSnapshotJson?: string | null;
}

export interface GqlWidgetInput {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  width: number;
  height: number;
  configJson: string;
  widgetBindingJson?: string;
}

const DEFAULT_WIDGET_TYPE: WidgetType = "textarea";
const DEFAULT_WIDGET_WIDTH = 200;
const DEFAULT_WIDGET_HEIGHT = 150;
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
  const configRecord = parseConfigRecord(item.configJson);
  const bindingRecords = parseBindingRecords(item.widgetBindingJson);
  if (bindingRecords.length > 0) {
    configRecord["bindings"] = bindingRecords;
  }
  if (type === "chart") {
    const snapshot = parseLatestWidgetSnapshot(item.latestSnapshotJson);
    if (snapshot) {
      configRecord["snapshot"] = snapshot;
    }
  }
  const config = normalizeWidgetConfig(type, configRecord);
  const base = {
    id: item.id ?? crypto.randomUUID(),
    x: item.x ?? 0,
    y: item.y ?? 0,
    width: item.width ?? DEFAULT_WIDGET_WIDTH,
    height: item.height ?? DEFAULT_WIDGET_HEIGHT,
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
  const configRecord = widgetConfigRecord(widget.config);
  if (widget.type === "chart") {
    delete configRecord["snapshot"];
  }
  let widgetBindingJson: string | undefined;
  if (
    widget.type === "chart" &&
    Array.isArray(configRecord["bindings"])
  ) {
    const bindings = configRecord["bindings"].filter(
      (item) =>
        item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        typeof (item as Record<string, unknown>)["dataSourceCode"] === "string" &&
        String((item as Record<string, unknown>)["dataSourceCode"]).trim() !== ""
    );
    widgetBindingJson = JSON.stringify(bindings);
    delete configRecord["bindings"];
  }
  return {
    id: widget.id,
    type: widget.type,
    x: widget.x,
    y: widget.y,
    width: widget.width,
    height: widget.height,
    configJson: JSON.stringify(configRecord),
    widgetBindingJson,
  };
}

function parseLatestWidgetSnapshot(
  raw?: string | null
): CapaOpsDoughnutSnapshot | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as { normalizedValue?: unknown };
    if (!parsed || typeof parsed !== "object") return null;
    return parseCapaOpsDoughnutSnapshotValue(parsed.normalizedValue);
  } catch {
    return null;
  }
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

function parseBindingRecords(raw?: string | null): Record<string, unknown>[] {
  if (typeof raw !== "string") return [];
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "{}" || trimmed === "[]") return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is Record<string, unknown> =>
        !!item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        typeof item["dataSourceCode"] === "string" &&
        String(item["dataSourceCode"]).trim() !== ""
    );
  } catch {
    return [];
  }
}

export function parseCapaOpsDoughnutSnapshot(
  raw: string
): CapaOpsDoughnutSnapshot | null {
  try {
    return parseCapaOpsDoughnutSnapshotValue(JSON.parse(raw));
  } catch {
    return null;
  }
}

function parseCapaOpsDoughnutSnapshotValue(
  value: unknown
): CapaOpsDoughnutSnapshot | null {
  const normalized = normalizeWidgetConfig("chart", {
    snapshot: value,
  }) as ChartWidgetConfig;
  return normalized.snapshot ?? null;
}
