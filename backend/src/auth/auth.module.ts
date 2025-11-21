import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthGuard, AuthService],
  exports: [AuthGuard],
})
export class AuthModule {}
