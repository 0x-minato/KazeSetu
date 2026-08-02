export class RefreshTokenRotationConflictError extends Error {
  constructor() {
    super("Refresh token cannot be rotated")
    this.name = "RefreshTokenRotationConflictError"
  }
}
