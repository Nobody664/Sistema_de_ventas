import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@/database/prisma/prisma.service";
import { rejectNullFields } from "@/common/helpers/patch-contract.helper";
import { pagination } from "@/common/helpers/query-bounds.helper";
import { isProfileComplete } from "@/common/helpers/profile-completeness.helper";
import {
  CreateCompanyDto,
  UpdateCompanyDto,
  UpdateCompanyStatusDto,
} from "./dto/company.dto";

interface ProfileFieldsInput {
  taxId?: string | null;
  legalName?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  private profileSync(input: ProfileFieldsInput, completedAt?: Date | null) {
    const complete = isProfileComplete(input);
    return {
      profileComplete: complete,
      profileCompletedAt: complete ? (completedAt ?? new Date()) : null,
    };
  }

  async findAll(page = 1, limit = 20) {
    pagination(page, limit);
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.company.findMany({
        skip,
        take: limit,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          subscriptions: { include: { plan: true }, take: 1 },
          _count: { select: { memberships: true, customers: true } },
        },
      }),
      this.prisma.company.count(),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        subscriptions: {
          include: { plan: true },
          take: 1,
        },
      },
    });

    if (!company) {
      throw new NotFoundException("Company not found.");
    }

    return company;
  }

  async create(input: CreateCompanyDto) {
    const slug =
      input.slug ??
      input.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-");
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const freePlan = await this.prisma.plan.findUnique({
      where: { code: "FREE" },
    });

    return this.prisma.company.create({
      data: {
        name: input.name,
        slug,
        legalName: input.legalName,
        taxId: input.taxId,
        address: input.address,
        email: input.email,
        phone: input.phone,
        timezone: input.timezone ?? "America/Lima",
        currency: input.currency ?? "PEN",
        status: "TRIAL",
        trialEndsAt,
        ...this.profileSync(input),
        subscriptions: freePlan
          ? {
              create: {
                planId: freePlan.id,
                status: "TRIALING",
                billingCycle: "MONTHLY",
                startDate: new Date(),
                endDate: trialEndsAt,
              },
            }
          : undefined,
      },
      include: {
        subscriptions: { include: { plan: true }, take: 1 },
      },
    });
  }

  async createWithPlan(input: CreateCompanyDto & { planId: string }) {
    const slug =
      input.slug ??
      input.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-");

    const company = await this.prisma.company.create({
      data: {
        name: input.name,
        slug,
        legalName: input.legalName,
        taxId: input.taxId,
        address: input.address,
        email: input.email,
        phone: input.phone,
        timezone: input.timezone ?? "America/Lima",
        currency: input.currency ?? "PEN",
        status: "TRIAL",
        ...this.profileSync(input),
        subscriptions: {
          create: {
            planId: input.planId,
            status: "TRIALING",
            billingCycle: "MONTHLY",
            startDate: new Date(),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      },
      include: {
        subscriptions: {
          include: { plan: true },
          take: 1,
        },
      },
    });

    return company;
  }

  async approve(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: { subscriptions: true },
    });

    if (!company) {
      throw new NotFoundException("Company not found.");
    }

    const activeSubscription = company.subscriptions[0];
    if (activeSubscription) {
      return this.prisma.company.update({
        where: { id },
        data: {
          status: "ACTIVE",
          subscriptions: {
            update: {
              where: { id: activeSubscription.id },
              data: { status: "ACTIVE" },
            },
          },
        },
        include: {
          subscriptions: {
            include: { plan: true },
            take: 1,
          },
        },
      });
    }

    return this.prisma.company.update({
      where: { id },
      data: { status: "ACTIVE" },
    });
  }

  async reject(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException("Company not found.");
    }

    return this.prisma.company.update({
      where: { id },
      data: { status: "SUSPENDED" },
    });
  }

  async findCurrent(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        subscriptions: {
          include: { plan: true },
          take: 1,
        },
      },
    });

    if (!company) {
      throw new NotFoundException("Company not found.");
    }

    return company;
  }

  async updateCurrent(companyId: string, input: UpdateCompanyDto) {
    rejectNullFields(input, ["name", "timezone", "currency"]);
    const existing = await this.findCurrent(companyId);

    return this.prisma.company.update({
      where: { id: companyId },
      data: {
        ...input,
        ...this.profileSync(
          {
            ...existing,
            ...Object.fromEntries(
              Object.entries(input).filter(([, value]) => value !== undefined),
            ),
          },
          existing.profileCompletedAt,
        ),
      },
    });
  }

  async update(companyId: string, input: UpdateCompanyDto) {
    rejectNullFields(input, ["name", "timezone", "currency"]);
    const existing = await this.findOne(companyId);

    return this.prisma.company.update({
      where: { id: companyId },
      data: {
        ...input,
        ...this.profileSync(
          {
            ...existing,
            ...Object.fromEntries(
              Object.entries(input).filter(([, value]) => value !== undefined),
            ),
          },
          existing.profileCompletedAt,
        ),
      },
    });
  }

  async updateStatus(companyId: string, input: UpdateCompanyStatusDto) {
    await this.findOne(companyId);

    return this.prisma.company.update({
      where: { id: companyId },
      data: { status: input.status },
    });
  }
}
