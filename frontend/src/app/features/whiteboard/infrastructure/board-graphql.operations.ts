import { gql } from "apollo-angular";

export const GET_BOARD = gql`
  query GetBoard($id: ID!) {
    board(id: $id) {
      id
      version
      widgets {
        id
        type
        x
        y
        width
        height
        configJson
      }
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

export const BOARD_UPDATED_SUBSCRIPTION = gql`
  subscription BoardUpdated($boardId: ID!) {
    boardUpdated(boardId: $boardId) {
      id
      version
      widgets {
        id
        type
        x
        y
        width
        height
        configJson
      }
    }
  }
`;
