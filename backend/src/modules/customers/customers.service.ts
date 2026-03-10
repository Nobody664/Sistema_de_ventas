import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  findByCompany(companyId: string) {
    return this.prisma.customer.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  create(companyId: string, input: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: {
        companyId,
        ...input,
      },
    });
  }

  async update(companyId: string, id: string, input: UpdateCustomerDto) {
    await this.ensureCustomer(companyId, id);
    return this.prisma.customer.update({
      where: { id },
      data: input,
    });
  }

  async remove(companyId: string, id: string) {
    await this.ensureCustomer(companyId, id);
    return this.prisma.customer.delete({ where: { id } });
  }

  private async ensureCustomer(companyId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, companyId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    return customer;
  }
}
