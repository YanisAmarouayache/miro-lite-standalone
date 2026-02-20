export interface LayerListContextMenuEvent {
  widgetId: string;
  event: MouseEvent;
}

export interface LayerReorderEvent {
  sourceWidgetId: string;
  targetWidgetId: string;
}
