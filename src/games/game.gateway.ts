import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GamesService } from './games.service';
import { MoveDto } from './dto/move.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Chess, Square } from 'chess.js';
import { Game } from '@prisma/client';

@WebSocketGateway()
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private playerGames: Map<string, string> = new Map(); // socketId -> gameId
  private gameSockets: Map<string, Set<string>> = new Map(); // gameId -> Set<socketId>

  constructor(
    private gamesService: GamesService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    const gameId = this.playerGames.get(client.id);
    if (gameId) {
      // Remove from gameSockets
      const sockets = this.gameSockets.get(gameId);
      if (sockets) {
        sockets.delete(client.id);
        console.log(
          `Player disconnected from game ${gameId}. Remaining: ${sockets.size}`,
        );

        if (sockets.size === 0) {
          this.gameSockets.delete(gameId);
        } else {
          // Notify remaining players
          this.server.to(gameId).emit('playerDisconnected', {
            message: 'Opponent has disconnected',
          });
        }
      }

      // Clean up game if needed
      await this.cleanupGameIfEmpty(gameId);
    }
    this.playerGames.delete(client.id);
  }

  private async cleanupGameIfEmpty(gameId: string) {
    const sockets = this.gameSockets.get(gameId);
    if (!sockets || sockets.size === 0) {
      await this.prisma.game.update({
        where: { id: gameId },
        data: { status: 'ABANDONED' },
      });
      this.gameSockets.delete(gameId);
    }
  }

  @SubscribeMessage('joinGame')
  async handleJoinGame(
    client: Socket,
    payload: { gameId: string; userId: string },
  ) {
    try {
      // Check for existing connections from this user
      const existingConnections = Array.from(this.playerGames.entries())
        .filter(([_, gameId]) => gameId === payload.gameId)
        .map(([socketId, _]) => socketId);

      // Disconnect previous sockets from this user in this game
      existingConnections.forEach((socketId) => {
        if (socketId !== client.id) {
          this.server.sockets.sockets.get(socketId)?.disconnect();
        }
      });

      const game = await this.gamesService.joinGame(payload.gameId, {
        playerId: payload.userId,
      });

      // Track connection
      this.playerGames.set(client.id, payload.gameId);
      if (!this.gameSockets.has(payload.gameId)) {
        this.gameSockets.set(payload.gameId, new Set());
      }
      const gameSocketSet = this.gameSockets.get(payload.gameId);
      if (gameSocketSet) {
        gameSocketSet.add(client.id);
      }

      client.join(payload.gameId);

      // Determine player color
      const playerColor = game.player1Id === payload.userId ? 'w' : 'b';
      const chess = new Chess(game.fen);
      const gameSockets = this.gameSockets.get(payload.gameId);
      const opponentConnected = gameSockets ? true : false;

      console.log('opp', opponentConnected);

      // Send game state
      client.emit('gameState', {
        fen: game.fen,
        playerColor,
        status: game.status,
        opponentConnected,
        currentTurn: chess.turn(),
      });

      // Notify others if opponent connected
      if (opponentConnected) {
        console.log('hola');
        client.to(payload.gameId).emit('playerConnected');
      }

      console.log(
        `Player ${payload.userId} (${playerColor}) joined game ${payload.gameId}`,
      );
      // console.log(
      //   `Current connections: ${this.gameSockets.get(payload.gameId) ?? 0}`,
      // );
    } catch (error) {
      console.error('Join error:', error.message);
      client.emit('joinError', {
        message: error.response?.error || error.message,
      });
    }
  }

  @SubscribeMessage('makeMove')
  async handleMakeMove(
    client: Socket,
    payload: { gameId: string; move: MoveDto },
  ) {
    try {
      const gameId = this.playerGames.get(client.id);
      if (!gameId) {
        throw new Error('Player not found in game');
      }
  
      const updatedGame = await this.gamesService.makeMove(
        payload.gameId,
        payload.move,
      );
      
      const chess = new Chess(updatedGame.fen);
      const sockets = this.gameSockets.get(payload.gameId);
      const opponentConnected = sockets && sockets.size > 1;
  
      // Envía más información en el evento
      this.server.to(payload.gameId).emit('moveMade', {
        fen: updatedGame.fen,
        status: updatedGame.status.toLowerCase(), // Asegura que coincida con el tipo en el frontend
        opponentConnected,
        currentTurn: chess.turn(),
        // Agrega más datos si es necesario
      });
  
      if (updatedGame.status === 'FINISHED') {
        await this.updatePlayerStats(updatedGame);
      }
    } catch (error) {
      client.emit('moveError', { message: error.message });
    }
  }

  private async updatePlayerStats(game: Game) {
    if (!game.result) return;

    const updates = [];

    if (game.result === 'WHITE_WIN') {
      await this.prisma.user.update({
        where: { id: game.player1Id },
        data: { wins: { increment: 1 } },
      });
      this.prisma.user.update({
        where: { id: game.player2Id ?? undefined },
        data: { losses: { increment: 1 } },
      });
    } else if (game.result === 'BLACK_WIN') {
      await this.prisma.user.update({
        where: { id: game.player2Id ?? undefined },
        data: { wins: { increment: 1 } },
      });
      this.prisma.user.update({
        where: { id: game.player1Id },
        data: { losses: { increment: 1 } },
      });
    } else if (game.result === 'DRAW') {
      this.prisma.user.update({
        where: { id: game.player1Id },
        data: { draws: { increment: 1 } },
      });
      this.prisma.user.update({
        where: { id: game.player2Id ?? undefined },
        data: { draws: { increment: 1 } },
      });
    }

    await Promise.all(updates);
  }
}
