import { Injectable } from '@nestjs/common';
import { MoveDto } from './dto/move.dto';
import { Chess } from 'chess.js';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class GamesService {
  constructor(private prisma: PrismaService) {}

  async createGame() {
    return this.prisma.game.create({
      data: {
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        status: 'WAITING',
      },
    });
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
}
