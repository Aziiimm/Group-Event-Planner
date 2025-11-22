import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { CirclesService } from './circles.service';
import { CreateCircleDto } from './dto/create-circle.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { RespondInvitationDto } from './dto/respond-invitation.dto';
import { SearchUsersDto } from './dto/search-users.dto';

@Controller('circles')
@UseGuards(AuthGuard)
export class CirclesController {
  constructor(private readonly circlesService: CirclesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCircle(
    @CurrentUser() user: User,
    @Body() createCircleDto: CreateCircleDto,
  ) {
    return await this.circlesService.createCircle(user, createCircleDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getUserCircles(@CurrentUser() user: User) {
    return await this.circlesService.getUserCircles(user.id);
  }

  @Get('search-users')
  @HttpCode(HttpStatus.OK)
  async searchUsers(
    @CurrentUser() user: User,
    @Query() searchUsersDto: SearchUsersDto,
  ) {
    return await this.circlesService.searchUsers(user, searchUsersDto);
  }

  @Get(':id/pending-invitations')
  @HttpCode(HttpStatus.OK)
  async getCirclePendingInvitations(@CurrentUser() user: User, @Param('id') id: string) {
    return await this.circlesService.getCirclePendingInvitations(id, user.id);
  }

  @Get(':id/members')
  @HttpCode(HttpStatus.OK)
  async getCircleMembers(@CurrentUser() user: User, @Param('id') id: string) {
    return await this.circlesService.getCircleMembers(id, user.id);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getCircle(@CurrentUser() user: User, @Param('id') id: string) {
    return await this.circlesService.getCircleWithDetails(id, user.id);
  }

  @Post('invitations')
  @HttpCode(HttpStatus.CREATED)
  async createInvitation(
    @CurrentUser() user: User,
    @Body() createInvitationDto: CreateInvitationDto,
  ) {
    return await this.circlesService.createInvitation(user, createInvitationDto);
  }

  @Get('invitations/pending')
  @HttpCode(HttpStatus.OK)
  async getPendingInvitations(@CurrentUser() user: User) {
    return await this.circlesService.getPendingInvitations(user.id);
  }

  @Post('invitations/respond')
  @HttpCode(HttpStatus.OK)
  async respondToInvitation(
    @CurrentUser() user: User,
    @Body() respondInvitationDto: RespondInvitationDto,
  ) {
    return await this.circlesService.respondToInvitation(
      user,
      respondInvitationDto,
    );
  }
}

