import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type AuthUser = {
  sub: string;
  email: string;
  companyId?: string | null;
  roles: string[];
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

