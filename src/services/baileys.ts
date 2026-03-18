import { Client, Message } from 'whatsapp-web.js';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { db } from '../database/database';
import axios from 'axios';

const SESSIONS_PATH = process.env.SESSIONS_PATH || './sessions';

export interface WhatsAppInstance {
  id: string;
  name: string;
  client: Client | null;
  qrCode: string | null;
  isConnected: boolean;
  phone: string | null;
}

class WhatsAppService {
  private instances: Map<string, WhatsAppInstance> = new Map();

  constructor() {
    if (!fs.existsSync(SESSIONS_PATH)) {
      fs.mkdirSync(SESSIONS_PATH, { recursive: true });
    }
  }

  private getSessionPath(instanceId: string): string {
    return path.join(SESSIONS_PATH, instanceId);
  }

  async createInstance(instanceId: string, name: string, apiKey: string): Promise<{ success: boolean; qr?: string; message?: string }> {
    try {
      db.createInstance(instanceId, name, apiKey);

      const sessionPath = this.getSessionPath(instanceId);
      if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
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
    } catch (error: any) {
      console.error('Error creando instancia:', error);
      return {
        success: false,
        message: error.message || 'Error al crear instancia'
      };
    }
  }

  private async connectToWhatsApp(instanceId: string, sessionPath: string): Promise<Client> {
    const client = new Client({
      session: null,
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });
    
    client.on('qr', async (qr: string) => {
      const qrImage = await QRCode.toDataURL(qr);
      const instance = this.instances.get(instanceId);
      
      if (instance) {
        instance.qrCode = qrImage;
        db.updateInstanceQR(instanceId, qrImage, Date.now() + 60000);
      }
    });

    client.on('ready', () => {
      console.log(`✅ ¡Conectado! Instancia: ${instanceId}`);
      
      const instance = this.instances.get(instanceId);
      if (instance) {
        instance.isConnected = true;
        const phone = client.info?.wid?.user || null;
        instance.phone = phone;
        db.updateInstanceStatus(instanceId, 'connected', phone);
      }
    });

    client.on('disconnected', (reason: string) => {
      console.log(`Conexión cerrada. Razón: ${reason}`);

      const instance = this.instances.get(instanceId);
      if (instance) {
        instance.isConnected = false;
        db.updateInstanceStatus(instanceId, 'disconnected');
      }
    });

    client.on('message', async (message: Message) => {
      if (!message.fromMe) {
        await this.handleIncomingMessage(instanceId, message);
      }
    });

    client.initialize();

    return client;
  }

  private async handleIncomingMessage(instanceId: string, message: Message): Promise<void> {
    try {
      const phone = message.from.replace('@c.us', '');
      const messageId = message.id._serialized || '';
      const timestamp = message.timestamp * 1000;
      const chatId = message.from;

      let messageType = 'text';
      let content = message.body || '';
      let mediaUrl: string | null = null;
      let caption: string | null = null;

      // Determinar tipo de mensaje
      if (message.type === 'image') {
        messageType = 'image';
        caption = (message as any).caption || null;
      } else if (message.type === 'video') {
        messageType = 'video';
        caption = (message as any).caption || null;
      } else if (message.type === 'document') {
        messageType = 'document';
        caption = (message as any).caption || null;
      } else if (message.type === 'audio') {
        messageType = 'audio';
      } else if (message.type === 'sticker') {
        messageType = 'sticker';
      } else if (message.type === 'location') {
        messageType = 'location';
      } else if (message.type === 'vcard') {
        messageType = 'vcard';
      }

      // Obtener nombre del contacto
      let contactName = phone;
      try {
        const contact = await message.getContact();
        if (contact && contact.pushname) {
          contactName = contact.pushname;
        } else if (contact && contact.verifiedName) {
          contactName = contact.verifiedName;
        }
      } catch (e) {
        // Si no se puede obtener el nombre, usar teléfono
      }

      const client = db.createOrUpdateClient(instanceId, phone, contactName);
      const chat = db.createOrUpdateChat(instanceId, client.id);

      db.saveMessage(
        instanceId,
        chat.id,
        client.id,
        messageId,
        messageType,
        content,
        mediaUrl,
        false,
        timestamp
      );

      db.updateChatLastMessage(chat.id, content.substring(0, 100), timestamp);

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

    } catch (error) {
      console.error('Error manejando mensaje entrante:', error);
    }
  }

  async sendMessage(instanceId: string, phone: string, messageText: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
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
      const client = db.createOrUpdateClient(instanceId, phone);
      const chat = db.createOrUpdateChat(instanceId, client.id);

      db.saveMessage(
        instanceId,
        chat.id,
        client.id,
        result.id._serialized || '',
        'text',
        messageText,
        null,
        true,
        timestamp
      );

      db.updateChatLastMessage(chat.id, messageText.substring(0, 100), timestamp);

      return { success: true, messageId: result.id._serialized };
    } catch (error: any) {
      console.error('Error enviando mensaje:', error);
      return { success: false, error: error.message };
    }
  }

  getInstanceStatus(instanceId: string): any {
    const instance = this.instances.get(instanceId);
    const dbInstance = db.getInstance(instanceId);

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

  getQRCode(instanceId: string): string | null {
    const instance = this.instances.get(instanceId);
    return instance?.qrCode || null;
  }

  getChats(instanceId: string): any[] {
    return db.getChats(instanceId);
  }

  getClients(instanceId: string): any[] {
    return db.getClients(instanceId);
  }

  getMessages(instanceId: string, chatId: string): any[] {
    return db.getMessages(chatId);
  }

  async disconnect(instanceId: string): Promise<{ success: boolean }> {
    const instance = this.instances.get(instanceId);

    if (instance?.client) {
      instance.client.destroy();
    }

    this.instances.delete(instanceId);
    db.updateInstanceStatus(instanceId, 'disconnected');

    return { success: true };
  }

  private async sendWebhook(instanceId: string, event: string, data: any): Promise<void> {
    try {
      const webhooks = db.getWebhooks(instanceId);

      for (const webhook of webhooks) {
        const events = JSON.parse(webhook.events);
        
        if (events.includes(event) || events.includes('all')) {
          await axios.post(webhook.url, {
            event,
            instanceId,
            timestamp: Date.now(),
            data
          }).catch(err => {
            console.error(`Error enviando webhook a ${webhook.url}:`, err.message);
          });
        }
      }
    } catch (error) {
      console.error('Error en webhook:', error);
    }
  }

  loadInstances(): void {
    const instances = db.getAllInstances();
    
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

export const baileysService = new WhatsAppService();
