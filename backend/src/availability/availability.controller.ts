import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { AvailabilityService } from './availability.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { DateRangeQueryDto } from './dto/date-range-query.dto';

@Controller('availability')
@UseGuards(AuthGuard)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Post('circle/:circleId')
  @HttpCode(HttpStatus.CREATED)
  async setAvailability(
    @CurrentUser() user: User,
    @Param('circleId') circleId: string,
    @Body() createAvailabilityDto: CreateAvailabilityDto,
  ) {
    return await this.availabilityService.setAvailability(
      user,
      circleId,
      createAvailabilityDto,
    );
  }

  @Get('circle/:circleId')
  @HttpCode(HttpStatus.OK)
  async getCircleAvailability(
    @CurrentUser() user: User,
    @Param('circleId') circleId: string,
    @Query() dateRangeQuery?: DateRangeQueryDto,
  ) {
    return await this.availabilityService.getCircleAvailability(
      circleId,
      user.id,
      dateRangeQuery,
    );
  }

  @Get('circle/:circleId/heatmap')
  @HttpCode(HttpStatus.OK)
  async getAvailabilityHeatmap(
    @CurrentUser() user: User,
    @Param('circleId') circleId: string,
    @Query() dateRangeQuery?: DateRangeQueryDto,
  ) {
    return await this.availabilityService.getAvailabilityHeatmap(
      circleId,
      user.id,
      dateRangeQuery,
    );
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updateAvailabilityBlock(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() updateAvailabilityDto: UpdateAvailabilityDto,
  ) {
    return await this.availabilityService.updateAvailabilityBlock(
      user,
      id,
      updateAvailabilityDto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteAvailabilityBlock(@CurrentUser() user: User, @Param('id') id: string) {
    return await this.availabilityService.deleteAvailabilityBlock(user, id);
  }
}

