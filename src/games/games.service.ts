import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { MoveDto } from './dto/move.dto';
import { Chess } from 'chess.js';
import { PrismaService } from 'src/prisma/prisma.service';
import { Game } from '@prisma/client';
import { CreateGameDto } from './dto/create-game.dto';
import { joinGameDto } from './dto/join-gmae.dto';

@Injectable()
export class GamesService {
  constructor(private prisma: PrismaService) {}

  async createGame(data: CreateGameDto): Promise<{
    data: Game;
    message: string;
  }> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: data.firstPlayerId,
      },
    });
    if (!user) {
      throw new HttpException(
        {
          status: HttpStatus.NOT_FOUND,
          error: 'User not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }
    const game = await this.prisma.game.create({
      data: {
        firstPlayerId: data.firstPlayerId,
      },
    });

    return { data: game, message: 'Game created' };
  }

  async joinGame(data: joinGameDto): Promise<{ data: Game; message: string }> {
    const user = await this.prisma.game.findFirst({
      where: {
        firstPlayerId: data.playerId,
      },
    });

    if (user) {
      throw new HttpException(
        {
          status: HttpStatus.NOT_FOUND,
          error: 'User not join game',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const game = await this.prisma.game.update({
      where: { id: data.gameId },
      data: { secondPlayerId: data.playerId },
    });
    return {
      data: game,
      message: 'Game joined',
    };
  }

  async getGameState(gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) throw new Error('Game not found');

    return game;
  }

  async makeMove(gameId: string, moveDto: MoveDto) {
    const gameRecord = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!gameRecord) throw new Error('Game not found');

    const chess = new Chess(gameRecord.fen);
    chess.move(moveDto);

    return this.prisma.game.update({
      where: { id: gameId },
      data: {
        fen: chess.fen(),
        moves: { push: chess.history().pop() },
        status: chess.isGameOver() ? 'FINISHED' : 'IN_PROGRESS',
      },
    });
  }

  // games.service.ts

  async resignGame(gameId: string, resigningPlayerColor: 'w' | 'b') {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game?.firstPlayerId || !game?.secondPlayerId)
      throw new Error('players not found');


    const winner = resigningPlayerColor === 'w' ? 'b' : 'w';

    // Actualizar estadísticas de los jugadores
    await this.updatePlayerStats(
      game.firstPlayerId,
      game.secondPlayerId,
      winner,
    );

    return this.prisma.game.update({
      where: { id: gameId },
      data: {
        status: 'FINISHED',
        fen: new Chess(game.fen).fen(), // When resigning, we keep the current position
      },
    });
  }

  async endGameAsDraw(gameId: string, reason: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });
    if (!game?.firstPlayerId || !game?.secondPlayerId)
      throw new Error('players not found');

    // Actualizar estadísticas de los jugadores (empate)
    await this.updatePlayerStats(game.firstPlayerId, game.secondPlayerId, null);

    return this.prisma.game.update({
      where: { id: gameId },
      data: {
        status: 'FINISHED',
        fen: game.fen, // In a draw, keep the current position
      },
    });
  }

  private async updatePlayerStats(
    firstPlayerId: string,
    secondPlayerId: string,
    winner: 'w' | 'b' | null,
  ) {
    if (winner === 'w') {
      await this.prisma.user.update({
        where: { id: firstPlayerId },
        data: { wins: { increment: 1 } },
      });
      await this.prisma.user.update({
        where: { id: secondPlayerId },
        data: { losses: { increment: 1 } },
      });
    } else if (winner === 'b') {
      await this.prisma.user.update({
        where: { id: secondPlayerId },
        data: { wins: { increment: 1 } },
      });
      await this.prisma.user.update({
        where: { id: firstPlayerId },
        data: { losses: { increment: 1 } },
      });
    } else {
      // Empate
      await this.prisma.user.updateMany({
        where: { id: { in: [firstPlayerId, secondPlayerId] } },
        data: { draws: { increment: 1 } },
      });
    }
  }
}
