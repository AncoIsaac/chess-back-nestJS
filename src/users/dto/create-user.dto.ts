import { ApiProperty } from "@nestjs/swagger";

export class CreateUserDto {
  @ApiProperty()
  email: string;
  @ApiProperty()
  username: string;
  // createdAt: Date;
  // updatedAt: Date;
  // wins: number;
  // losses: number;
  // draws: number;
}
