/**
 * Auth Controller
 *
 * Parses the request, calls the service, formats the response.
 * No business logic and no SQL here — see auth.service.ts / auth.repository.ts.
 */
import { Request, Response, NextFunction } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response';
import * as authService from './auth.service';

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    sendSuccess({ res, data: result, message: 'Login successful' });
  } catch (error) {
    next(error);
  }
}

export async function signup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, email, password, role } = req.body;
    const result = await authService.signup({ name, email, password, role });
    sendCreated({ res, data: result, message: 'Account created successfully' });
  } catch (error) {
    next(error);
  }
}

export async function requestLink(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = req.body;
    const result = await authService.requestMagicLink(email);
    sendSuccess({ res, data: result, message: result.message });
  } catch (error) {
    next(error);
  }
}

export async function verifyLink(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = req.body;
    const result = await authService.verifyMagicLink(token);
    sendSuccess({ res, data: result, message: 'Login successful' });
  } catch (error) {
    next(error);
  }
}

export async function portalLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;
    const result = await authService.portalLogin(email, password);
    sendSuccess({ res, data: result, message: 'Login successful' });
  } catch (error) {
    next(error);
  }
}
