import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionLimitService, ResourceType } from './subscription-limit.service';

export const LIMIT_RESOURCE_KEY = 'limitResource';

export function LimitResource(resource: ResourceType) {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    return descriptor;
  };
}

@Injectable()
export class SubscriptionLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limitService: SubscriptionLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const companyId = request.headers['x-company-id'] || request.user?.companyId;

    if (!companyId) {
      return true;
    }

    const resource = this.reflector.get<ResourceType>(
      LIMIT_RESOURCE_KEY,
      context.getHandler(),
    );

    if (!resource) {
      return true;
    }

    try {
      await this.limitService.validateLimit(companyId, resource);
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      return true;
    }
  }
}
