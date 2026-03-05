export interface CapaOpsQuarterSnapshot {
  key: string;
  value: number;
}

export interface CapaOpsCenterSnapshot {
  operationalStatusCode?: string | null;
}

export interface CapaOpsDoughnutSnapshot {
  quarters: CapaOpsQuarterSnapshot[];
  center: CapaOpsCenterSnapshot;
}
