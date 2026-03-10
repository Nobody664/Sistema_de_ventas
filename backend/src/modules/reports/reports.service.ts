import { Injectable } from '@nestjs/common';

@Injectable()
export class ReportsService {
  getSalesOverview(companyId: string) {
    return {
      companyId,
      reports: [
        'daily-sales',
        'sales-by-product',
        'sales-by-employee',
        'monthly-revenue',
        'top-customers',
      ],
      note: 'Implement read models or materialized views for heavy aggregations.',
    };
  }
}

