import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async login(data: CreateAuthDto): Promise<{ data: User; message: string }> {
    const userExists = await this.prisma.user.findUnique({
      where: {
        email: data.email,
      }, 
    })
    if (!userExists) {
      throw new HttpException(
        {
          status: HttpStatus.CONFLICT,
          error: 'User Not Found',
        },
        HttpStatus.CONFLICT,
      ); 
    }
    if (userExists.password !== data.password) {
      throw new HttpException(
        {
          status: HttpStatus.CONFLICT,
          error: 'Password Incorrect',
        },
        HttpStatus.CONFLICT,
      );
    }
    return {
      data: userExists,
      message: 'User Logged In', 
    }
    
  }

  findAll() {
    return `This action returns all auth`;
  }

  findOne(id: number) {
    return `This action returns a #${id} auth`;
  }

  update(id: number, updateAuthDto: UpdateAuthDto) {
    return `This action updates a #${id} auth`;
  }

  remove(id: number) {
    return `This action removes a #${id} auth`;
  }
}
