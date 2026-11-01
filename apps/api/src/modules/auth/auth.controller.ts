import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z, type ZodType } from 'zod';

import { AuthService } from './auth.service.js';

const activateSchema = z.object({
  token: z.string().min(24),
  username: z.string().trim().min(3).max(80),
  displayName: z.string().trim().min(2).max(160),
  password: z.string().min(12).max(128),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(8).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(24),
});

function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException({
      message: 'La solicitud contiene datos inválidos.',
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  return parsed.data;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('activate')
  activate(@Body() body: unknown) {
    return this.authService.activate(parseBody(activateSchema, body));
  }

  @Post('login')
  login(@Body() body: unknown) {
    return this.authService.login(parseBody(loginSchema, body));
  }

  @Post('refresh')
  refresh(@Body() body: unknown) {
    const { refreshToken } = parseBody(refreshSchema, body);
    return this.authService.refresh(refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body() body: unknown): Promise<void> {
    const { refreshToken } = parseBody(refreshSchema, body);
    await this.authService.logout(refreshToken);
  }
}
