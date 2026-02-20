import { Component, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { map } from "rxjs";
import { toSignal } from "@angular/core/rxjs-interop";
import { WhiteboardComponent } from "./whiteboard.component";

@Component({
  selector: "whiteboard-page",
  standalone: true,
  imports: [WhiteboardComponent],
  template: `<whiteboard [boardId]="boardId()"></whiteboard>`,
  styles: `
    :host {
      display: block;
      height: 100vh;
    }
  `,
})
export class WhiteboardPageComponent {
  private readonly route = inject(ActivatedRoute);
  readonly boardId = toSignal(
    this.route.paramMap.pipe(
      map((params) => params.get("boardId") || "demo-board")
    ),
    { initialValue: "demo-board" }
  );
}
