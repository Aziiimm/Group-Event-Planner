import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { SubmitAvailabilityDto } from './dto/submit-availability.dto';

interface AvailabilitySlotData {
  start_time: string;
  end_time: string;
  user_id: string;
}

interface SlotMapValue {
  availableCount: Set<string>;
  startTime: string;
  endTime: string;
}

interface HeatmapSlot {
  startTime: string;
  endTime: string;
  availableCount: number;
  totalMembers: number;
  intensity: number; // 0-1, where 1 = 100% of members available
}

interface HeatmapResponse {
  circleId: string;
  totalMembers: number;
  totalWithAvailability: number;
  slots: HeatmapSlot[];
  generatedAt: string;
}

@Injectable()
export class AvailabilityService {
  constructor(private supabaseService: SupabaseService) {}

  /**
   * Submit availability slots for a user in a circle
   */
  async submitAvailability(
    user: User,
    submitAvailabilityDto: SubmitAvailabilityDto,
  ) {
    const supabase = this.supabaseService.getClient();
    const { circleId, availableSlots } = submitAvailabilityDto;

    // Verify user is a member of the circle
    const { data: membership, error: membershipError } = await supabase
      .from('circle_members')
      .select('id')
      .eq('circle_id', circleId)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      throw new BadRequestException(
        'You must be a member of this circle to submit availability',
      );
    }

    // Validate slots
    if (!availableSlots || availableSlots.length === 0) {
      throw new BadRequestException(
        'At least one availability slot must be provided',
      );
    }

    // Remove old availability for this user in this circle
    await supabase
      .from('user_availability')
      .delete()
      .eq('circle_id', circleId)
      .eq('user_id', user.id);

    // Insert new availability slots
    const slotsToInsert = availableSlots.map((slot) => ({
      circle_id: circleId,
      user_id: user.id,
      start_time: slot.startTime,
      end_time: slot.endTime,
    }));

    const { error: insertError } = await supabase
      .from('user_availability')
      .insert(slotsToInsert);

    if (insertError) {
      throw new InternalServerErrorException(
        `Failed to submit availability: ${insertError.message}`,
      );
    }

    return {
      success: true,
      message: 'Availability submitted successfully',
      slotsCount: availableSlots.length,
    };
  }

  /**
   * Get aggregated heatmap data for a circle showing when members are available
   */
  async getCircleHeatmap(
    circleId: string,
    userId: string,
  ): Promise<HeatmapResponse> {
    const supabase = this.supabaseService.getClient();

    // Verify user is a member of the circle
    const { data: membership, error: membershipError } = await supabase
      .from('circle_members')
      .select('id')
      .eq('circle_id', circleId)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership) {
      throw new BadRequestException(
        'You must be a member of this circle to view availability',
      );
    }

    // Get total members in circle
    const { count: totalMembers, error: countError } = await supabase
      .from('circle_members')
      .select('*', { count: 'exact', head: true })
      .eq('circle_id', circleId);

    if (countError) {
      throw new InternalServerErrorException(
        `Failed to fetch circle members: ${countError.message}`,
      );
    }

    // Get all availability slots for this circle
    const { data: availability, error: availabilityError } = await supabase
      .from('user_availability')
      .select('start_time, end_time, user_id')
      .eq('circle_id', circleId)
      .order('start_time', { ascending: true });

    if (availabilityError) {
      throw new InternalServerErrorException(
        `Failed to fetch availability data: ${availabilityError.message}`,
      );
    }

    // Aggregate slots by time window and count availability
    const slotsMap = new Map<string, SlotMapValue>();

    (availability || []).forEach((slot: AvailabilitySlotData) => {
      const key = `${slot.start_time}-${slot.end_time}`;
      if (!slotsMap.has(key)) {
        slotsMap.set(key, {
          startTime: slot.start_time,
          endTime: slot.end_time,
          availableCount: new Set(),
        });
      }
      slotsMap.get(key)!.availableCount.add(slot.user_id);
    });

    // Convert map to array of heatmap slots, sorted by time
    const slots: HeatmapSlot[] = Array.from(slotsMap.values())
      .map((slot) => {
        const availableCount = slot.availableCount.size;
        return {
          startTime: slot.startTime,
          endTime: slot.endTime,
          availableCount,
          totalMembers: totalMembers || 0,
          intensity: totalMembers ? availableCount / totalMembers : 0,
        };
      })
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );

    // Count members who have submitted any availability
    const memberIds = new Set<string>();
    Array.from(slotsMap.values()).forEach((slot) => {
      slot.availableCount.forEach((uid) => memberIds.add(uid));
    });
    const membersWithAvailability = memberIds.size;

    return {
      circleId,
      totalMembers: totalMembers || 0,
      totalWithAvailability: membersWithAvailability,
      slots,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get user's own availability for a circle
   */
  async getUserAvailability(user: User, circleId: string) {
    const supabase = this.supabaseService.getClient();

    // Verify user is a member of the circle
    const { data: membership, error: membershipError } = await supabase
      .from('circle_members')
      .select('id')
      .eq('circle_id', circleId)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      throw new BadRequestException('You must be a member of this circle');
    }

    // Get user's availability slots
    const { data: availability, error } = await supabase
      .from('user_availability')
      .select('start_time, end_time')
      .eq('circle_id', circleId)
      .eq('user_id', user.id)
      .order('start_time', { ascending: true });

    if (error) {
      throw new InternalServerErrorException(
        `Failed to fetch availability: ${error.message}`,
      );
    }

    return {
      circleId,
      availableSlots: (availability || []).map(
        (slot: AvailabilitySlotData) => ({
          startTime: slot.start_time,
          endTime: slot.end_time,
        }),
      ),
    };
  }
}
