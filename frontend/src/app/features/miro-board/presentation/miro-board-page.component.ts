import { Component, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { map } from "rxjs";
import { toSignal } from "@angular/core/rxjs-interop";
import { MiroBoardComponent } from "./miro-board.component";

@Component({
  selector: "miro-board-page",
  standalone: true,
  imports: [MiroBoardComponent],
  template: `<miro-board [boardId]="boardId()"></miro-board>`,
})
export class MiroBoardPageComponent {
  private readonly route = inject(ActivatedRoute);
  readonly boardId = toSignal(
    this.route.paramMap.pipe(
      map((params) => params.get("boardId") || "demo-board")
    ),
    { initialValue: "demo-board" }
  );
}
