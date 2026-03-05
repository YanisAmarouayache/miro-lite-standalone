import { Injectable } from "@angular/core";
import { EMPTY, Observable, catchError, mapTo, tap } from "rxjs";
import { BoardModel } from "../../domain/board.model";
import { BoardRepositoryPort } from "../../domain/ports/board-repository.port";

@Injectable({ providedIn: "root" })
export class BoardSyncService {
  persistWithOptimisticConcurrency(
    repo: BoardRepositoryPort,
    localBoard: BoardModel,
    getCurrentBoard: () => BoardModel,
    onLocalVersionSynced: (version: number) => void,
    setSaveError: (message: string | null) => void,
    onVersionConflict: () => void
  ): Observable<void> {
    return repo.save(localBoard).pipe(
      tap((serverVersion) =>
        this.applySavedVersionIfCurrentBoard(
          getCurrentBoard,
          localBoard.id,
          serverVersion,
          onLocalVersionSynced,
          setSaveError
        )
      ),
      mapTo(void 0),
      catchError((e) => {
        if (this.isStaleBoardRequest(getCurrentBoard, localBoard.id)) {
          return EMPTY;
        }
        if (this.isVersionConflictError(e)) {
          setSaveError("Board version conflict. Reloading latest board...");
          onVersionConflict();
          return EMPTY;
        }
        return this.toSaveErrorAndComplete(e, setSaveError, "Save failed");
      })
    );
  }

  private applySavedVersionIfCurrentBoard(
    getCurrentBoard: () => BoardModel,
    expectedBoardId: string,
    savedVersion: number,
    onLocalVersionSynced: (version: number) => void,
    setSaveError: (message: string | null) => void
  ): void {
    const current = getCurrentBoard();
    if (current.id !== expectedBoardId) {
      return;
    }

    onLocalVersionSynced(Math.max(current.version, savedVersion));
    setSaveError(null);
  }

  private toSaveErrorAndComplete(
    error: unknown,
    setSaveError: (message: string | null) => void,
    fallback: string
  ): Observable<never> {
    setSaveError(this.errorMessage(error, fallback));
    return EMPTY;
  }

  errorMessage(error: unknown, fallback: string): string {
    const asAny = error as any;
    return (
      asAny?.message ||
      asAny?.error?.message ||
      asAny?.networkError?.result?.errors?.[0]?.message ||
      fallback
    );
  }

  private isVersionConflictError(error: unknown): boolean {
    const asAny = error as any;
    if (asAny?.name === "VersionConflictError") return true;
    const message = this.errorMessage(error, "");
    if (message.toLowerCase().includes("version conflict")) return true;

    return asAny?.status === 409 || asAny?.networkError?.statusCode === 409;
  }

  private isStaleBoardRequest(
    getCurrentBoard: () => BoardModel,
    expectedBoardId: string
  ): boolean {
    const current = getCurrentBoard();
    return current.id !== expectedBoardId;
  }
}
