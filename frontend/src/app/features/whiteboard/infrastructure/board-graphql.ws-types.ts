import { GqlWidgetPayload } from "./board-graphql.mapper";

type WsConnectionAckMessage = {
  type: "connection_ack";
};

type WsPingMessage = {
  type: "ping";
};

type WsNextMessage = {
  type: "next";
  id?: string;
  payload?: {
    data?: {
      boardUpdated?: {
        id?: string;
        version?: number;
        widgets?: GqlWidgetPayload[];
      };
    };
  };
};

type WsErrorMessage = {
  type: "error";
  id?: string;
};

type WsCompleteMessage = {
  type: "complete";
  id?: string;
};

export type WsMessage =
  | WsConnectionAckMessage
  | WsPingMessage
  | WsNextMessage
  | WsErrorMessage
  | WsCompleteMessage;

export function parseWsMessage(raw: unknown): WsMessage | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as { type?: string };
    if (!parsed || typeof parsed !== "object" || typeof parsed.type !== "string") {
      return null;
    }
    switch (parsed.type) {
      case "connection_ack":
      case "ping":
      case "next":
      case "error":
      case "complete":
        return parsed as WsMessage;
      default:
        return null;
    }
  } catch {
    return null;
  }
}
