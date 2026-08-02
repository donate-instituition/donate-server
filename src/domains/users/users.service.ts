import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';

export type PublicUser = Omit<
  ReturnType<UserDocument['toObject']>,
  'passwordHash'
>;

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const normalizedEmail = createUserDto.email?.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new ConflictException('Email is required');
    }

    const existingUser = await this.userModel.findOne({ email: normalizedEmail }).exec();

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    return this.userModel.create({
      type: createUserDto.type ?? 'PERSON',
      role: createUserDto.role ?? 'DONOR',
      fullName: createUserDto.fullName,
      email: normalizedEmail,
      passwordHash: createUserDto.passwordHash,
      status: createUserDto.status ?? 'ACTIVE',
      isVerified: createUserDto.isVerified ?? true,
    });
  }

  findByEmail(email: string) {
    return this.userModel.findOne({ email: email.trim().toLowerCase() }).exec();
  }

  toPublicUser(user: UserDocument): PublicUser {
    const { passwordHash, ...publicUser } = user.toObject();
    void passwordHash;

    return publicUser;
  }

  findAll() {
    return this.userModel.find().exec();
  }

  findOne(id: string) {
    return this.userModel.findById(id).exec();
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    void updateUserDto;
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
