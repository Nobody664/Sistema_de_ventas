import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  createOwner(input: {
    email: string;
    passwordHash: string;
    fullName: string;
    companyId: string;
  }) {
    return this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        fullName: input.fullName,
        globalRole: 'USER',
        memberships: {
          create: {
            companyId: input.companyId,
            role: 'COMPANY_ADMIN',
          },
        },
      },
    });
  }
}

