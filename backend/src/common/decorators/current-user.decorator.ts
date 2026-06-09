import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type AuthUser = {
  sub: string;
  email: string;
  companyId?: string | null;
  roles: string[];
};

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext): AuthUser | unknown => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    return data ? user?.[data as keyof AuthUser] : user;
  },
);

