import { Module } from '@nestjs/common';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { GameGateway } from './game.gateway';

@Module({
  imports: [PrismaModule],
  controllers: [GamesController],
  providers: [GamesService, GameGateway],
})
export class GamesModule {}
