import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { RSVPDto } from './dto/rsvp.dto';

@Controller('events')
@UseGuards(AuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post('circle/:circleId')
  @HttpCode(HttpStatus.CREATED)
  async createEvent(
    @CurrentUser() user: User,
    @Param('circleId') circleId: string,
    @Body() createEventDto: CreateEventDto,
  ) {
    return await this.eventsService.createEvent(user, circleId, createEventDto);
  }

  @Get('circle/:circleId')
  @HttpCode(HttpStatus.OK)
  async getCircleEvents(
    @CurrentUser() user: User,
    @Param('circleId') circleId: string,
  ) {
    return await this.eventsService.getCircleEvents(circleId, user.id);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getEvent(@CurrentUser() user: User, @Param('id') id: string) {
    return await this.eventsService.getEvent(id, user.id);
  }

  @Post(':id/rsvp')
  @HttpCode(HttpStatus.OK)
  async rsvpToEvent(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() rsvpDto: RSVPDto,
  ) {
    return await this.eventsService.rsvpToEvent(user, id, rsvpDto);
  }

  @Get(':id/rsvps')
  @HttpCode(HttpStatus.OK)
  async getEventRSVPs(@CurrentUser() user: User, @Param('id') id: string) {
    return await this.eventsService.getEventRSVPs(id, user.id);
  }
}
