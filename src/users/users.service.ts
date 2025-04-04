import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(
    data: Prisma.UserCreateInput,
  ): Promise<{ data: User; message: string }> {
    const userExists = await this.prisma.user.findUnique({
      where: {
        email: data.email,
      },
    });
    if (userExists) {
      throw new HttpException(
        {
          status: HttpStatus.CONFLICT,
          error: 'User already exists',
        },
        HttpStatus.CONFLICT,
      );
    }

    const user = await this.prisma.user.create({
      data,
    });

    return {
      data: user,
      message: 'User created successfully',
    };
  }

  async findAll(): Promise<{data: User[], message: string}>  {
    const users = await this.prisma.user.findMany();
    
    return {
      data: users,
      message: 'Users fetched successfully',
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
