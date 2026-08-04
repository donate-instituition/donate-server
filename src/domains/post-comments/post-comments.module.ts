import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Post as PostEntity, PostSchema } from '../posts/schemas/post.schema';
import { PostComment, PostCommentSchema } from './schemas/post-comment.schema';
import { PostCommentsController } from './post-comments.controller';
import { PostCommentsService } from './post-comments.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PostComment.name, schema: PostCommentSchema },
      { name: PostEntity.name, schema: PostSchema },
    ]),
  ],
  controllers: [PostCommentsController],
  providers: [PostCommentsService],
})
export class PostCommentsModule {}
