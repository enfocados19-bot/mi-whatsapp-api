"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const baileys_1 = require("../services/baileys");
const database_1 = require("../database/database");
const router = (0, express_1.Router)();
// Middleware para verificar API Key
const verifyApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const instanceId = req.params.instanceId;
    if (!apiKey) {
        return res.status(401).json({ success: false, error: 'API Key requerida' });
    }
    const instance = database_1.db.getInstance(instanceId);
    if (!instance || instance.api_key !== apiKey) {
        return res.status(401).json({ success: false, error: 'API Key inválida' });
    }
    next();
};
// ============================================
// RUTAS DE INSTANCIAS
// ============================================
// Crear nueva instancia
router.post('/instance/create', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, error: 'Nombre de instancia requerido' });
        }
        const instanceId = (0, uuid_1.v4)();
        const apiKey = (0, uuid_1.v4)();
        const result = await baileys_1.baileysService.createInstance(instanceId, name, apiKey);
        if (result.success) {
            res.json({
                success: true,
                data: {
                    instanceId,
                    name,
                    apiKey,
                    message: result.message
                }
            });
        }
        else {
            res.status(500).json({ success: false, error: result.message });
        }
    }
    catch (error) {
        console.error('Error creando instancia:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Obtener estado de instancia
router.get('/instance/:instanceId/status', verifyApiKey, (req, res) => {
    try {
        const { instanceId } = req.params;
        const status = baileys_1.baileysService.getInstanceStatus(instanceId);
        res.json({ success: true, data: status });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Obtener QR Code
router.get('/instance/:instanceId/qr', verifyApiKey, async (req, res) => {
    try {
        const { instanceId } = req.params;
        const qrCode = baileys_1.baileysService.getQRCode(instanceId);
        const status = baileys_1.baileysService.getInstanceStatus(instanceId);
        res.json({
            success: true,
            data: {
                qr: qrCode,
                status: status.status,
                expiresAt: status.qrExpiresAt
            }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Conectar/Reconectar instancia
router.post('/instance/:instanceId/connect', verifyApiKey, async (req, res) => {
    try {
        const { instanceId } = req.params;
        const result = await baileys_1.baileysService.createInstance(instanceId, 'Reconnect', '');
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Desconectar instancia
router.post('/instance/:instanceId/disconnect', verifyApiKey, async (req, res) => {
    try {
        const { instanceId } = req.params;
        const result = await baileys_1.baileysService.disconnect(instanceId);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Listar todas las instancias
router.get('/instances', (req, res) => {
    try {
        const instances = database_1.db.getAllInstances();
        const instancesWithStatus = instances.map((instance) => {
            const status = baileys_1.baileysService.getInstanceStatus(instance.id);
            return {
                id: instance.id,
                name: instance.name,
                phone: status.phone,
                status: status.status,
                createdAt: instance.created_at
            };
        });
        res.json({ success: true, data: instancesWithStatus });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ============================================
// RUTAS DE MENSAJES
// ============================================
// Enviar mensaje de texto
router.post('/message/send', verifyApiKey, async (req, res) => {
    try {
        const { instanceId, phone, message } = req.body;
        if (!phone || !message) {
            return res.status(400).json({ success: false, error: 'Teléfono y mensaje requeridos' });
        }
        const result = await baileys_1.baileysService.sendMessage(instanceId, phone, message);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ============================================
// RUTAS DE CHATS Y CLIENTES
// ============================================
// Obtener todos los chats
router.get('/chats/:instanceId', verifyApiKey, (req, res) => {
    try {
        const { instanceId } = req.params;
        const chats = baileys_1.baileysService.getChats(instanceId);
        res.json({ success: true, data: chats });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Obtener clientes
router.get('/clients/:instanceId', verifyApiKey, (req, res) => {
    try {
        const { instanceId } = req.params;
        const clients = baileys_1.baileysService.getClients(instanceId);
        res.json({ success: true, data: clients });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Obtener mensajes de un chat
router.get('/messages/:instanceId/:chatId', verifyApiKey, (req, res) => {
    try {
        const { instanceId, chatId } = req.params;
        const messages = baileys_1.baileysService.getMessages(instanceId, chatId);
        res.json({ success: true, data: messages });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ============================================
// RUTAS DE WEBHOOKS
// ============================================
// Configurar webhook
router.post('/webhook/set', verifyApiKey, (req, res) => {
    try {
        const { instanceId, url, events } = req.body;
        if (!url || !events) {
            return res.status(400).json({ success: false, error: 'URL y eventos requeridos' });
        }
        database_1.db.createWebhook(instanceId, url, events);
        res.json({ success: true, message: 'Webhook configurado correctamente' });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ============================================
// RUTAS PÚBLICAS (para n8n)
// ============================================
// Webhook público para recibir mensajes
router.post('/webhook/:instanceId', async (req, res) => {
    try {
        const { instanceId } = req.params;
        const { phone, message } = req.body;
        if (!phone || !message) {
            return res.status(400).json({ success: false, error: 'Teléfono y mensaje requeridos' });
        }
        const result = await baileys_1.baileysService.sendMessage(instanceId, phone, message);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=instance.js.map