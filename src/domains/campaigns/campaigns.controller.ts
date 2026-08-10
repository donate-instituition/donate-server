import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { isAbsolute } from 'path';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { Public } from '../../auth/decorators/public.decorator';
import type { PaginationQuery } from '../../common/pagination';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { UploadCampaignAssetDto } from './dto/upload-campaign-asset.dto';
import { CampaignsService } from './campaigns.service';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  create(@Body() createCampaignDto: CreateCampaignDto) {
    return this.campaignsService.create(createCampaignDto);
  }

  @Post('me')
  createMine(
    @Body() createCampaignDto: CreateCampaignDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.campaignsService.createForCurrentInstitution(
      createCampaignDto,
      user?.sub,
    );
  }

  @Post('uploads')
  async uploadAsset(
    @Body() uploadCampaignAssetDto: UploadCampaignAssetDto,
    @Req() request: Request,
  ) {
    const uploadedAsset = await this.campaignsService.uploadAsset(
      uploadCampaignAssetDto,
    );

    return {
      ...uploadedAsset,
      url: `${request.protocol}://${request.get('host')}${uploadedAsset.url}`,
    };
  }

  @Post(':id/publish')
  publishMine(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.campaignsService.publishForCurrentInstitution(id, user?.sub);
  }

  @Post(':id/comments')
  createComment(
    @Param('id') id: string,
    @Body() body: { content?: string },
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.campaignsService.createComment(id, body.content, user?.sub);
  }

  @Get(':id/comments')
  listComments(@Param('id') id: string) {
    return this.campaignsService.listComments(id);
  }

  @Post(':id/like')
  like(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.campaignsService.like(id, user?.sub);
  }

  @Delete(':id/like')
  unlike(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.campaignsService.unlike(id, user?.sub);
  }

  @Post(':id/share')
  share(@Param('id') id: string) {
    return this.campaignsService.share(id);
  }

  @Public()
  @Get()
  findAll(@Query() query: PaginationQuery) {
    return this.campaignsService.findAll(query);
  }

  @Get('mine')
  findMine(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: PaginationQuery,
  ) {
    return this.campaignsService.findMine(user?.sub, query);
  }

  @Public()
  @Get('uploads/:fileName')
  async getUploadedAsset(
    @Param('fileName') fileName: string,
    @Res() response: Response,
  ) {
    const downloadUrl =
      await this.campaignsService.getUploadedAssetUrl(fileName);

    if (isAbsolute(downloadUrl)) {
      return response.sendFile(downloadUrl);
    }

    return response.redirect(downloadUrl);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.campaignsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCampaignDto: UpdateCampaignDto,
  ) {
    return this.campaignsService.update(id, updateCampaignDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.campaignsService.remove(id);
  }
}
