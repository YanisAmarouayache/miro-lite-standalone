import { Injectable } from "@angular/core";
import { WidgetDataBindingConfig } from "../../domain/board.model";

@Injectable({ providedIn: "root" })
export class ChartBindingService {
  private withOverlayHuidVariable(
    variablesMapping: Record<string, unknown> | undefined,
    overlayHuid: string
  ): Record<string, unknown> | undefined {
    const next = { ...(variablesMapping ?? {}) };
    if (overlayHuid.trim()) {
      next["overlayHuid"] = overlayHuid.trim();
    } else {
      delete next["overlayHuid"];
    }
    return Object.keys(next).length > 0 ? next : undefined;
  }

  private withUnitHuidVariable(
    variablesMapping: Record<string, unknown> | undefined,
    unitHuid: string
  ): Record<string, unknown> | undefined {
    const next = { ...(variablesMapping ?? {}) };
    if (unitHuid.trim()) {
      next["unitHuid"] = unitHuid.trim();
    } else {
      delete next["unitHuid"];
    }
    return Object.keys(next).length > 0 ? next : undefined;
  }

  forDataSource(
    current: WidgetDataBindingConfig | undefined,
    nextDataSourceCode: string
  ): WidgetDataBindingConfig {
    if (!nextDataSourceCode.trim()) {
      return {
        dataSourceCode: "",
        overlayHuid: "",
        unitHuid: "",
        variablesMapping: undefined,
        fieldMapping: current?.fieldMapping,
        displayRules: current?.displayRules,
      };
    }
    const overlayHuid = current?.overlayHuid ?? "";
    const unitHuid = current?.unitHuid ?? "";
    let variablesMapping = this.withOverlayHuidVariable(
      current?.variablesMapping,
      overlayHuid
    );
    variablesMapping = this.withUnitHuidVariable(variablesMapping, unitHuid);
    return {
      dataSourceCode: nextDataSourceCode,
      overlayHuid,
      unitHuid,
      variablesMapping,
      fieldMapping: current?.fieldMapping,
      displayRules: current?.displayRules,
    };
  }

  forOverlayHuid(
    current: WidgetDataBindingConfig | undefined,
    overlayHuid: string
  ): WidgetDataBindingConfig {
    const variablesMapping = this.withOverlayHuidVariable(
      current?.variablesMapping,
      overlayHuid
    );
    return {
      dataSourceCode: current?.dataSourceCode ?? "",
      overlayHuid,
      // Selecting a new overlay invalidates previously selected unit.
      unitHuid: "",
      variablesMapping: this.withUnitHuidVariable(variablesMapping, ""),
      fieldMapping: current?.fieldMapping,
      displayRules: current?.displayRules,
    };
  }

  forUnitHuid(
    current: WidgetDataBindingConfig | undefined,
    unitHuid: string
  ): WidgetDataBindingConfig {
    const variablesMapping = this.withUnitHuidVariable(
      this.withOverlayHuidVariable(current?.variablesMapping, current?.overlayHuid ?? ""),
      unitHuid
    );
    return {
      dataSourceCode: current?.dataSourceCode ?? "",
      overlayHuid: current?.overlayHuid ?? "",
      unitHuid,
      variablesMapping,
      fieldMapping: current?.fieldMapping,
      displayRules: current?.displayRules,
    };
  }
}
