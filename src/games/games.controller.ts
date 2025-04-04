import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { GamesService } from './games.service';
import { CreateGameDto } from './dto/create-game.dto';
import { joinGameDto } from './dto/join-gmae.dto';

@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Post()
  async create(@Body() data: CreateGameDto) {
    return this.gamesService.createGame(data);
  }

  @Get(':id')
  async getGameState(@Param('id') id: string) {
    return this.gamesService.getGameState(id);
  }

  @Post('joinGame')
  async joinGame(@Body() data: joinGameDto) {
    return this.gamesService.joinGame(data);
  }
}
