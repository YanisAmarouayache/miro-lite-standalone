import {
  ChartWidgetConfig,
  CounterWidgetConfig,
  ImageWidgetConfig,
  WidgetDataBindingConfig,
  WidgetModel,
  getDefaultWidgetConfig,
} from "./board.model";

type TextWidget = Extract<WidgetModel, { type: "text" | "textarea" }>;
type ChartWidget = Extract<WidgetModel, { type: "chart" }>;
type CounterWidget = Extract<WidgetModel, { type: "counter" }>;
type ImageWidget = Extract<WidgetModel, { type: "image" }>;

const DEFAULT_CHART = getDefaultWidgetConfig("chart") as ChartWidgetConfig;
const DEFAULT_COUNTER = getDefaultWidgetConfig("counter") as CounterWidgetConfig;
const DEFAULT_IMAGE = getDefaultWidgetConfig("image") as ImageWidgetConfig;

export function isTextWidget(widget: WidgetModel): widget is TextWidget {
  return widget.type === "text" || widget.type === "textarea";
}

export function isChartWidget(widget: WidgetModel): widget is ChartWidget {
  return widget.type === "chart";
}

export function isCounterWidget(widget: WidgetModel): widget is CounterWidget {
  return widget.type === "counter";
}

export function isImageWidget(widget: WidgetModel): widget is ImageWidget {
  return widget.type === "image";
}

export function getWidgetText(widget: WidgetModel): string {
  switch (widget.type) {
    case "text":
    case "textarea":
      return widget.config.text;
    default:
      return "";
  }
}

export function getChartType(widget: WidgetModel): string {
  return widget.type === "chart" ? widget.config.chartType : DEFAULT_CHART.chartType;
}

export function getChartDataSourceCode(widget: WidgetModel): string {
  return widget.type === "chart" ? getPrimaryBinding(widget)?.dataSourceCode ?? "" : "";
}

export function getChartOverlayHuid(widget: WidgetModel): string {
  return widget.type === "chart" ? getPrimaryBinding(widget)?.overlayHuid ?? "" : "";
}

export function getChartUnitHuid(widget: WidgetModel): string {
  return widget.type === "chart" ? getPrimaryBinding(widget)?.unitHuid ?? "" : "";
}

export function getCounterLabel(widget: WidgetModel): string {
  return widget.type === "counter" ? widget.config.label : DEFAULT_COUNTER.label;
}

export function getCounterValue(widget: WidgetModel): number {
  return widget.type === "counter" ? widget.config.value : DEFAULT_COUNTER.value;
}

export function getImageSrc(widget: WidgetModel): string {
  return widget.type === "image" ? widget.config.src : "";
}

export function getImageAlt(widget: WidgetModel): string {
  return widget.type === "image" ? widget.config.alt : DEFAULT_IMAGE.alt;
}

function getPrimaryBinding(
  widget: ChartWidget
): WidgetDataBindingConfig | undefined {
  return widget.config.bindings?.[0];
}
