/**
 * Response Utilities
 *
 * Helper functions for sending consistent API responses.
 * Import and use in Controllers only.
 *
 * All responses follow the standard envelope:
 *
 * Success: { success: true, data: {}, message: "..." }
 * Error:   { success: false, error: "CODE", message: "..." }
 */
import { Response } from 'express';

interface SuccessOptions<T> {
  res: Response;
  statusCode?: number;
  data?: T;
  message: string;
}

export function sendSuccess<T>({ res, statusCode = 200, data, message }: SuccessOptions<T>): void {
  res.status(statusCode).json({
    success: true,
    data: data ?? {},
    message,
  });
}

export function sendCreated<T>(options: Omit<SuccessOptions<T>, 'statusCode'>): void {
  sendSuccess({ ...options, statusCode: 201 });
}

export function sendNoContent(res: Response): void {
  res.status(204).send();
}
