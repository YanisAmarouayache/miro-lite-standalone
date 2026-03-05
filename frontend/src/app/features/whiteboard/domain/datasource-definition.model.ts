export interface DataSourceDefinitionModel {
  id: string;
  code: string;
  version: number;
  protocol: string;
  operationName: string;
  request: string;
  variablesSchema?: Record<string, unknown>;
  resultSchema?: Record<string, unknown>;
}
