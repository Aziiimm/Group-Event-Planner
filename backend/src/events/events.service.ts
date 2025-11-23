import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateEventDto } from './dto/create-event.dto';
import { RSVPDto, RSVPStatus } from './dto/rsvp.dto';

@Injectable()
export class EventsService {
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

  async createEvent(
    user: User,
    circleId: string,
    createEventDto: CreateEventDto,
  ) {
    const supabase = this.supabaseService.getClient();

    // Verify user is a member of the circle
    await this.verifyCircleMembership(circleId, user.id);

    // Create the event
    const { data: event, error } = await supabase
      .from('events')
      .insert({
        circle_id: circleId,
        host_id: user.id,
        title: createEventDto.title,
        date_time: createEventDto.date_time,
        location: createEventDto.location,
        description: createEventDto.description || null,
        status: 'upcoming',
      })
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(
        `Failed to create event: ${error.message}`,
      );
    }

    return event;
  }

  async getCircleEvents(circleId: string, userId: string) {
    const supabase = this.supabaseService.getClient();

    // Verify user is a member of the circle
    await this.verifyCircleMembership(circleId, userId);

    // Fetch events for the circle with host information
    const { data: events, error } = await supabase
      .from('events')
      .select(
        `
        *,
        host:users!events_host_id_fkey(
          id,
          display_name,
          first_name,
          last_name
        )
      `,
      )
      .eq('circle_id', circleId)
      .order('date_time', { ascending: true });

    if (error) {
      throw new InternalServerErrorException(
        `Failed to fetch events: ${error.message}`,
      );
    }

    // Compute status on-the-fly: mark as completed if date_time has passed
    const now = new Date();
    const eventsWithComputedStatus = (events || []).map((event) => {
      const eventDate = new Date(event.date_time);
      return {
        ...event,
        status: eventDate < now ? 'completed' : event.status,
      };
    });

    return eventsWithComputedStatus;
  }

  async getEvent(eventId: string, userId: string) {
    const supabase = this.supabaseService.getClient();

    // Fetch the event with host information
    const { data: event, error } = await supabase
      .from('events')
      .select(
        `
        *,
        host:users!events_host_id_fkey(
          id,
          display_name,
          first_name,
          last_name
        )
      `,
      )
      .eq('id', eventId)
      .single();

    if (error || !event) {
      throw new NotFoundException('Event not found');
    }

    // Verify user is a member of the circle that this event belongs to
    await this.verifyCircleMembership(event.circle_id, userId);

    // Compute status on-the-fly: mark as completed if date_time has passed
    const now = new Date();
    const eventDate = new Date(event.date_time);
    const eventWithComputedStatus = {
      ...event,
      status: eventDate < now ? 'completed' : event.status,
    };

    return eventWithComputedStatus;
  }

  async rsvpToEvent(user: User, eventId: string, rsvpDto: RSVPDto) {
    const supabase = this.supabaseService.getClient();

    // Verify event exists and get circle_id
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, circle_id')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      throw new NotFoundException('Event not found');
    }

    // Verify user is a member of the circle that this event belongs to
    await this.verifyCircleMembership(event.circle_id, user.id);

    // Create or update RSVP (upsert based on unique constraint)
    const { data: rsvp, error: rsvpError } = await supabase
      .from('event_rsvps')
      .upsert(
        {
          event_id: eventId,
          user_id: user.id,
          status: rsvpDto.status,
        },
        {
          onConflict: 'event_id,user_id',
        },
      )
      .select()
      .single();

    if (rsvpError) {
      throw new InternalServerErrorException(
        `Failed to RSVP to event: ${rsvpError.message}`,
      );
    }

    return rsvp;
  }

  async getEventRSVPs(eventId: string, userId: string) {
    const supabase = this.supabaseService.getClient();

    // Verify event exists and get circle_id
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, circle_id')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      throw new NotFoundException('Event not found');
    }

    // Verify user is a member of the circle that this event belongs to
    await this.verifyCircleMembership(event.circle_id, userId);

    // Fetch all RSVPs for the event with user information
    const { data: rsvps, error: rsvpsError } = await supabase
      .from('event_rsvps')
      .select(
        `
        *,
        user:users!event_rsvps_user_id_fkey(
          id,
          display_name,
          first_name,
          last_name
        )
      `,
      )
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (rsvpsError) {
      throw new InternalServerErrorException(
        `Failed to fetch RSVPs: ${rsvpsError.message}`,
      );
    }

    return rsvps || [];
  }
}
