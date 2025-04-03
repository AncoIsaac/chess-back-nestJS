// games.service.ts
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Chess, Square } from 'chess.js';
import { MoveDto } from './dto/move.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { GameResult } from '@prisma/client';
import { CreateGameDto } from './dto/create-game.dto';

@Injectable()
export class GamesService {
  constructor(private prisma: PrismaService) {}

  async createGame(data: CreateGameDto) {
    const chess = new Chess();

    return this.prisma.game.create({
      data: {
        player1Id: data.playerId,
        status: 'WAITING',
        fen: chess.fen(),
      },
    });
  }

  async joinGame(gameId: string, data: CreateGameDto) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new Error('Game not found');
    }

    if (game.player1Id === data.playerId) {
      throw new HttpException({
        status: HttpStatus.CONFLICT,
        error: 'Cannot play against yourself',
      }, HttpStatus.CONFLICT);
      // throw new Error('Cannot play against yourself');
    }

    if (game.player2Id && game.player2Id !== data.playerId) {
      throw new Error('Game already has two players');
    }

    return this.prisma.game.update({
      where: { id: gameId },
      data: {
        player2Id: data.playerId,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
      include: {
        player1: true,
        player2: true,
      },
    });
  }

  async makeMove(gameId: string, moveDto: MoveDto) {
    const gameRecord = await this.prisma.game.findUnique({ 
      where: { id: gameId } 
    });
    
    if (!gameRecord) throw new Error('Game not found');
    if (gameRecord.status !== 'IN_PROGRESS') throw new Error('Game is not in progress');
  
    const chess = new Chess(gameRecord.fen);
    
    // Verificar que es el turno del jugador correcto
    const movingColor = chess.get(moveDto.from as Square)?.color;
    if (movingColor !== chess.turn()) {
      throw new Error(`Not your turn. Current turn: ${chess.turn()}`);
    }
    
    try {
      const move = {
        from: moveDto.from as Square,
        to: moveDto.to as Square,
        promotion: moveDto.promotion as 'q' | 'r' | 'b' | 'n' | undefined
      };
      
      const result = chess.move(move);
      
      // Determine game result if game is over
      let gameResult: GameResult | null = null;
      if (chess.isGameOver()) {
        if (chess.isDraw()) {
          gameResult = 'DRAW';
        } else {
          gameResult = chess.turn() === 'w' ? 'BLACK_WIN' : 'WHITE_WIN';
        }
      }

      return this.prisma.game.update({
        where: { id: gameId },
        data: {
          fen: chess.fen(),
          moves: { push: result.san },
          pgn: chess.pgn(),
          status: chess.isGameOver() ? 'FINISHED' : 'IN_PROGRESS',
          result: gameResult,
          endedAt: chess.isGameOver() ? new Date() : undefined,
        },
      });
    } catch (error) {
      throw new Error('Invalid move: ' + error.message);
    }
  }

  async getGameState(gameId: string) {
    return this.prisma.game.findUnique({
      where: { id: gameId },
    });
  }
}