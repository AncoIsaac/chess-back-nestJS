import { ApiProperty } from "@nestjs/swagger";

export class joinGameDto {
    @ApiProperty()
    gameId: string;

    @ApiProperty()
    playerId: string;
}