import { Controller, Get, Post, Param, Delete } from '@nestjs/common';
import { GamesService } from './games.service';

@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Post()
  async create() {
    return this.gamesService.createGame();
  }

  @Get(':id')
  async getGameState(@Param('id') id: string) {
    return this.gamesService.getGameState(id);
  }
}
