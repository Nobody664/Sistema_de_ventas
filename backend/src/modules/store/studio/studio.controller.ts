import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Response } from "express";
import { Public } from "@/common/decorators/public.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { Permission } from "@/common/constants/permissions.constant";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { StoreManagementGuard } from "../admin/store-management.guard";
import { StoreAdminUser } from "../admin/store-admin-context.service";
import { StoreIdentifierPipe } from "../store-identifier.pipe";
import { StorePrivateInterceptor } from "../store-private.interceptor";
import { StoreService } from "../store.service";
import { StoreStudioService } from "./studio.service";
import {
  StudioDraftDto,
  StudioFeaturesDto,
  StudioMediaDto,
  StudioNoteDto,
  StudioPublishDto,
  StudioVersionDto,
  StudioViewDto,
  StudioViewsQuery,
  StudioViewUpdateDto,
} from "./studio.dto";

type StudioRequest = { user: StoreAdminUser };
@Roles("COMPANY_ADMIN")
@Permissions(Permission.STORE_MANAGE)
@UseGuards(StoreManagementGuard, PermissionsGuard)
@UseInterceptors(StorePrivateInterceptor)
@Controller("store-admin")
export class StoreStudioController {
  constructor(private readonly studio: StoreStudioService) {}
  @Get("features") async features(@Req() req: StudioRequest) {
    const actor = await this.studio.actor(req.user);
    return this.studio.features(actor.companyId);
  }
  @Patch("features") async configure(
    @Req() req: StudioRequest,
    @Body() input: StudioFeaturesDto,
  ) {
    return this.studio.configureFeatures(
      await this.studio.actor(req.user),
      input,
    );
  }
  @Get("appearance") async appearance(@Req() req: StudioRequest) {
    return this.studio.appearance(
      await this.studio.actor(req.user, "appearance"),
    );
  }
  @Patch("appearance") async draft(
    @Req() req: StudioRequest,
    @Body() input: StudioDraftDto,
  ) {
    return this.studio.saveDraft(
      await this.studio.actor(req.user, "appearance"),
      input,
    );
  }
  @Post("appearance/publish") async publish(
    @Req() req: StudioRequest,
    @Body() input: StudioPublishDto,
  ) {
    return this.studio.publish(
      await this.studio.actor(req.user, "appearance"),
      input,
    );
  }
  @Post("appearance/restore") async restore(
    @Req() req: StudioRequest,
    @Body() input: StudioVersionDto,
  ) {
    return this.studio.restore(
      await this.studio.actor(req.user, "appearance"),
      input.expectedVersion,
    );
  }
  @Get("appearance/preview") async preview(@Req() req: StudioRequest) {
    return this.studio.preview(await this.studio.actor(req.user, "appearance"));
  }
  @Get("media") async media(@Req() req: StudioRequest) {
    return this.studio.media(await this.studio.actor(req.user, "appearance"));
  }
  @Throttle({ default: { limit: 12, ttl: 60000 } })
  @Post("media")
  async upload(@Req() req: StudioRequest, @Body() input: StudioMediaDto) {
    return this.studio.upload(
      await this.studio.actor(req.user, "appearance"),
      input,
    );
  }
  @Post("media/:id/archive") async archive(
    @Req() req: StudioRequest,
    @Param("id", StoreIdentifierPipe) id: string,
  ) {
    return this.studio.archive(
      await this.studio.actor(req.user, "appearance"),
      id,
    );
  }
  @Get("media/:id/content") async content(
    @Req() req: StudioRequest,
    @Param("id", StoreIdentifierPipe) id: string,
    @Res() response: Response,
  ) {
    const actor = await this.studio.actor(req.user, "appearance");
    const image = await this.studio.content(actor.companyId, id);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.type(image.mimeType).send(Buffer.from(image.content));
  }
  @Get("internal-notes/:id") async notes(
    @Req() req: StudioRequest,
    @Param("id", StoreIdentifierPipe) id: string,
  ) {
    return this.studio.notes(await this.studio.actor(req.user, "notes"), id);
  }
  @Post("internal-notes/:id") async addNote(
    @Req() req: StudioRequest,
    @Param("id", StoreIdentifierPipe) id: string,
    @Body() input: StudioNoteDto,
  ) {
    return this.studio.addNote(
      await this.studio.actor(req.user, "notes"),
      id,
      input.body,
    );
  }
  @Get("views") async views(
    @Req() req: StudioRequest,
    @Query() query: StudioViewsQuery,
  ) {
    return this.studio.views(
      await this.studio.actor(req.user, "savedViews"),
      query.resource,
    );
  }
  @Post("views") async createView(
    @Req() req: StudioRequest,
    @Body() input: StudioViewDto,
  ) {
    return this.studio.saveView(
      await this.studio.actor(req.user, "savedViews"),
      input,
    );
  }
  @Patch("views/:id") async updateView(
    @Req() req: StudioRequest,
    @Param("id", StoreIdentifierPipe) id: string,
    @Body() input: StudioViewUpdateDto,
  ) {
    return this.studio.saveView(
      await this.studio.actor(req.user, "savedViews"),
      input,
      id,
    );
  }
  @Post("views/:id/delete") async deleteView(
    @Req() req: StudioRequest,
    @Param("id", StoreIdentifierPipe) id: string,
    @Body() input: StudioVersionDto,
  ) {
    return this.studio.deleteView(
      await this.studio.actor(req.user, "savedViews"),
      id,
      input.expectedVersion,
    );
  }
}

@Public()
@Controller("store/:slug/appearance-media")
export class StorePublishedMediaController {
  constructor(
    private readonly store: StoreService,
    private readonly studio: StoreStudioService,
  ) {}
  @Get(":id") async content(
    @Param("slug") slug: string,
    @Param("id", StoreIdentifierPipe) id: string,
    @Res() response: Response,
  ) {
    const company = await this.store.company(slug);
    const image = await this.studio.publicContent(company.id, company.slug, id);
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.type(image.mimeType).send(Buffer.from(image.content));
  }
}
