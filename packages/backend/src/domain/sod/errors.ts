/**
 * RFC 7807 Problem Details representation for HTTP APIs.
 * @see https://datatracker.ietf.org/doc/html/rfc7807
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  ruleCode?: string;
  reauth_required?: boolean;
  [key: string]: unknown;
}

export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly type: string;
  abstract readonly title: string;
  readonly ruleCode?: string;

  constructor(message: string, ruleCode?: string) {
    super(message);
    this.name = this.constructor.name;
    this.ruleCode = ruleCode;
  }

  toProblemDetails(instance?: string): ProblemDetails {
    return {
      type: this.type,
      title: this.title,
      status: this.statusCode,
      detail: this.message,
      ...(this.ruleCode ? { ruleCode: this.ruleCode } : {}),
      ...(instance ? { instance } : {}),
    };
  }
}

export class SodConflictError extends AppError {
  readonly statusCode = 403;
  readonly type = 'https://nusaproc.nusanet.net.id/errors/sod-conflict';
  readonly title = 'Separation of Duties Conflict';

  constructor(message: string, public override readonly ruleCode: string) {
    super(message, ruleCode);
  }
}

export class StepUpRequiredError extends AppError {
  readonly statusCode = 403;
  readonly type = 'https://nusaproc.nusanet.net.id/errors/step-up-reauth-required';
  readonly title = 'Step-Up Re-Authentication Required';

  constructor(
    message = 'Tindakan ini memerlukan verifikasi ulang kredensial (Step-Up Re-Auth)',
    ruleCode = 'R5_STEP_UP_REAUTH_REQUIRED'
  ) {
    super(message, ruleCode);
  }

  override toProblemDetails(instance?: string): ProblemDetails {
    return {
      ...super.toProblemDetails(instance),
      reauth_required: true,
    };
  }
}

export class ScopeLimitExceededError extends AppError {
  readonly statusCode = 403;
  readonly type = 'https://nusaproc.nusanet.net.id/errors/scope-limit-exceeded';
  readonly title = 'Approval Scope Limit Exceeded';

  constructor(
    message = 'Nilai pengajuan melebihi batas kewenangan persetujuan atau di luar divisi',
    ruleCode = 'R13_OUT_OF_SCOPE'
  ) {
    super(message, ruleCode);
  }
}

export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly type = 'https://nusaproc.nusanet.net.id/errors/unauthorized';
  readonly title = 'Unauthorized';

  constructor(message = 'Kredensial atau token autentikasi tidak valid') {
    super(message, 'AUTH_INVALID_TOKEN');
  }
}

export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly type = 'https://nusaproc.nusanet.net.id/errors/forbidden';
  readonly title = 'Forbidden';

  constructor(message = 'Anda tidak memiliki hak akses untuk tindakan ini') {
    super(message, 'RBAC_FORBIDDEN');
  }
}

export function formatProblemDetails(error: unknown, instance?: string): ProblemDetails {
  if (error instanceof AppError) {
    return error.toProblemDetails(instance);
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    type: 'https://nusaproc.nusanet.net.id/errors/internal-server-error',
    title: 'Internal Server Error',
    status: 500,
    detail: message,
    ...(instance ? { instance } : {}),
  };
}
