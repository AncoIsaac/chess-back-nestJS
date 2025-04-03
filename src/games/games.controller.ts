// games.controller.ts
import { Controller, Get, Post, Put, Param, Body } from '@nestjs/common';
import { GamesService } from './games.service';
import { MoveDto } from './dto/move.dto';
import { CreateGameDto } from './dto/create-game.dto';

@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Post()
  async create(@Body() player1Id: CreateGameDto) {
    return this.gamesService.createGame(player1Id);
  }

  @Post(':id/join')
  async joinGame(@Param('id') id: string, @Body() data: CreateGameDto) {
    return this.gamesService.joinGame(id, data);
  }

  @Put(':id/move')
  async makeMove(@Param('id') id: string, @Body() moveDto: MoveDto) {
    return this.gamesService.makeMove(id, moveDto);
  }

  @Get(':id')
  async getGameState(@Param('id') id: string) {
    return this.gamesService.getGameState(id);
  }
}