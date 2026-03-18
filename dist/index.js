"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const instance_1 = __importDefault(require("./routes/instance"));
const database_1 = require("./database/database");
// Cargar variables de entorno
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Servir panel de administración
app.use(express_1.default.static(path_1.default.join(__dirname, '../panel')));
// Rutas de la API
app.use('/', instance_1.default);
// Ruta principal - mostrar panel
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../panel/index.html'));
});
// Ruta API info
app.get('/api', (req, res) => {
    res.json({
        name: 'Mi WhatsApp API',
        version: '1.0.0',
        status: 'running',
        message: 'API de WhatsApp personalizada - Conectada a n8n'
    });
});
// Ruta de health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});
// Iniciar servidor
async function startServer() {
    // Inicializar base de datos
    await database_1.db.init();
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
process.on('unhandledRejection', (reason, promise) => {
    console.error('Error no controlado:', reason);
});
process.on('uncaughtException', (error) => {
    console.error('Excepción no capturada:', error);
    process.exit(1);
});
// Iniciar
startServer();
exports.default = app;
//# sourceMappingURL=index.js.map