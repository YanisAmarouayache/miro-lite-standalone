export class VersionConflictError extends Error {
  readonly status = 409;

  constructor(message: string) {
    super(message);
    this.name = "VersionConflictError";
  }
}
