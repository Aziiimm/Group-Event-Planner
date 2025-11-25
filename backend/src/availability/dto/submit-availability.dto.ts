import { IsString, IsArray, IsDateString, IsNotEmpty } from 'class-validator';

/**
 * Represents a user's availability for a given time slot.
 * Each slot is a 1-hour window (e.g., 2 PM - 3 PM on a given day).
 */
export class AvailabilitySlot {
  @IsDateString()
  @IsNotEmpty()
  /**
   * ISO 8601 format: "2025-01-15T14:00:00Z"
   * Represents the start time of the 1-hour availability slot
   */
  startTime: string;

  @IsDateString()
  @IsNotEmpty()
  /**
   * ISO 8601 format: "2025-01-15T15:00:00Z"
   * Represents the end time of the 1-hour availability slot
   */
  endTime: string;
}

export class SubmitAvailabilityDto {
  @IsString()
  @IsNotEmpty()
  circleId: string;

  @IsArray()
  @IsNotEmpty()
  /**
   * Array of available time slots for the user
   */
  availableSlots: AvailabilitySlot[];
}
