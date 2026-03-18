import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import routes from './routes/instance';
import { db } from './database/database';

// Cargar variables de entorno
dotenv.config();

const app: Application = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir panel de administración
app.use(express.static(path.join(__dirname, '../panel')));

// Rutas de la API
app.use('/', routes);

// Ruta principal - mostrar panel
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../panel/index.html'));
});

// Ruta API info
app.get('/api', (req: Request, res: Response) => {
  res.json({
    name: 'Mi WhatsApp API',
    version: '1.0.0',
    status: 'running',
    message: 'API de WhatsApp personalizada - Conectada a n8n'
  });
});

// Ruta de health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Iniciar servidor
async function startServer() {
  // Inicializar base de datos
  await db.init();
  
  app.listen(PORT, HOST, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║          🎉 Mi WhatsApp API iniciada                       ║
║                                                           ║
║   Servidor: http://${HOST}:${PORT}                        ║
║   Documentación: http://${HOST}:${PORT}/api               ║
║                                                           ║
║   Endpoints principales:                                  ║
║   • POST /instance/create - Crear instancia               ║
║   • GET  /instance/:id/status - Ver estado                ║
║   • GET  /instance/:id/qr - Obtener QR                    ║
║   • POST /message/send - Enviar mensaje                    ║
║   • GET  /chats/:id - Ver chats                           ║
║   • POST /webhook/:id - Webhook para n8n                   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
}

// Manejo de errores no controlados
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('Error no controlado:', reason);
});

process.on('uncaughtException', (error: Error) => {
  console.error('Excepción no capturada:', error);
  process.exit(1);
});

// Iniciar
startServer();

export default app;
