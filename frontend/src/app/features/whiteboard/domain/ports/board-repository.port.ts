import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import { BoardModel } from "../board.model";

export interface BoardRepositoryPort {
  load(boardId: string): Observable<BoardModel>;
  save(board: BoardModel): Observable<number>;
  subscribe(boardId: string): Observable<BoardModel>;
}

export const BOARD_REPOSITORY = new InjectionToken<BoardRepositoryPort>(
  "BOARD_REPOSITORY"
);
