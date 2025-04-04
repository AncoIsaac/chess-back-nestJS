import { Module } from '@nestjs/common';
import { GamesModule } from './games/games.module';
import { PrismaService } from './prisma/prisma.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [GamesModule, PrismaModule, UsersModule, AuthModule],
  controllers: [],
  providers: [PrismaService],
})
export class AppModule {}
