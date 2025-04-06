import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { MoveDto } from './dto/move.dto';
import { Chess } from 'chess.js';
import { PrismaService } from 'src/prisma/prisma.service';
import { Game } from '@prisma/client';
import { CreateGameDto } from './dto/create-game.dto';

@Injectable()
export class GamesService {
  constructor(private prisma: PrismaService) { }

  async getAllGame() {
    return await this.prisma.game.findMany()
  }

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

  async joinGame(data: CreateGameDto): Promise<{ data: Game, message: string }> {
    // 1. Validar que el usuario existe
    const user = await this.prisma.user.findUnique({
      where: { id: data.firstPlayerId }
    });

    if (!user) {
      throw new HttpException(
        { status: HttpStatus.NOT_FOUND, error: "User not found" },
        HttpStatus.NOT_FOUND,
      );
    }

    // 2. Verificar si el usuario ya tiene partidas activas (no FINISHED)
    const activeGames = await this.prisma.game.findMany({
      where: {
        OR: [
          { firstPlayerId: data.firstPlayerId },
          { secondPlayerId: data.firstPlayerId }
        ],
        NOT: { status: "FINISHED" }
      }
    });

    console.log(activeGames);


    if (activeGames.length > 0) {
      throw new HttpException(
        {
          status: HttpStatus.BAD_REQUEST,
          error: "You already have an active game",
          data: activeGames[0].id
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 3. Buscar partidas disponibles (WAITING y de otros jugadores)
    const availableGames = await this.prisma.game.findMany({
      where: {
        secondPlayerId: null,
        status: "WAITING",
        NOT: { firstPlayerId: data.firstPlayerId } // No unirse a propia partida
      },
      orderBy: { createdAt: 'asc' } // Unirse a la partida más antigua primero
    });

    // 4. Si hay partidas disponibles, unirse a la primera
    if (availableGames.length > 0) {
      const gameToJoin = availableGames[0];
      const updatedGame = await this.prisma.game.update({
        where: { id: gameToJoin.id },
        data: {
          secondPlayerId: data.firstPlayerId,
          status: "IN_PROGRESS" // Cambiar estado cuando se unen dos jugadores
        }
      });

      return {
        data: updatedGame,
        message: "Joined existing game successfully"
      };
    }

    // 5. Si no hay partidas disponibles, crear una nueva
    const createGame = await this.createGame(data);
    return {
      data: createGame.data,
      message: "Created new game - waiting for opponent"
    };
  }

  async deleteGame(id: string): Promise<{ data: Game, message: string }> {
    const game = await this.prisma.game.findUnique({
      where: { id }
    })
    if (!game) {
      throw new HttpException({
        status: HttpStatus.NOT_FOUND,
        error: "game not found"
      },
        HttpStatus.NOT_FOUND
      )
    }

    const deleteGame = await this.prisma.game.delete({
      where: { id }
    })

    return {
      data: deleteGame,
      message: "Delete game successfully"
    }
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
