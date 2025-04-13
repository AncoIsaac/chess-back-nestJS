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
import { Chess, Square } from 'chess.js';
@WebSocketGateway({
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private playerColors: Record<string, 'w' | 'b'> = {}; // Almacena los colores de los jugadores

  constructor(private readonly gameService: GamesService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    // Limpiar asignación de color al desconectarse
    Object.keys(this.playerColors).forEach((gameId) => {
      if (this.playerColors[gameId] === client.id) {
        delete this.playerColors[gameId];
      }
    });
  }

  @SubscribeMessage('joinGame')
  async handleJoinGame(client: Socket, gameId: string) {
    client.join(gameId);
    const game = await this.gameService.getGameState(gameId);

    // Asignar color aleatorio solo si es el primer jugador
    const playersInRoom =
      this.server.sockets.adapter.rooms.get(gameId)?.size || 0;

    if (playersInRoom === 1) {
      // Primer jugador - asignar color aleatorio
      this.playerColors[client.id] = Math.random() > 0.5 ? 'w' : 'b';
    } else if (playersInRoom === 2) {
      // Segundo jugador - asignar el color opuesto
      const otherPlayerId = Array.from(
        this.server.sockets.adapter.rooms.get(gameId) || [],
      ).find((id) => id !== client.id);
      this.playerColors[client.id] =
        otherPlayerId && this.playerColors[otherPlayerId] === 'w' ? 'b' : 'w';

      // Notificar a todos en la sala que el segundo jugador se conectó
      this.server.to(gameId).emit('opponentConnected', {
        opponentId: client.id,
        opponentColor: this.playerColors[client.id],
      });
    }

    client.emit('gameState', {
      ...game,
      playerColor: this.playerColors[client.id] || null,
    });
  }


  @SubscribeMessage('makeMove')
  async handleMakeMove(
    client: Socket,
    { gameId, move }: { gameId: string; move: MoveDto },
  ) {
    try {
      const playerColor = this.playerColors[client.id];
      const game = await this.gameService.getGameState(gameId);
      const chess = new Chess(game.fen);

      if (chess.turn() !== playerColor) {
        throw new Error('No es tu turno');
      }

      const piece = chess.get(move.from as Square);
      if (!piece || piece.color !== playerColor) {
        throw new Error('No puedes mover piezas del oponente');
      }

      const updatedGame = await this.gameService.makeMove(gameId, move);
      this.server.to(gameId).emit('moveMade', updatedGame);

      // Notificar si el juego terminó
      if (updatedGame.status === 'FINISHED') {
        const chess = new Chess(updatedGame.fen);
        if (chess.isCheckmate()) {
          const winner = chess.turn() === 'w' ? 'b' : 'w';
          this.server.to(gameId).emit('gameEnded', {
            winner,
            reason: 'checkmate',
            isGameOver: true,
          });
        }
      }
    } catch (error) {
      client.emit('moveError', error.message);
    }
  }

  // game.gateway.ts

  @SubscribeMessage('resignGame')
  async handleResign(client: Socket, gameId: string) {
    try {
      const playerColor = this.playerColors[client.id];
      const game = await this.gameService.resignGame(gameId, playerColor);
      this.server.to(gameId).emit('gameResigned', {
        winner: playerColor === 'w' ? 'b' : 'w',
        reason: 'resignation',
      });
    } catch (error) {
      client.emit('gameError', error.message);
    }
  }

  @SubscribeMessage('offerDraw')
  async handleOfferDraw(client: Socket, gameId: string) {
    try {
      const playerColor = this.playerColors[client.id];
      // Notificar al oponente sobre la oferta de tablas
      const otherClients = Array.from(
        this.server.sockets.adapter.rooms.get(gameId) || [],
      );
      otherClients.forEach((id) => {
        if (id !== client.id) {
          this.server.to(id).emit('drawOffered', { by: playerColor });
        }
      });
    } catch (error) {
      client.emit('gameError', error.message);
    }
  }

  @SubscribeMessage('acceptDraw')
  async handleAcceptDraw(client: Socket, gameId: string) {
    try {
      const game = await this.gameService.endGameAsDraw(gameId, 'agreement');
      this.server.to(gameId).emit('gameEnded', {
        winner: null,
        reason: 'agreement',
        isGameOver: true,
      });
    } catch (error) {
      client.emit('gameError', error.message);
    }
  }
}
