import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(private supabaseService: SupabaseService) {}

  async signup(signupDto: SignupDto) {
    const { email, password, displayName, firstName, lastName } = signupDto;

    // Format fields before storing
    const formattedEmail = email.toLowerCase().trim();
    const formattedDisplayName = displayName.toLowerCase().trim();
    const formattedFirstName = this.capitalizeFirstLetter(firstName.trim());
    const formattedLastName = this.capitalizeFirstLetter(lastName.trim());

    // Check if display_name already exists (case-insensitive)
    const lowercasedDisplayName = formattedDisplayName;
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
      email: formattedEmail,
      password,
      options: {
        data: {
          display_name: formattedDisplayName,
          first_name: formattedFirstName,
          last_name: formattedLastName,
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
      email: formattedEmail,
      display_name: formattedDisplayName,
      first_name: formattedFirstName,
      last_name: formattedLastName,
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

  async login(loginDto: LoginDto) {
    const { identifier, password } = loginDto;
    const supabase = this.supabaseService.getClient();

    // Normalize identifier (lowercase and trim)
    const normalizedIdentifier = identifier.toLowerCase().trim();

    // Determine if identifier is an email (contains @) or display_name
    const isEmail = normalizedIdentifier.includes('@');
    let userEmail: string;

    if (isEmail) {
      // Identifier is an email, use it directly
      userEmail = normalizedIdentifier;
    } else {
      // Identifier is a display_name, look up the user's email
      // Fetch all users and check for case-insensitive match
      const { data: users, error: lookupError } = await supabase
        .from('users')
        .select('email, display_name');

      if (lookupError) {
        throw new InternalServerErrorException('Error looking up user');
      }

      // Find user with matching display_name (case-insensitive)
      const user = users?.find(
        (u) => u.display_name?.toLowerCase() === normalizedIdentifier,
      );

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      userEmail = user.email;
    }

    // Sign in with Supabase Auth using the email
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: userEmail,
        password,
      });

    if (authError || !authData.user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last_login in public.users table
    const now = new Date().toISOString();
    const { error: dbError } = await supabase
      .from('users')
      .update({ last_login: now })
      .eq('id', authData.user.id);

    if (dbError) {
      console.error('Error updating last_login:', dbError);
      // Don't fail the login if last_login update fails, just log it
    }

    return {
      user: authData.user,
      session: authData.session,
    };
  }

  /**
   * Capitalizes the first letter of a string
   * @param str - The string to capitalize
   * @returns The string with first letter capitalized, rest lowercase
   */
  private capitalizeFirstLetter(str: string): string {
    if (!str || str.length === 0) {
      return str;
    }
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
}

