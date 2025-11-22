import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateCircleDto } from './dto/create-circle.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { RespondInvitationDto, InvitationResponse } from './dto/respond-invitation.dto';
import { SearchUsersDto } from './dto/search-users.dto';

@Injectable()
export class CirclesService {
  constructor(private supabaseService: SupabaseService) {}

  async createCircle(user: User, createCircleDto: CreateCircleDto) {
    const supabase = this.supabaseService.getClient();

    const { data: circle, error } = await supabase
      .from('circles')
      .insert({
        name: createCircleDto.name,
        description: createCircleDto.description || null,
        owner_id: user.id,
      })
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(
        `Failed to create circle: ${error.message}`,
      );
    }

    // The trigger will automatically add the owner to circle_members
    // Let's fetch the circle with member count
    return this.getCircleWithDetails(circle.id, user.id);
  }

  async getUserCircles(userId: string) {
    const supabase = this.supabaseService.getClient();

    // Get circles where user is owner
    const { data: ownedCircles, error: ownedError } = await supabase
      .from('circles')
      .select(
        `
        *,
        owner:users!circles_owner_id_fkey(id, display_name, first_name, last_name)
      `,
      )
      .eq('owner_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (ownedError) {
      throw new InternalServerErrorException(
        `Failed to fetch owned circles: ${ownedError.message}`,
      );
    }

    // Get circles where user is a member (but not owner)
    // Note: Can't use order() with relationship fields, so we'll sort in JavaScript
    const { data: memberCircles, error: memberError } = await supabase
      .from('circle_members')
      .select(
        `
        circle:circles!inner(
          *,
          owner:users!circles_owner_id_fkey(id, display_name, first_name, last_name)
        )
      `,
      )
      .eq('user_id', userId)
      .eq('circle.is_active', true);

    if (memberError) {
      throw new InternalServerErrorException(
        `Failed to fetch member circles: ${memberError.message}`,
      );
    }

    // Combine and deduplicate (in case user is both owner and member somehow)
    const circleMap = new Map<string, any>();
    
    (ownedCircles || []).forEach((circle: any) => {
      circleMap.set(circle.id, circle);
    });

    (memberCircles || []).forEach((item: any) => {
      const circle = item?.circle;
      if (circle && circle.id && !circleMap.has(circle.id)) {
        circleMap.set(circle.id, circle);
      }
    });

    const allCircles = Array.from(circleMap.values());

    // Get member counts for each circle
    const circlesWithDetails = await Promise.all(
      allCircles.map(async (circle) => {
        const { count } = await supabase
          .from('circle_members')
          .select('*', { count: 'exact', head: true })
          .eq('circle_id', circle.id);

        return {
          ...circle,
          memberCount: count || 0,
        };
      }),
    );

    // Sort by created_at descending
    return circlesWithDetails.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }

  async getCircleWithDetails(circleId: string, userId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: circle, error } = await supabase
      .from('circles')
      .select(
        `
        *,
        owner:users!circles_owner_id_fkey(id, display_name, first_name, last_name)
      `,
      )
      .eq('id', circleId)
      .eq('is_active', true)
      .single();

    if (error || !circle) {
      throw new NotFoundException('Circle not found');
    }

    // Check if user is a member
    const { data: membership } = await supabase
      .from('circle_members')
      .select('role')
      .eq('circle_id', circleId)
      .eq('user_id', userId)
      .single();

    // Check if user has a pending invitation (allows them to view the circle)
    const { data: pendingInvitation } = await supabase
      .from('circle_invitations')
      .select('id')
      .eq('circle_id', circleId)
      .eq('invitee_id', userId)
      .eq('status', 'pending')
      .single();

    // If user is not a member and has no pending invitation, they don't have access
    if (!membership && !pendingInvitation) {
      throw new NotFoundException('You do not have access to this circle');
    }

    // Get member count
    const { count } = await supabase
      .from('circle_members')
      .select('*', { count: 'exact', head: true })
      .eq('circle_id', circleId);

    return {
      ...circle,
      memberCount: count || 0,
      userRole: membership?.role || null,
      hasPendingInvitation: !!pendingInvitation,
    };
  }

  async getCircleMembers(circleId: string, userId: string) {
    const supabase = this.supabaseService.getClient();

    // Verify user has access to this circle
    const { data: circle } = await supabase
      .from('circles')
      .select('id, owner_id')
      .eq('id', circleId)
      .eq('is_active', true)
      .single();

    if (!circle) {
      throw new NotFoundException('Circle not found');
    }

    // Check if user is owner or member
    const isOwner = circle.owner_id === userId;
    const { data: membership } = await supabase
      .from('circle_members')
      .select('role')
      .eq('circle_id', circleId)
      .eq('user_id', userId)
      .single();

    // Check if user has a pending invitation (allows them to view members)
    const { data: pendingInvitation } = await supabase
      .from('circle_invitations')
      .select('id')
      .eq('circle_id', circleId)
      .eq('invitee_id', userId)
      .eq('status', 'pending')
      .single();

    if (!isOwner && !membership && !pendingInvitation) {
      throw new NotFoundException('You do not have access to this circle');
    }

    // Get all members with user details
    const { data: members, error } = await supabase
      .from('circle_members')
      .select(
        `
        id,
        role,
        joined_at,
        user:users!circle_members_user_id_fkey(
          id,
          display_name,
          first_name,
          last_name,
          email
        )
      `,
      )
      .eq('circle_id', circleId)
      .order('joined_at', { ascending: true });

    if (error) {
      throw new InternalServerErrorException(
        `Failed to fetch members: ${error.message}`,
      );
    }

    // Sort by role: owner first, then admin, then members
    const sortedMembers = (members || []).sort((a, b) => {
      const roleOrder = { owner: 1, admin: 2, member: 3 };
      return (
        (roleOrder[a.role as keyof typeof roleOrder] || 99) -
        (roleOrder[b.role as keyof typeof roleOrder] || 99)
      );
    });

    return sortedMembers;
  }

  async searchUsers(user: User, searchUsersDto: SearchUsersDto) {
    const supabase = this.supabaseService.getClient();

    const query = searchUsersDto.query.toLowerCase().trim();

    if (query.length < 1) {
      return [];
    }

    const { data: users, error } = await supabase
      .from('users')
      .select('id, display_name, first_name, last_name, email')
      .neq('id', user.id) // Exclude current user
      .ilike('display_name', `%${query}%`)
      .limit(20)
      .order('display_name', { ascending: true });

    if (error) {
      throw new InternalServerErrorException(
        `Failed to search users: ${error.message}`,
      );
    }

    return users || [];
  }

  async createInvitation(user: User, createInvitationDto: CreateInvitationDto) {
    const supabase = this.supabaseService.getClient();

    // Verify user is owner or admin of the circle
    const { data: membership, error: membershipError } = await supabase
      .from('circle_members')
      .select('role')
      .eq('circle_id', createInvitationDto.circleId)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      throw new NotFoundException(
        'Circle not found or you do not have permission to invite members',
      );
    }

    if (!['owner', 'admin'].includes(membership.role)) {
      throw new BadRequestException(
        'Only circle owners and admins can invite members',
      );
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('circle_members')
      .select('id')
      .eq('circle_id', createInvitationDto.circleId)
      .eq('user_id', createInvitationDto.inviteeId)
      .single();

    if (existingMember) {
      throw new BadRequestException('User is already a member of this circle');
    }

    // Check if there's already a pending invitation
    const { data: existingInvitation } = await supabase
      .from('circle_invitations')
      .select('id')
      .eq('circle_id', createInvitationDto.circleId)
      .eq('invitee_id', createInvitationDto.inviteeId)
      .eq('status', 'pending')
      .single();

    if (existingInvitation) {
      throw new BadRequestException(
        'A pending invitation already exists for this user',
      );
    }

    // Create invitation
    const { data: invitation, error } = await supabase
      .from('circle_invitations')
      .insert({
        circle_id: createInvitationDto.circleId,
        inviter_id: user.id,
        invitee_id: createInvitationDto.inviteeId,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(
        `Failed to create invitation: ${error.message}`,
      );
    }

    return invitation;
  }

  async getPendingInvitations(userId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: invitations, error } = await supabase
      .from('circle_invitations')
      .select(
        `
        *,
        circle:circles!inner(id, name, description),
        inviter:users!circle_invitations_inviter_id_fkey(id, display_name, first_name, last_name)
      `,
      )
      .eq('invitee_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(
        `Failed to fetch invitations: ${error.message}`,
      );
    }

    return invitations || [];
  }

  async getCirclePendingInvitations(circleId: string, userId: string) {
    const supabase = this.supabaseService.getClient();

    // Verify user has access to this circle
    const { data: circle } = await supabase
      .from('circles')
      .select('id, owner_id')
      .eq('id', circleId)
      .eq('is_active', true)
      .single();

    if (!circle) {
      throw new NotFoundException('Circle not found');
    }

    // Check if user is owner or member
    const isOwner = circle.owner_id === userId;
    const { data: membership } = await supabase
      .from('circle_members')
      .select('role')
      .eq('circle_id', circleId)
      .eq('user_id', userId)
      .single();

    // Check if user has a pending invitation (allows them to view pending invitations)
    const { data: pendingInvitation } = await supabase
      .from('circle_invitations')
      .select('id')
      .eq('circle_id', circleId)
      .eq('invitee_id', userId)
      .eq('status', 'pending')
      .single();

    if (!isOwner && !membership && !pendingInvitation) {
      throw new NotFoundException('You do not have access to this circle');
    }

    // Get pending invitations for this circle
    const { data: invitations, error } = await supabase
      .from('circle_invitations')
      .select(
        `
        id,
        created_at,
        invitee:users!circle_invitations_invitee_id_fkey(
          id,
          display_name,
          first_name,
          last_name,
          email
        ),
        inviter:users!circle_invitations_inviter_id_fkey(
          id,
          display_name,
          first_name,
          last_name
        )
      `,
      )
      .eq('circle_id', circleId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(
        `Failed to fetch pending invitations: ${error.message}`,
      );
    }

    return invitations || [];
  }

  async respondToInvitation(
    user: User,
    respondInvitationDto: RespondInvitationDto,
  ) {
    const supabase = this.supabaseService.getClient();

    // Get the invitation
    const { data: invitation, error: invitationError } = await supabase
      .from('circle_invitations')
      .select('*')
      .eq('id', respondInvitationDto.invitationId)
      .eq('invitee_id', user.id)
      .eq('status', 'pending')
      .single();

    if (invitationError || !invitation) {
      throw new NotFoundException('Invitation not found or already responded');
    }

    const newStatus =
      respondInvitationDto.response === InvitationResponse.ACCEPT
        ? 'accepted'
        : 'declined';

    // Update invitation status
    const { error: updateError } = await supabase
      .from('circle_invitations')
      .update({
        status: newStatus,
        responded_at: new Date().toISOString(),
      })
      .eq('id', respondInvitationDto.invitationId);

    if (updateError) {
      throw new InternalServerErrorException(
        `Failed to update invitation: ${updateError.message}`,
      );
    }

    // If accepted, add user to circle_members
    if (respondInvitationDto.response === InvitationResponse.ACCEPT) {
      const { error: memberError } = await supabase
        .from('circle_members')
        .insert({
          circle_id: invitation.circle_id,
          user_id: user.id,
          role: 'member',
        });

      if (memberError) {
        // If adding member fails, revert invitation status
        await supabase
          .from('circle_invitations')
          .update({ status: 'pending', responded_at: null })
          .eq('id', respondInvitationDto.invitationId);

        throw new InternalServerErrorException(
          `Failed to add member to circle: ${memberError.message}`,
        );
      }
    }

    return {
      success: true,
      status: newStatus,
    };
  }
}

