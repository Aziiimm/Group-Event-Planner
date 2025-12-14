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
  UseGuards,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Controller('expenses')
@UseGuards(AuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post('event/:eventId')
  @HttpCode(HttpStatus.CREATED)
  async createExpense(
    @CurrentUser() user: User,
    @Param('eventId') eventId: string,
    @Body() createExpenseDto: CreateExpenseDto,
  ) {
    return await this.expensesService.createExpense(
      user,
      eventId,
      createExpenseDto,
    );
  }

  @Get('event/:eventId')
  @HttpCode(HttpStatus.OK)
  async getEventExpenses(
    @CurrentUser() user: User,
    @Param('eventId') eventId: string,
  ) {
    return await this.expensesService.getEventExpenses(eventId, user.id);
  }

  @Get('event/:eventId/summary')
  @HttpCode(HttpStatus.OK)
  async getExpenseSummary(
    @CurrentUser() user: User,
    @Param('eventId') eventId: string,
  ) {
    return await this.expensesService.getExpenseSummary(eventId, user.id);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getExpense(@CurrentUser() user: User, @Param('id') id: string) {
    return await this.expensesService.getExpense(id, user.id);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updateExpense(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() updateExpenseDto: UpdateExpenseDto,
  ) {
    return await this.expensesService.updateExpense(user, id, updateExpenseDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteExpense(@CurrentUser() user: User, @Param('id') id: string) {
    return await this.expensesService.deleteExpense(user, id);
  }
}
