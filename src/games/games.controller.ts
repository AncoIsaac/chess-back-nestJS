import { Controller, Get, Post, Param, Body, Delete } from '@nestjs/common';
import { GamesService } from './games.service';
import { CreateGameDto } from './dto/create-game.dto';
import { joinGameDto } from './dto/join-gmae.dto';

@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) { }

  @Get()
  async getAllGame() {
    return this.gamesService.getAllGame()
  }

  @Get(':id')
  async getGameState(@Param('id') id: string) {
    return this.gamesService.getGameState(id);
  }

  @Post('joinGame')
  async joinGame(@Body() id: CreateGameDto) {
    return this.gamesService.joinGame(id);
  }

  @Delete(':id')
  async deleteGame(@Param('id') id: string) {
    return this.gamesService.deleteGame(id);
  }
}
