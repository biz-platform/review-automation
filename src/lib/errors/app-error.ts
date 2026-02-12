import type { ErrorResponse } from "@/lib/types/api/response";

export interface AppErrorOptions {
  code: string;
  message: string;
  detail?: string;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly detail?: string;

  constructor(options: AppErrorOptions, statusCode = 500) {
    super(options.message);
    this.name = this.constructor.name;
    this.code = options.code;
    this.statusCode = statusCode;
    this.detail = options.detail;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AppBadRequestError extends AppError {
  constructor(options: AppErrorOptions) {
    super(options, 400);
  }
}

export class AppUnauthorizedError extends AppError {
  constructor(options: AppErrorOptions) {
    super(options, 401);
  }
}

export class AppForbiddenError extends AppError {
  constructor(options: AppErrorOptions) {
    super(options, 403);
  }
}

export class AppNotFoundError extends AppError {
  constructor(options: AppErrorOptions) {
    super(options, 404);
  }
}

export class AppConflictError extends AppError {
  constructor(options: AppErrorOptions) {
    super(options, 409);
  }
}

export class AppValidationError extends AppError {
  constructor(options: AppErrorOptions) {
    super(options, 422);
  }
}

export interface AppNextRouteHandlerErrorObject extends ErrorResponse {}

export class AppNextRouteHandlerError extends AppError {
  constructor(
    options: AppErrorOptions,
    statusCode: number,
    public readonly instance: string,
    public readonly requestMethod: string
  ) {
    super(options, statusCode);
    this.instance = instance;
    this.requestMethod = requestMethod;
  }

  toObject(): AppNextRouteHandlerErrorObject {
    return {
      type: `https://api/review-automation/errors/${this.code}`,
      title: this.message,
      status: this.statusCode,
      detail: this.detail ?? "",
      instance: this.instance,
      code: this.code,
      requestMethod: this.requestMethod,
      timestamp: new Date().toISOString(),
    };
  }
}
