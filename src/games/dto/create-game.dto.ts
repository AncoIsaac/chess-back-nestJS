import { ApiProperty } from "@nestjs/swagger";

export class CreateGameDto {
    @ApiProperty()
    playerId: string;
}
