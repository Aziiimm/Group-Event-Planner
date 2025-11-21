import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(private supabaseService: SupabaseService) {}

  async signup(signupDto: SignupDto) {
    const { email, password, displayName, firstName, lastName } = signupDto;

    // Check if display_name already exists (case-insensitive)
    const lowercasedDisplayName = displayName.toLowerCase();
    const supabase = this.supabaseService.getClient();

    // Fetch all users and check for case-insensitive duplicate
    // Note: For better performance at scale, consider adding a database function or index
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('display_name');

    if (checkError) {
      throw new InternalServerErrorException(
        'Error checking display name availability',
      );
    }

    // Check if any existing user has the same display_name (case-insensitive)
    const duplicateExists = existingUsers?.some(
      (user) => user.display_name?.toLowerCase() === lowercasedDisplayName,
    );

    if (duplicateExists) {
      throw new ConflictException(
        'This display name is already taken. Please choose a different name.',
      );
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          first_name: firstName,
          last_name: lastName,
        },
      },
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        throw new ConflictException('An account with this email already exists.');
      }
      throw new BadRequestException(authError.message);
    }

    if (!authData.user) {
      throw new InternalServerErrorException('Failed to create user account');
    }

    // Create user profile in public.users table
    const now = new Date().toISOString();
    const { error: dbError } = await supabase.from('users').insert({
      id: authData.user.id,
      email: email,
      display_name: displayName,
      first_name: firstName,
      last_name: lastName,
      created_at: now,
      last_login: now,
    });

    if (dbError) {
      // If profile creation fails, we should clean up the auth user
      // However, Supabase doesn't provide a direct way to delete users from service role
      // This is a known limitation - in production, you might want to use a database trigger
      // or handle this via Supabase dashboard/admin API
      console.error('Error creating user profile:', dbError);
      throw new InternalServerErrorException(
        'Account created but profile setup failed. Please contact support.',
      );
    }

    return {
      user: authData.user,
      session: authData.session,
    };
  }
}

