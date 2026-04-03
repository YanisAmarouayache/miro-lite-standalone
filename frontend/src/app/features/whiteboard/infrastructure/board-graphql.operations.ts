import { gql } from "apollo-angular";

export const GET_BOARD = gql`
  query GetBoard($id: ID!) {
    board(id: $id) {
      id
      title
      version
      widgets {
        id
        type
        x
        y
        width
        height
        configJson
        widgetBindingJson
        latestSnapshotJson
      }
    }
  }
`;

export const GET_DATA_SOURCE_DEFINITIONS = gql`
  query GetDataSourceDefinitions {
    dataSourceDefinitions {
      id
      code
      version
      protocol
      operationName
      request
      variablesSchemaJson
      resultSchemaJson
    }
  }
`;

export const GET_ACCESSIBLE_OVERLAYS = gql`
  query GetAccessibleOverlays($userHuid: String!) {
    accessibleOverlays(userHuid: $userHuid) {
      huid
      name
      kind
      type
      owner
      locked
      scope
      isDefault
    }
  }
`;

export const GET_OVERLAY_UNITS = gql`
  query OverlayUnits($overlayHuid: String!) {
    overlayUnits(overlayHuid: $overlayHuid) {
      huid
      name
    }
  }
`;

export const SAVE_BOARD = gql`
  mutation SaveBoard($boardId: ID!, $version: Int!, $widgets: [WidgetInput!]!) {
    saveBoard(boardId: $boardId, version: $version, widgets: $widgets) {
      id
      version
    }
  }
`;

export const FETCH_WIDGET_SNAPSHOT = gql`
  mutation FetchWidgetSnapshot($boardId: ID!, $widgetId: ID!) {
    fetchWidgetSnapshot(boardId: $boardId, widgetId: $widgetId) {
      widgetId
      dataSourceCode
      normalizedValueJson
      updatedAt
    }
  }
`;

export const BOARD_UPDATED_SUBSCRIPTION = gql`
  subscription BoardUpdated($boardId: ID!) {
    boardUpdated(boardId: $boardId) {
      id
      title
      version
      widgets {
        id
        type
        x
        y
        width
        height
        configJson
        widgetBindingJson
        latestSnapshotJson
      }
    }
  }
`;
