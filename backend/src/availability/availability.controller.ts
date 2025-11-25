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
import { AvailabilityService } from './availability.service';
import { SubmitAvailabilityDto } from './dto/submit-availability.dto';

@Controller('availability')
@UseGuards(AuthGuard)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Post('submit')
  @HttpCode(HttpStatus.CREATED)
  async submitAvailability(
    @CurrentUser() user: User,
    @Body() submitAvailabilityDto: SubmitAvailabilityDto,
  ) {
    return await this.availabilityService.submitAvailability(
      user,
      submitAvailabilityDto,
    );
  }

  @Get('circles/:circleId/heatmap')
  @HttpCode(HttpStatus.OK)
  async getCircleHeatmap(
    @CurrentUser() user: User,
    @Param('circleId') circleId: string,
  ) {
    return await this.availabilityService.getCircleHeatmap(circleId, user.id);
  }

  @Get('circles/:circleId')
  @HttpCode(HttpStatus.OK)
  async getUserAvailability(
    @CurrentUser() user: User,
    @Param('circleId') circleId: string,
  ) {
    return await this.availabilityService.getUserAvailability(user, circleId);
  }
}
