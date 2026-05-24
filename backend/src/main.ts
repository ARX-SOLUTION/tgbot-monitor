import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import * as path from 'path';
import * as express from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // ── CORS (allow dashboard origin) ──────────────────────────────────────────
  app.enableCors({
    origin: process.env.DASHBOARD_ORIGIN || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // ── Validation ─────────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // ── Global error filter ────────────────────────────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── Swagger docs ───────────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('TGBot Monitor API')
    .setDescription('Multi-bot Telegram logging & monitoring system')
    .setVersion('1.0')
    .addTag('bots', 'Bot management')
    .addTag('logs', 'Update & error logs')
    .addTag('stats', 'Statistics & analytics')
    .addTag('alerts', 'Alert management')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // ── Serve React SPA (frontend build → backend/public) ──────────────────────
  const publicPath = path.join(__dirname, '../public');
  app.use(express.static(publicPath));

  // SPA fallback — non-API routes return index.html
  app.use((req: any, res: any, next: any) => {
    if (req.path.startsWith('/api')) return next();
    const index = path.join(publicPath, 'index.html');
    if (require('fs').existsSync(index)) return res.sendFile(index);
    next();
  });

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Server running on http://0.0.0.0:${port}`);
  logger.log(`📚 Swagger docs: http://0.0.0.0:${port}/api/docs`);
  logger.log(`📊 Dashboard: http://0.0.0.0:${port}/dashboard`);

  // ── PM2 graceful shutdown ──────────────────────────────────────────────────
  process.on('SIGINT', async () => {
    logger.log('Received SIGINT, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    logger.log('Received SIGTERM, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
