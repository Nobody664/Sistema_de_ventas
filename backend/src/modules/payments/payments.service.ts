import { Injectable } from '@nestjs/common';

@Injectable()
export class PaymentsService {
  createCheckoutSession(input: { companyId: string; planCode: string; provider: string }) {
    return {
      status: 'pending',
      provider: input.provider,
      planCode: input.planCode,
      companyId: input.companyId,
      redirectUrl: `https://checkout.example.com/${input.provider}/${input.planCode}`,
      note: 'Replace this placeholder with the provider SDK implementation.',
    };
  }

  handleWebhook(provider: string, payload: unknown) {
    return {
      provider,
      received: true,
      payload,
      nextStep: 'Validate signature, map provider event, persist payment and activate subscription.',
    };
  }
}

