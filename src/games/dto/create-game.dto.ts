import { ApiProperty } from "@nestjs/swagger";

export class CreateGameDto {
  @ApiProperty()
  firstPlayerId: string;
}
