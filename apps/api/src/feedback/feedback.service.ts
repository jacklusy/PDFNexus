import { BadRequestException, Injectable } from '@nestjs/common';
import { ErrorCodes, feedbackSchema } from '@pdfnexus/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(body: unknown, userAgent?: string | null) {
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'Invalid feedback payload',
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    const data = parsed.data;
    const row = await this.prisma.feedback.create({
      data: {
        type: data.type,
        rating: data.rating ?? null,
        message: data.message,
        email: data.email ?? null,
        userAgent: userAgent ?? null,
      },
    });

    return { ok: true, id: row.id };
  }
}
