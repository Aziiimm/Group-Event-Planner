import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { DateRangeQueryDto } from './dto/date-range-query.dto';

@Injectable()
export class AvailabilityService {
  constructor(private supabaseService: SupabaseService) {}

  // Helper method to verify user is a member of the circle
  private async verifyCircleMembership(circleId: string, userId: string) {
    const supabase = this.supabaseService.getClient();

    // Check if circle exists
    const { data: circle } = await supabase
      .from('circles')
      .select('id, owner_id')
      .eq('id', circleId)
      .eq('is_active', true)
      .single();

    if (!circle) {
      throw new NotFoundException('Circle not found');
    }

    // Check if user is owner
    if (circle.owner_id === userId) {
      return true;
    }

    // Check if user is a member
    const { data: membership } = await supabase
      .from('circle_members')
      .select('id')
      .eq('circle_id', circleId)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      throw new NotFoundException(
        'You must be a member of this circle to perform this action',
      );
    }

    return true;
  }

  // Helper method to validate date range
  private validateDateRange(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if start date is before end date
    if (start > end) {
      throw new BadRequestException('Start date must be before or equal to end date');
    }

    // Check if dates are not too far in the past (optional - you might want to allow past dates)
    // For now, we'll allow past dates but warn if they're more than 1 year old
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    if (start < oneYearAgo) {
      throw new BadRequestException('Start date cannot be more than 1 year in the past');
    }

    // Check if dates are not too far in the future (e.g., max 2 years)
    const twoYearsFromNow = new Date();
    twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
    if (end > twoYearsFromNow) {
      throw new BadRequestException('End date cannot be more than 2 years in the future');
    }

    // Check if date range is not too large (e.g., max 3 months)
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 90) {
      throw new BadRequestException('Date range cannot exceed 90 days');
    }

    return true;
  }

  async setAvailability(
    user: User,
    circleId: string,
    createAvailabilityDto: CreateAvailabilityDto,
  ) {
    const supabase = this.supabaseService.getClient();

    // Verify user is a member of the circle
    await this.verifyCircleMembership(circleId, user.id);

    // Validate date range
    this.validateDateRange(createAvailabilityDto.start_date, createAvailabilityDto.end_date);

    // Validate hour blocks
    if (!createAvailabilityDto.hour_blocks || createAvailabilityDto.hour_blocks.length === 0) {
      throw new BadRequestException('At least one hour block must be specified');
    }

    // Remove duplicates from hour_blocks
    const uniqueHourBlocks = [...new Set(createAvailabilityDto.hour_blocks)];

    // Default is_available to true if not provided
    const isAvailable = createAvailabilityDto.is_available ?? true;

    // Generate all date/hour combinations
    const startDate = new Date(createAvailabilityDto.start_date);
    const endDate = new Date(createAvailabilityDto.end_date);
    const availabilityRecords: Array<{
      user_id: string;
      circle_id: string;
      date: string;
      hour_block: number;
      is_available: boolean;
    }> = [];

    // Iterate through each date in the range
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD

      // Add a record for each hour block
      for (const hourBlock of uniqueHourBlocks) {
        availabilityRecords.push({
          user_id: user.id,
          circle_id: circleId,
          date: dateStr,
          hour_block: hourBlock,
          is_available: isAvailable,
        });
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Use upsert to handle conflicts (if availability already exists, update it)
    const { data, error } = await supabase
      .from('availability')
      .upsert(availabilityRecords, {
        onConflict: 'user_id,circle_id,date,hour_block',
      })
      .select();

    if (error) {
      throw new InternalServerErrorException(
        `Failed to set availability: ${error.message}`,
      );
    }

    return {
      message: 'Availability set successfully',
      count: data?.length || 0,
      records: data,
    };
  }

  async getCircleAvailability(
    circleId: string,
    userId: string,
    dateRangeQuery?: DateRangeQueryDto,
  ) {
    const supabase = this.supabaseService.getClient();

    // Verify user is a member of the circle
    await this.verifyCircleMembership(circleId, userId);

    // Build query - fetch availability data
    // Note: We'll fetch user data separately if needed to avoid relationship issues
    let query = supabase.from('availability').select('*').eq('circle_id', circleId);

    // Apply date filters if provided
    if (dateRangeQuery?.start_date) {
      query = query.gte('date', dateRangeQuery.start_date);
    }
    if (dateRangeQuery?.end_date) {
      query = query.lte('date', dateRangeQuery.end_date);
    }

    // Order by date and hour_block
    query = query.order('date', { ascending: true }).order('hour_block', { ascending: true });

    const { data, error } = await query;

    if (error) {
      throw new InternalServerErrorException(
        `Failed to fetch availability: ${error.message}`,
      );
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Get unique user IDs
    const userIds = [...new Set(data.map((item) => item.user_id))];

    // Fetch all users in one query
    const { data: usersData } = await supabase
      .from('users')
      .select('id, display_name, first_name, last_name')
      .in('id', userIds);

    // Create a map for quick lookup
    const usersMap = new Map(
      (usersData || []).map((user) => [user.id, user]),
    );

    // Map availability data with user information
    const availabilityWithUsers = data.map((availability) => ({
      ...availability,
      user: usersMap.get(availability.user_id) || null,
    }));

    return availabilityWithUsers;
  }

  async getAvailabilityHeatmap(
    circleId: string,
    userId: string,
    dateRangeQuery?: DateRangeQueryDto,
  ) {
    const supabase = this.supabaseService.getClient();

    // Verify user is a member of the circle
    await this.verifyCircleMembership(circleId, userId);

    // Build query for available blocks only
    let query = supabase
      .from('availability')
      .select('date, hour_block, user_id')
      .eq('circle_id', circleId)
      .eq('is_available', true);

    // Apply date filters if provided
    if (dateRangeQuery?.start_date) {
      query = query.gte('date', dateRangeQuery.start_date);
    }
    if (dateRangeQuery?.end_date) {
      query = query.lte('date', dateRangeQuery.end_date);
    }

    const { data, error } = await query;

    if (error) {
      throw new InternalServerErrorException(
        `Failed to fetch heatmap data: ${error.message}`,
      );
    }

    // Aggregate data for heatmap
    // Group by date and hour_block, count how many users are available
    const heatmapData: Record<string, Record<number, number>> = {};

    (data || []).forEach((record) => {
      const date = record.date;
      const hourBlock = record.hour_block;

      if (!heatmapData[date]) {
        heatmapData[date] = {};
      }

      if (!heatmapData[date][hourBlock]) {
        heatmapData[date][hourBlock] = 0;
      }

      heatmapData[date][hourBlock] += 1;
    });

    // Get total number of circle members for percentage calculation
    const { count: memberCount } = await supabase
      .from('circle_members')
      .select('*', { count: 'exact', head: true })
      .eq('circle_id', circleId);

    // Also include the owner
    const { data: circle } = await supabase
      .from('circles')
      .select('owner_id')
      .eq('id', circleId)
      .single();

    const totalMembers = (memberCount || 0) + (circle?.owner_id ? 1 : 0);

    // Format response with percentage
    const formattedHeatmap = Object.entries(heatmapData).map(([date, hours]) => {
      const hourBlocks = Object.entries(hours).map(([hour, count]) => ({
        hour_block: parseInt(hour, 10),
        available_count: count,
        total_members: totalMembers,
        percentage: totalMembers > 0 ? Math.round((count / totalMembers) * 100) : 0,
      }));

      return {
        date,
        hour_blocks: hourBlocks,
      };
    });

    return {
      circle_id: circleId,
      total_members: totalMembers,
      heatmap: formattedHeatmap,
    };
  }

  async updateAvailabilityBlock(
    user: User,
    availabilityId: string,
    updateAvailabilityDto: UpdateAvailabilityDto,
  ) {
    const supabase = this.supabaseService.getClient();

    // First, verify the availability record exists and belongs to the user
    const { data: availability, error: fetchError } = await supabase
      .from('availability')
      .select('id, user_id, circle_id')
      .eq('id', availabilityId)
      .single();

    if (fetchError || !availability) {
      throw new NotFoundException('Availability block not found');
    }

    // Verify user owns this availability block
    if (availability.user_id !== user.id) {
      throw new BadRequestException(
        'You can only update your own availability blocks',
      );
    }

    // Verify user is still a member of the circle
    await this.verifyCircleMembership(availability.circle_id, user.id);

    // Update the availability block
    const { data, error } = await supabase
      .from('availability')
      .update({
        is_available: updateAvailabilityDto.is_available,
      })
      .eq('id', availabilityId)
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(
        `Failed to update availability: ${error.message}`,
      );
    }

    return data;
  }

  async deleteAvailabilityBlock(user: User, availabilityId: string) {
    const supabase = this.supabaseService.getClient();

    // First, verify the availability record exists and belongs to the user
    const { data: availability, error: fetchError } = await supabase
      .from('availability')
      .select('id, user_id, circle_id')
      .eq('id', availabilityId)
      .single();

    if (fetchError || !availability) {
      throw new NotFoundException('Availability block not found');
    }

    // Verify user owns this availability block
    if (availability.user_id !== user.id) {
      throw new BadRequestException(
        'You can only delete your own availability blocks',
      );
    }

    // Verify user is still a member of the circle
    await this.verifyCircleMembership(availability.circle_id, user.id);

    // Delete the availability block
    const { error } = await supabase.from('availability').delete().eq('id', availabilityId);

    if (error) {
      throw new InternalServerErrorException(
        `Failed to delete availability: ${error.message}`,
      );
    }

    return { message: 'Availability block deleted successfully' };
  }
}

