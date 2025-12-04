import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateExpenseDto, SplitType } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(private supabaseService: SupabaseService) {}

  // Helper method to verify event exists and user has RSVP'd
  private async verifyEventAccess(eventId: string, userId: string) {
    const supabase = this.supabaseService.getClient();

    // Verify event exists
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, circle_id')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      throw new NotFoundException('Event not found');
    }

    // Verify user has RSVP'd to the event
    const { data: rsvp } = await supabase
      .from('event_rsvps')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .single();

    if (!rsvp) {
      throw new BadRequestException(
        'You must RSVP to this event before creating or viewing expenses',
      );
    }

    return event;
  }

  // Helper method to get event RSVPs
  private async getEventRSVPs(eventId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: rsvps, error } = await supabase
      .from('event_rsvps')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('status', 'going');

    if (error) {
      throw new InternalServerErrorException(
        `Failed to fetch event RSVPs: ${error.message}`,
      );
    }

    return rsvps || [];
  }

  // Calculate expense splits based on split type
  private calculateSplits(
    amount: number,
    splitType: SplitType,
    attendeeIds: string[],
    paidBy: string,
    customSplits?: { user_id: string; amount_owed: number }[],
  ): { user_id: string; amount_owed: number }[] {
    if (attendeeIds.length === 0) {
      throw new BadRequestException('At least one attendee must be selected');
    }

    switch (splitType) {
      case SplitType.EQUAL:
        const equalAmount = amount / attendeeIds.length;
        return attendeeIds.map((userId) => ({
          user_id: userId,
          amount_owed: Math.round(equalAmount * 100) / 100, // Round to 2 decimal places
        }));

      case SplitType.INDIVIDUAL:
        // For individual split, each person pays their own amount
        // This requires custom_splits to be provided
        if (!customSplits || customSplits.length === 0) {
          throw new BadRequestException(
            'Individual split requires custom_splits to be provided',
          );
        }
        // Validate that all custom splits sum to the total amount
        const total = customSplits.reduce(
          (sum, split) => sum + split.amount_owed,
          0,
        );
        if (Math.abs(total - amount) > 0.01) {
          throw new BadRequestException(
            `Custom splits must sum to ${amount}, got ${total}`,
          );
        }
        return customSplits;

      case SplitType.CUSTOM:
        if (!customSplits || customSplits.length === 0) {
          throw new BadRequestException(
            'Custom split requires custom_splits to be provided',
          );
        }
        // Validate that all custom splits sum to the total amount
        const customTotal = customSplits.reduce(
          (sum, split) => sum + split.amount_owed,
          0,
        );
        if (Math.abs(customTotal - amount) > 0.01) {
          throw new BadRequestException(
            `Custom splits must sum to ${amount}, got ${customTotal}`,
          );
        }
        // Validate all attendee_ids are in custom_splits
        const customUserIds = customSplits.map((s) => s.user_id);
        const missingUsers = attendeeIds.filter(
          (id) => !customUserIds.includes(id),
        );
        if (missingUsers.length > 0) {
          throw new BadRequestException(
            `All selected attendees must have a split amount. Missing: ${missingUsers.join(', ')}`,
          );
        }
        return customSplits;

      default:
        throw new BadRequestException(`Invalid split type: ${splitType}`);
    }
  }

  async createExpense(
    user: User,
    eventId: string,
    createExpenseDto: CreateExpenseDto,
  ) {
    const supabase = this.supabaseService.getClient();

    // Verify event access
    await this.verifyEventAccess(eventId, user.id);

    // Verify paid_by is the current user
    if (createExpenseDto.paid_by !== user.id) {
      throw new BadRequestException(
        'You can only create expenses paid by yourself',
      );
    }

    // Get event RSVPs to validate attendee_ids
    const rsvps = await this.getEventRSVPs(eventId);
    const rsvpUserIds = rsvps.map((r) => r.user_id);

    // Validate all attendee_ids are in the RSVP list
    const invalidAttendees = createExpenseDto.attendee_ids.filter(
      (id) => !rsvpUserIds.includes(id),
    );
    if (invalidAttendees.length > 0) {
      throw new BadRequestException(
        `Selected attendees must have RSVP'd to the event. Invalid: ${invalidAttendees.join(', ')}`,
      );
    }

    // Validate paid_by is in attendee_ids
    if (!createExpenseDto.attendee_ids.includes(createExpenseDto.paid_by)) {
      throw new BadRequestException(
        'The person who paid must be included in the attendees list',
      );
    }

    // Calculate splits
    const splits = this.calculateSplits(
      createExpenseDto.amount,
      createExpenseDto.split_type,
      createExpenseDto.attendee_ids,
      createExpenseDto.paid_by,
      createExpenseDto.custom_splits,
    );

    // Create expense and splits in a transaction
    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .insert({
        event_id: eventId,
        title: createExpenseDto.title,
        amount: createExpenseDto.amount,
        paid_by: createExpenseDto.paid_by,
        split_type: createExpenseDto.split_type,
        description: createExpenseDto.description || null,
      })
      .select()
      .single();

    if (expenseError) {
      throw new InternalServerErrorException(
        `Failed to create expense: ${expenseError.message}`,
      );
    }

    // Create expense splits
    const splitsToInsert = splits.map((split) => ({
      expense_id: expense.id,
      user_id: split.user_id,
      amount_owed: split.amount_owed,
    }));

    const { error: splitsError } = await supabase
      .from('expense_splits')
      .insert(splitsToInsert);

    if (splitsError) {
      // If splits fail, we should ideally rollback the expense
      // For now, we'll delete the expense
      await supabase.from('expenses').delete().eq('id', expense.id);
      throw new InternalServerErrorException(
        `Failed to create expense splits: ${splitsError.message}`,
      );
    }

    // Fetch the complete expense with splits
    return await this.getExpense(expense.id, user.id);
  }

  async getEventExpenses(eventId: string, userId: string) {
    const supabase = this.supabaseService.getClient();

    // Verify event access
    await this.verifyEventAccess(eventId, userId);

    // Fetch expenses with related data
    const { data: expenses, error } = await supabase
      .from('expenses')
      .select(
        `
        *,
        paid_by_user:users!expenses_paid_by_fkey(
          id,
          display_name,
          first_name,
          last_name
        )
      `,
      )
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(
        `Failed to fetch expenses: ${error.message}`,
      );
    }

    // Fetch splits for each expense
    const expensesWithSplits = await Promise.all(
      (expenses || []).map(async (expense) => {
        const { data: splits } = await supabase
          .from('expense_splits')
          .select(
            `
            *,
            user:users!expense_splits_user_id_fkey(
              id,
              display_name,
              first_name,
              last_name
            )
          `,
          )
          .eq('expense_id', expense.id);

        return {
          ...expense,
          splits: splits || [],
        };
      }),
    );

    return expensesWithSplits;
  }

  async getExpense(expenseId: string, userId: string) {
    const supabase = this.supabaseService.getClient();

    // Fetch expense
    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .select(
        `
        *,
        paid_by_user:users!expenses_paid_by_fkey(
          id,
          display_name,
          first_name,
          last_name
        )
      `,
      )
      .eq('id', expenseId)
      .single();

    if (expenseError || !expense) {
      throw new NotFoundException('Expense not found');
    }

    // Verify event access
    await this.verifyEventAccess(expense.event_id, userId);

    // Fetch splits
    const { data: splits, error: splitsError } = await supabase
      .from('expense_splits')
      .select(
        `
        *,
        user:users!expense_splits_user_id_fkey(
          id,
          display_name,
          first_name,
          last_name
        )
      `,
      )
      .eq('expense_id', expenseId);

    if (splitsError) {
      throw new InternalServerErrorException(
        `Failed to fetch expense splits: ${splitsError.message}`,
      );
    }

    return {
      ...expense,
      splits: splits || [],
    };
  }

  async updateExpense(
    user: User,
    expenseId: string,
    updateExpenseDto: UpdateExpenseDto,
  ) {
    const supabase = this.supabaseService.getClient();

    // Fetch expense to verify ownership
    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .select('id, event_id, paid_by, amount, split_type')
      .eq('id', expenseId)
      .single();

    if (expenseError || !expense) {
      throw new NotFoundException('Expense not found');
    }

    // Verify user is the creator
    if (expense.paid_by !== user.id) {
      throw new BadRequestException(
        'You can only update expenses that you created',
      );
    }

    // Verify event access
    await this.verifyEventAccess(expense.event_id, user.id);

    // If amount or split-related fields are being updated, recalculate splits
    const needsRecalculation =
      updateExpenseDto.amount !== undefined ||
      updateExpenseDto.split_type !== undefined ||
      updateExpenseDto.attendee_ids !== undefined ||
      updateExpenseDto.custom_splits !== undefined;

    if (needsRecalculation) {
      // Get current expense data or use update values
      const finalAmount =
        updateExpenseDto.amount !== undefined
          ? updateExpenseDto.amount
          : expense.amount;
      const finalSplitType =
        updateExpenseDto.split_type !== undefined
          ? updateExpenseDto.split_type
          : expense.split_type;
      let finalAttendeeIds: string[];
      if (updateExpenseDto.attendee_ids !== undefined) {
        finalAttendeeIds = updateExpenseDto.attendee_ids;
      } else {
        const { data } = await supabase
          .from('expense_splits')
          .select('user_id')
          .eq('expense_id', expenseId);
        finalAttendeeIds = data?.map((s) => s.user_id) || [];
      }
      const finalPaidBy =
        updateExpenseDto.paid_by !== undefined
          ? updateExpenseDto.paid_by
          : expense.paid_by;

      // Validate paid_by is current user
      if (finalPaidBy !== user.id) {
        throw new BadRequestException(
          'You can only update expenses paid by yourself',
        );
      }

      // Get event RSVPs
      const rsvps = await this.getEventRSVPs(expense.event_id);
      const rsvpUserIds = rsvps.map((r) => r.user_id);

      // Validate attendee_ids
      const invalidAttendees = finalAttendeeIds.filter(
        (id) => !rsvpUserIds.includes(id),
      );
      if (invalidAttendees.length > 0) {
        throw new BadRequestException(
          `Selected attendees must have RSVP'd to the event. Invalid: ${invalidAttendees.join(', ')}`,
        );
      }

      // Calculate new splits
      const splits = this.calculateSplits(
        finalAmount,
        finalSplitType,
        finalAttendeeIds,
        finalPaidBy,
        updateExpenseDto.custom_splits,
      );

      // Update expense
      const { error: updateError } = await supabase
        .from('expenses')
        .update({
          ...(updateExpenseDto.title && { title: updateExpenseDto.title }),
          ...(updateExpenseDto.amount !== undefined && {
            amount: updateExpenseDto.amount,
          }),
          ...(updateExpenseDto.paid_by && {
            paid_by: updateExpenseDto.paid_by,
          }),
          ...(updateExpenseDto.split_type && {
            split_type: updateExpenseDto.split_type,
          }),
          ...(updateExpenseDto.description !== undefined && {
            description: updateExpenseDto.description,
          }),
        })
        .eq('id', expenseId);

      if (updateError) {
        throw new InternalServerErrorException(
          `Failed to update expense: ${updateError.message}`,
        );
      }

      // Delete old splits and create new ones
      await supabase
        .from('expense_splits')
        .delete()
        .eq('expense_id', expenseId);

      const splitsToInsert = splits.map((split) => ({
        expense_id: expenseId,
        user_id: split.user_id,
        amount_owed: split.amount_owed,
      }));

      const { error: splitsError } = await supabase
        .from('expense_splits')
        .insert(splitsToInsert);

      if (splitsError) {
        throw new InternalServerErrorException(
          `Failed to update expense splits: ${splitsError.message}`,
        );
      }
    } else {
      // Simple update without recalculating splits
      const { error: updateError } = await supabase
        .from('expenses')
        .update({
          ...(updateExpenseDto.title && { title: updateExpenseDto.title }),
          ...(updateExpenseDto.description !== undefined && {
            description: updateExpenseDto.description,
          }),
        })
        .eq('id', expenseId);

      if (updateError) {
        throw new InternalServerErrorException(
          `Failed to update expense: ${updateError.message}`,
        );
      }
    }

    return await this.getExpense(expenseId, user.id);
  }

  async deleteExpense(user: User, expenseId: string) {
    const supabase = this.supabaseService.getClient();

    // Fetch expense to verify ownership
    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .select('id, paid_by')
      .eq('id', expenseId)
      .single();

    if (expenseError || !expense) {
      throw new NotFoundException('Expense not found');
    }

    // Verify user is the creator
    if (expense.paid_by !== user.id) {
      throw new BadRequestException(
        'You can only delete expenses that you created',
      );
    }

    // Delete expense (splits will be deleted automatically due to CASCADE)
    const { error: deleteError } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId);

    if (deleteError) {
      throw new InternalServerErrorException(
        `Failed to delete expense: ${deleteError.message}`,
      );
    }

    return { message: 'Expense deleted successfully' };
  }

  async getExpenseSummary(eventId: string, userId: string) {
    const supabase = this.supabaseService.getClient();

    // Verify event access
    await this.verifyEventAccess(eventId, userId);

    // Get all expenses for the event
    const expenses = await this.getEventExpenses(eventId, userId);

    // Calculate summary
    const summary: {
      total_expenses: number;
      balances: { user_id: string; owed: number; paid: number; net: number }[];
    } = {
      total_expenses: 0,
      balances: [],
    };

    const userBalances = new Map<
      string,
      { owed: number; paid: number; net: number }
    >();

    // Calculate balances
    expenses.forEach((expense) => {
      summary.total_expenses += expense.amount;

      // Track what the payer paid
      const payerId = expense.paid_by;
      if (!userBalances.has(payerId)) {
        userBalances.set(payerId, { owed: 0, paid: 0, net: 0 });
      }
      const payerBalance = userBalances.get(payerId)!;
      payerBalance.paid += expense.amount;
      payerBalance.net += expense.amount;

      // Track what each person owes
      expense.splits.forEach((split: any) => {
        const splitUserId = split.user_id;
        if (!userBalances.has(splitUserId)) {
          userBalances.set(splitUserId, { owed: 0, paid: 0, net: 0 });
        }
        const userBalance = userBalances.get(splitUserId)!;
        userBalance.owed += split.amount_owed;
        userBalance.net -= split.amount_owed;

        // If the person who owes is also the payer, adjust net
        if (splitUserId === payerId) {
          userBalance.net += split.amount_owed;
        }
      });
    });

    // Convert map to array
    summary.balances = Array.from(userBalances.entries()).map(
      ([user_id, balance]) => ({
        user_id,
        ...balance,
      }),
    );

    return summary;
  }
}
