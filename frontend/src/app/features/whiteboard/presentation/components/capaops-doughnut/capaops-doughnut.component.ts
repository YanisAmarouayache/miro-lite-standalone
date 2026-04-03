import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { CapaOpsDoughnutSnapshot } from "../../../domain/capaops.model";

@Component({
  selector: "app-capaops-doughnut",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./capaops-doughnut.component.html",
  styleUrl: "./capaops-doughnut.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CapaopsDoughnutComponent {
  @Input({ required: true }) snapshot!: CapaOpsDoughnutSnapshot;

  centerStyleColor(): string {
    const status = this.snapshot?.center.operationalStatusCode;
    switch (status) {
      case "FULLY_OPERATIONAL":
        return "#34a853";
      case "DAMAGED":
        return "#f29900";
      case "DESTROYED":
        return "#d93025";
      case "UNDER_CONSTRUCTION":
        return "#9aa0a6";
      default:
        return "#9aa0a6";
    }
  }

  centerLabel(): string {
    const status = this.snapshot?.center.operationalStatusCode;
    if (!status) return "UNKNOWN";
    return status.replaceAll("_", " ");
  }

  quarterValue(index: number): number {
    const value = this.snapshot?.quarters[index]?.value;
    if (!Number.isFinite(value)) return 0;
    return Math.round((value ?? 0) * 10) / 10;
  }

  quarterTags(): ReadonlyArray<{ x: number; y: number; label: string; angle: number }> {
    const cx = 50;
    const cy = 50;
    const outerR = 48;
    const innerR = 27;
    const labelR = (outerR + innerR) / 2;
    const p1 = this.polarToCartesian(cx, cy, labelR, -45);
    const p2 = this.polarToCartesian(cx, cy, labelR, 45);
    const p3 = this.polarToCartesian(cx, cy, labelR, 135);
    const p4 = this.polarToCartesian(cx, cy, labelR, 225);
    return [
      { x: p1.x, y: p1.y, label: "Food", angle: 45 },
      { x: p2.x, y: p2.y, label: "Fuel", angle: 135 },
      { x: p3.x, y: p3.y, label: "Equip", angle: 225 },
      { x: p4.x, y: p4.y, label: "Ammo", angle: 315 },
    ];
  }
  sectors(): ReadonlyArray<{ path: string; color: string }> {
    const outerR = 48;
    const innerR = 27;
    const arcs = [
      { start: -90, end: 0, value: this.quarterValue(0) },
      { start: 0, end: 90, value: this.quarterValue(1) },
      { start: 90, end: 180, value: this.quarterValue(2) },
      { start: 180, end: 270, value: this.quarterValue(3) },
    ];
    return arcs.map((arc) => ({
      path: this.describeDonutSector(50, 50, outerR, innerR, arc.start, arc.end),
      color: this.colorFromPercent(arc.value),
    }));
  }

  centerTextLines(): string[] {
    const label = this.centerLabel();
    const words = label.split(" ").filter(Boolean);
    if (words.length <= 1) {
      return [label];
    }
    if (words.length === 2) {
      return [words[0], words[1]];
    }
    const first = words.slice(0, 2).join(" ");
    const second = words.slice(2).join(" ");
    return second ? [first, second] : [first];
  }

  private colorFromPercent(value: number): string {
    if (value >= 90) return "#34a853";
    if (value >= 75) return "#f29900";
    return "#d93025";
  }

  private describeDonutSector(
    cx: number,
    cy: number,
    outerR: number,
    innerR: number,
    startDeg: number,
    endDeg: number
  ): string {
    const startOuter = this.polarToCartesian(cx, cy, outerR, startDeg);
    const endOuter = this.polarToCartesian(cx, cy, outerR, endDeg);
    const startInner = this.polarToCartesian(cx, cy, innerR, startDeg);
    const endInner = this.polarToCartesian(cx, cy, innerR, endDeg);
    const largeArcFlag = endDeg-startDeg <= 180 ? "0" : "1";

    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${endOuter.x} ${endOuter.y}`,
      `L ${endInner.x} ${endInner.y}`,
      `A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${startInner.x} ${startInner.y}`,
      "Z",
    ].join(" ");
  }

  private polarToCartesian(
    cx: number,
    cy: number,
    r: number,
    deg: number
  ): { x: number; y: number } {
    const rad = (deg * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }
}
