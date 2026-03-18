import { Client } from 'whatsapp-web.js';
export interface WhatsAppInstance {
    id: string;
    name: string;
    client: Client | null;
    qrCode: string | null;
    isConnected: boolean;
    phone: string | null;
}
declare class WhatsAppService {
    private instances;
    constructor();
    private getSessionPath;
    createInstance(instanceId: string, name: string, apiKey: string): Promise<{
        success: boolean;
        qr?: string;
        message?: string;
    }>;
    private connectToWhatsApp;
    private handleIncomingMessage;
    sendMessage(instanceId: string, phone: string, messageText: string): Promise<{
        success: boolean;
        messageId?: string;
        error?: string;
    }>;
    getInstanceStatus(instanceId: string): any;
    getQRCode(instanceId: string): string | null;
    getChats(instanceId: string): any[];
    getClients(instanceId: string): any[];
    getMessages(instanceId: string, chatId: string): any[];
    disconnect(instanceId: string): Promise<{
        success: boolean;
    }>;
    private sendWebhook;
    loadInstances(): void;
}
export declare const baileysService: WhatsAppService;
export {};
//# sourceMappingURL=baileys.d.ts.map