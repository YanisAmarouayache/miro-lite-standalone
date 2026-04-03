import { Injectable, inject } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { DataSourceDefinitionModel } from "../../domain/datasource-definition.model";
import { BoardRepositoryPort } from "../../domain/ports/board-repository.port";
import { BoardSyncService } from "./board-sync.service";

@Injectable({ providedIn: "root" })
export class DataSourceDefinitionsService {
  private readonly boardSync = inject(BoardSyncService);
  private readonly definitionsSubject = new BehaviorSubject<
    DataSourceDefinitionModel[]
  >([]);
  private loadRequestId = 0;

  readonly definitions$ = this.definitionsSubject.asObservable();

  reset(): void {
    this.loadRequestId++;
    this.definitionsSubject.next([]);
  }

  load(
    repo: BoardRepositoryPort,
    onLoadError: (message: string) => void
  ): void {
    const requestId = ++this.loadRequestId;
    repo.listDataSourceDefinitions().subscribe({
      next: (definitions) => {
        if (requestId !== this.loadRequestId) {
          return;
        }
        this.definitionsSubject.next(definitions);
      },
      error: (error) => {
        if (requestId !== this.loadRequestId) {
          return;
        }
        onLoadError(
          this.boardSync.errorMessage(error, "Unable to load data source definitions")
        );
      },
    });
  }

  getByCode(code: string): DataSourceDefinitionModel | undefined {
    return this.definitionsSubject.value.find(
      (definition) => definition.code === code
    );
  }
}
