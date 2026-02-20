export interface ContextMenuState {
  widgetId: string;
  x: number;
  y: number;
}

export type ContextMenuAction =
  | "bring_to_front"
  | "bring_forward"
  | "send_backward"
  | "send_to_back"
  | "remove";

export interface ContextMenuActionEvent {
  widgetId: string;
  action: ContextMenuAction;
}
