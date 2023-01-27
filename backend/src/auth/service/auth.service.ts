import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuthDto } from '../dto';
import { PrismaService } from '../../prisma/prisma.service';
import * as argon from 'argon2';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async signUp(dto: AuthDto) {
    const hash = await argon.hash(dto.password);

    try {
      const auth = await this.prisma.auth.create({
        data: {
          email: dto.email,
          password: hash,
        },
      });

      return this.signToken(auth.id, auth.email);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ForbiddenException('Email Id Already Exists');
        }
      }
      throw error;
    }
  }

  async signIn(dto: AuthDto) {
    const auth = await this.prisma.auth.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (!auth) throw new ForbiddenException('Wrong Email or Password');

    const pwMatches = await argon.verify(auth.password, dto.password);
    if (!pwMatches) throw new ForbiddenException('Wrong Email or Password');

    return this.signToken(auth.id, auth.email);
  }

  async signToken(
    userId: number,
    email: string,
  ): Promise<{ access_token: string }> {
    const payload = {
      sub: userId,
      email,
    };
    const secret = this.config.get('JWT_SECRET');

    const token = await this.jwt.signAsync(payload, {
      expiresIn: '1h',
      secret: secret,
    });

    return {
      access_token: token,
    };
  }
}
