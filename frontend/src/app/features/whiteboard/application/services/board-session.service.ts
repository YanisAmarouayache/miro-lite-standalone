import { Injectable } from "@angular/core";
import { Subscription } from "rxjs";
import { BoardModel } from "../../domain/board.model";
import { BoardRepositoryPort } from "../../domain/ports/board-repository.port";

interface BoardSessionCallbacks {
  errorMessage: (error: unknown, fallback: string) => string;
  onLoadSuccess: (board: BoardModel) => void;
  onLoadError: (message: string) => void;
  onSubscriptionBoard: (board: BoardModel) => void;
  onSubscriptionError: (message: string) => void;
}

@Injectable()
export class BoardSessionService {
  private currentBoardId = "";
  private loadRequestId = 0;
  private boardSubscription?: Subscription;

  getCurrentBoardId(): string {
    return this.currentBoardId;
  }

  begin(
    repo: BoardRepositoryPort,
    boardId: string,
    callbacks: BoardSessionCallbacks
  ): void {
    this.boardSubscription?.unsubscribe();
    this.boardSubscription = undefined;
    this.currentBoardId = boardId;
    this.load(repo, boardId, callbacks);
  }

  reload(repo: BoardRepositoryPort, callbacks: BoardSessionCallbacks): void {
    if (!this.currentBoardId) {
      return;
    }
    this.load(repo, this.currentBoardId, callbacks);
  }

  destroy(): void {
    this.boardSubscription?.unsubscribe();
    this.boardSubscription = undefined;
    this.currentBoardId = "";
    this.loadRequestId++;
  }

  private load(
    repo: BoardRepositoryPort,
    boardId: string,
    callbacks: BoardSessionCallbacks
  ): void {
    const requestId = ++this.loadRequestId;
    repo.load(boardId).subscribe({
      next: (board) => {
        if (requestId !== this.loadRequestId || boardId !== this.currentBoardId) {
          return;
        }
        callbacks.onLoadSuccess(board);
        this.startSubscription(repo, boardId, callbacks);
      },
      error: (error) => {
        if (requestId !== this.loadRequestId || boardId !== this.currentBoardId) {
          return;
        }
        callbacks.onLoadError(
          callbacks.errorMessage(error, "Unable to load board")
        );
      },
    });
  }

  private startSubscription(
    repo: BoardRepositoryPort,
    boardId: string,
    callbacks: BoardSessionCallbacks
  ): void {
    this.boardSubscription?.unsubscribe();
    this.boardSubscription = repo.subscribe(boardId).subscribe({
      next: (board) => {
        if (boardId !== this.currentBoardId) {
          return;
        }
        callbacks.onSubscriptionBoard(board);
      },
      error: (error) => {
        if (boardId !== this.currentBoardId) {
          return;
        }
        callbacks.onSubscriptionError(
          callbacks.errorMessage(error, "Realtime connection error")
        );
      },
    });
  }
}
