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

    // Normalize inputs
    const formattedEmail = email.toLowerCase().trim();
    const formattedDisplayName = displayName.toLowerCase().trim();
    const formattedFirstName = this.capitalizeFirstLetter(firstName.trim());
    const formattedLastName = this.capitalizeFirstLetter(lastName.trim());

    const supabase = this.supabaseService.getClient();

    // Check for duplicate display_name
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('display_name');

    if (checkError) {
      throw new InternalServerErrorException(
        'Error checking display name availability',
      );
    }

    const duplicateExists = existingUsers?.some(
      (user) => user.display_name?.toLowerCase() === formattedDisplayName,
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
        throw new ConflictException(
          'An account with this email already exists.',
        );
      }
      throw new BadRequestException(authError.message);
    }

    if (!authData.user) {
      throw new InternalServerErrorException('Failed to create user account');
    }

    // Insert user into database
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

    // Correct clients
    const supabaseService = this.supabaseService.getClient(); // service role
    const supabaseAnon = this.supabaseService.getAnonClient(); // anon

    const normalizedIdentifier = identifier.toLowerCase().trim();
    const isEmail = normalizedIdentifier.includes('@');

    let userEmail: string;

    if (isEmail) {
      userEmail = normalizedIdentifier;
    } else {
      // Lookup by display_name
      const { data: users, error: lookupError } = await supabaseService
        .from('users')
        .select('email, display_name');

      if (lookupError) {
        throw new InternalServerErrorException('Error looking up user');
      }

      const user = users?.find(
        (u) => u.display_name?.toLowerCase() === normalizedIdentifier,
      );

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      userEmail = user.email;
    }

    // Sign in through anonymous Supabase client
    const { data: authData, error: authError } =
      await supabaseAnon.auth.signInWithPassword({
        email: userEmail,
        password,
      });

    if (authError || !authData.user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last_login using service role client
    const now = new Date().toISOString();
    const { error: dbError } = await supabaseService
      .from('users')
      .update({ last_login: now })
      .eq('id', authData.user.id);

    if (dbError) {
      console.error('Error updating last_login:', dbError);
    }

    return {
      user: authData.user,
      session: authData.session,
    };
  }

  private capitalizeFirstLetter(str: string): string {
    if (!str || str.length === 0) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
}
