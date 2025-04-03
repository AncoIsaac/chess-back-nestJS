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
import { Chess } from 'chess.js';

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
        if (sockets.size === 0) {
          this.gameSockets.delete(gameId);
        }
      }

      // Mark game as abandoned if it was in progress
      await this.prisma.game.updateMany({
        where: {
          id: gameId,
          status: 'IN_PROGRESS',
        },
        data: {
          status: 'ABANDONED',
          endedAt: new Date(),
        },
      });

      // Notify other player if there's still someone in the game
      if (sockets && sockets.size > 0) {
        this.server.to(gameId).emit('playerDisconnected', {
          message: 'Opponent has disconnected',
          gameStatus: 'ABANDONED',
        });
      }
    }
    this.playerGames.delete(client.id);
  }

  @SubscribeMessage('joinGame')
  async handleJoinGame(client: Socket, payload: { gameId: string; userId: string }) {
    try {
      const game = await this.gamesService.joinGame(payload.gameId, { playerId: payload.userId });
  
      this.playerGames.set(client.id, payload.gameId);
  
      if (!this.gameSockets.has(payload.gameId)) {
        this.gameSockets.set(payload.gameId, new Set());
      }
      const gameSocketSet = this.gameSockets.get(payload.gameId);
      gameSocketSet?.add(client.id);
  
      client.join(payload.gameId);
  
      const playerColor = game.player1Id === payload.userId ? 'w' : 'b';
      const chess = new Chess(game.fen);
  
      // Send initial state to joining player
      client.emit('gameState', {
        fen: game.fen,
        playerColor,
        status: game.status,
        opponentConnected: gameSocketSet ? gameSocketSet.size > 1 : false, // Include opponent status
        currentTurn: chess.turn()
      });
  
      // Notify other players if there's already someone in the game
      if (gameSocketSet && gameSocketSet.size > 1) {
        // Send to all other clients in this game
        client.to(payload.gameId).emit('playerConnected');
        
        // Also update the new player about existing connections
        client.emit('playerConnected');
      }
      console.log(`Player ${payload.userId} joined game ${payload.gameId}`);
      console.log(`Current players in game: ${gameSocketSet?.size}`);
    } catch (error) {
      client.emit('joinError', { message: error.message });
    }
  }

  @SubscribeMessage('makeMove')
  async handleMakeMove(
    client: Socket,
    payload: { gameId: string; move: MoveDto },
  ) {
    
    try {
      const updatedGame = await this.gamesService.makeMove(
        payload.gameId,
        payload.move,
      );
      this.server.to(payload.gameId).emit('moveMade', updatedGame);

      if (updatedGame.status === 'FINISHED') {
        // Update player stats
        // await this.updatePlayerStats(updatedGame);
      }
    } catch (error) {
      client.emit('moveError', { message: error.message });
    }
  }

  // private async updatePlayerStats(game: Game) {
  //   if (!game.result) return;

  //   const updates = [];

  //   if (game.result === 'WHITE_WIN') {
  //     updates.push(
  //       this.prisma.user.update({
  //         where: { id: game.player1Id },
  //         data: { wins: { increment: 1 } }
  //       }),
  //       this.prisma.user.update({
  //         where: { id: game.player2Id },
  //         data: { losses: { increment: 1 } }
  //       })
  //     );
  //   } else if (game.result === 'BLACK_WIN') {
  //     updates.push(
  //       this.prisma.user.update({
  //         where: { id: game.player2Id },
  //         data: { wins: { increment: 1 } }
  //       }),
  //       this.prisma.user.update({
  //         where: { id: game.player1Id },
  //         data: { losses: { increment: 1 } }
  //       })
  //     );
  //   } else if (game.result === 'DRAW') {
  //     updates.push(
  //       this.prisma.user.update({
  //         where: { id: game.player1Id },
  //         data: { draws: { increment: 1 } }
  //       }),
  //       this.prisma.user.update({
  //         where: { id: game.player2Id },
  //         data: { draws: { increment: 1 } }
  //       })
  //     );
  //   }

  //   await Promise.all(updates);
  // }
}
