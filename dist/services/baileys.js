"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.baileysService = void 0;
const whatsapp_web_js_1 = require("whatsapp-web.js");
const qrcode_1 = __importDefault(require("qrcode"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const database_1 = require("../database/database");
const axios_1 = __importDefault(require("axios"));
const SESSIONS_PATH = process.env.SESSIONS_PATH || './sessions';
class WhatsAppService {
    constructor() {
        this.instances = new Map();
        if (!fs_1.default.existsSync(SESSIONS_PATH)) {
            fs_1.default.mkdirSync(SESSIONS_PATH, { recursive: true });
        }
    }
    getSessionPath(instanceId) {
        return path_1.default.join(SESSIONS_PATH, instanceId);
    }
    async createInstance(instanceId, name, apiKey) {
        try {
            database_1.db.createInstance(instanceId, name, apiKey);
            const sessionPath = this.getSessionPath(instanceId);
            if (!fs_1.default.existsSync(sessionPath)) {
                fs_1.default.mkdirSync(sessionPath, { recursive: true });
            }
            const client = await this.connectToWhatsApp(instanceId, sessionPath);
            this.instances.set(instanceId, {
                id: instanceId,
                name,
                client,
                qrCode: null,
                isConnected: false,
                phone: null
            });
            return {
                success: true,
                message: 'Instancia creada. Escanea el QR para conectar.'
            };
        }
        catch (error) {
            console.error('Error creando instancia:', error);
            return {
                success: false,
                message: error.message || 'Error al crear instancia'
            };
        }
    }
    async connectToWhatsApp(instanceId, sessionPath) {
        const client = new whatsapp_web_js_1.Client({
            session: null,
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });
        client.on('qr', async (qr) => {
            const qrImage = await qrcode_1.default.toDataURL(qr);
            const instance = this.instances.get(instanceId);
            if (instance) {
                instance.qrCode = qrImage;
                database_1.db.updateInstanceQR(instanceId, qrImage, Date.now() + 60000);
            }
        });
        client.on('ready', () => {
            console.log(`✅ ¡Conectado! Instancia: ${instanceId}`);
            const instance = this.instances.get(instanceId);
            if (instance) {
                instance.isConnected = true;
                const phone = client.info?.wid?.user || null;
                instance.phone = phone;
                database_1.db.updateInstanceStatus(instanceId, 'connected', phone);
            }
        });
        client.on('disconnected', (reason) => {
            console.log(`Conexión cerrada. Razón: ${reason}`);
            const instance = this.instances.get(instanceId);
            if (instance) {
                instance.isConnected = false;
                database_1.db.updateInstanceStatus(instanceId, 'disconnected');
            }
        });
        client.on('message', async (message) => {
            if (!message.fromMe) {
                await this.handleIncomingMessage(instanceId, message);
            }
        });
        client.initialize();
        return client;
    }
    async handleIncomingMessage(instanceId, message) {
        try {
            const phone = message.from.replace('@c.us', '');
            const messageId = message.id._serialized || '';
            const timestamp = message.timestamp * 1000;
            const chatId = message.from;
            let messageType = 'text';
            let content = message.body || '';
            let mediaUrl = null;
            let caption = null;
            // Determinar tipo de mensaje
            if (message.type === 'image') {
                messageType = 'image';
                caption = message.caption || null;
            }
            else if (message.type === 'video') {
                messageType = 'video';
                caption = message.caption || null;
            }
            else if (message.type === 'document') {
                messageType = 'document';
                caption = message.caption || null;
            }
            else if (message.type === 'audio') {
                messageType = 'audio';
            }
            else if (message.type === 'sticker') {
                messageType = 'sticker';
            }
            else if (message.type === 'location') {
                messageType = 'location';
            }
            else if (message.type === 'vcard') {
                messageType = 'vcard';
            }
            // Obtener nombre del contacto
            let contactName = phone;
            try {
                const contact = await message.getContact();
                if (contact && contact.pushname) {
                    contactName = contact.pushname;
                }
                else if (contact && contact.verifiedName) {
                    contactName = contact.verifiedName;
                }
            }
            catch (e) {
                // Si no se puede obtener el nombre, usar teléfono
            }
            const client = database_1.db.createOrUpdateClient(instanceId, phone, contactName);
            const chat = database_1.db.createOrUpdateChat(instanceId, client.id);
            database_1.db.saveMessage(instanceId, chat.id, client.id, messageId, messageType, content, mediaUrl, false, timestamp);
            database_1.db.updateChatLastMessage(chat.id, content.substring(0, 100), timestamp);
            // Enviar webhook con información completa
            await this.sendWebhook(instanceId, 'message', {
                type: 'incoming',
                chat: {
                    id: chatId,
                    chatId: chat.id,
                    name: contactName,
                    phone: phone,
                    isGroup: message.from.includes('@g.us'),
                    isBusiness: message.from.includes('@c.us')
                },
                message: {
                    id: messageId,
                    type: messageType,
                    content: content,
                    caption: caption,
                    mediaUrl: mediaUrl,
                    timestamp: timestamp,
                    timestampISO: new Date(timestamp).toISOString(),
                    fromMe: false
                },
                metadata: {
                    instanceId: instanceId,
                    receivedAt: Date.now()
                }
            });
        }
        catch (error) {
            console.error('Error manejando mensaje entrante:', error);
        }
    }
    async sendMessage(instanceId, phone, messageText) {
        const instance = this.instances.get(instanceId);
        if (!instance || !instance.client) {
            return { success: false, error: 'Instancia no encontrada o no conectada' };
        }
        if (!instance.isConnected) {
            return { success: false, error: 'WhatsApp no está conectado' };
        }
        try {
            const chatId = `${phone}@c.us`;
            const result = await instance.client.sendMessage(chatId, messageText);
            const timestamp = Date.now();
            const client = database_1.db.createOrUpdateClient(instanceId, phone);
            const chat = database_1.db.createOrUpdateChat(instanceId, client.id);
            database_1.db.saveMessage(instanceId, chat.id, client.id, result.id._serialized || '', 'text', messageText, null, true, timestamp);
            database_1.db.updateChatLastMessage(chat.id, messageText.substring(0, 100), timestamp);
            return { success: true, messageId: result.id._serialized };
        }
        catch (error) {
            console.error('Error enviando mensaje:', error);
            return { success: false, error: error.message };
        }
    }
    getInstanceStatus(instanceId) {
        const instance = this.instances.get(instanceId);
        const dbInstance = database_1.db.getInstance(instanceId);
        if (!dbInstance) {
            return { exists: false };
        }
        return {
            exists: true,
            id: instanceId,
            name: dbInstance.name,
            status: instance?.isConnected ? 'connected' : dbInstance.status,
            phone: instance?.phone || dbInstance.phone,
            qrCode: instance?.qrCode || dbInstance.qr_code,
            qrExpiresAt: dbInstance.qr_expires_at
        };
    }
    getQRCode(instanceId) {
        const instance = this.instances.get(instanceId);
        return instance?.qrCode || null;
    }
    getChats(instanceId) {
        return database_1.db.getChats(instanceId);
    }
    getClients(instanceId) {
        return database_1.db.getClients(instanceId);
    }
    getMessages(instanceId, chatId) {
        return database_1.db.getMessages(chatId);
    }
    async disconnect(instanceId) {
        const instance = this.instances.get(instanceId);
        if (instance?.client) {
            instance.client.destroy();
        }
        this.instances.delete(instanceId);
        database_1.db.updateInstanceStatus(instanceId, 'disconnected');
        return { success: true };
    }
    async sendWebhook(instanceId, event, data) {
        try {
            const webhooks = database_1.db.getWebhooks(instanceId);
            for (const webhook of webhooks) {
                const events = JSON.parse(webhook.events);
                if (events.includes(event) || events.includes('all')) {
                    await axios_1.default.post(webhook.url, {
                        event,
                        instanceId,
                        timestamp: Date.now(),
                        data
                    }).catch(err => {
                        console.error(`Error enviando webhook a ${webhook.url}:`, err.message);
                    });
                }
            }
        }
        catch (error) {
            console.error('Error en webhook:', error);
        }
    }
    loadInstances() {
        const instances = database_1.db.getAllInstances();
        for (const instance of instances) {
            if (instance.status === 'connected') {
                const sessionPath = this.getSessionPath(instance.id);
                this.connectToWhatsApp(instance.id, sessionPath).then(client => {
                    this.instances.set(instance.id, {
                        id: instance.id,
                        name: instance.name,
                        client,
                        qrCode: null,
                        isConnected: false,
                        phone: null
                    });
                }).catch(err => {
                    console.error(`Error reconectando instancia ${instance.id}:`, err);
                });
            }
        }
    }
}
exports.baileysService = new WhatsAppService();
//# sourceMappingURL=baileys.js.map