import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { AvailabilityService } from './availability.service';
import { AvailabilityController } from './availability.controller';

@Module({
  imports: [SupabaseModule],
  providers: [AvailabilityService],
  controllers: [AvailabilityController],
})
export class AvailabilityModule {}
