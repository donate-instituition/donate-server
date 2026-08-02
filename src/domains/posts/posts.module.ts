import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Follow, FollowSchema } from '../follows/schemas/follow.schema';
import { Post as PostEntity, PostSchema } from './schemas/post.schema';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PostEntity.name, schema: PostSchema }]),
    MongooseModule.forFeature([{ name: Follow.name, schema: FollowSchema }]),
  ],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
