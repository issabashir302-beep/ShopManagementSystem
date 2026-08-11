export class AppError extends Error {
  constructor(statusCode, code, message, details = undefined) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
    this.isOperational = true
  }

  static badRequest(code, message, details) {
    return new AppError(400, code, message, details)
  }

  static unauthorized(message = 'Authentication required') {
    return new AppError(401, 'UNAUTHENTICATED', message)
  }

  static forbidden(message = 'You are not allowed to perform this action') {
    return new AppError(403, 'FORBIDDEN', message)
  }

  static notFound(code, message) {
    return new AppError(404, code, message)
  }

  static conflict(code, message) {
    return new AppError(409, code, message)
  }

  static unprocessable(code, message) {
    return new AppError(422, code, message)
  }
}
