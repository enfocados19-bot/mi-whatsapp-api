import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { baileysService } from '../services/baileys';
import { db } from '../database/database';

const router = Router();

// Middleware para verificar API Key
const verifyApiKey = (req: Request, res: Response, next: Function) => {
  const apiKey = req.headers['x-api-key'] as string;
  const instanceId = req.params.instanceId || req.params.name;

  if (!apiKey) {
    return res.status(401).json({ success: false, error: 'API Key requerida' });
  }

  const instance = db.getInstance(instanceId);
  if (!instance || instance.api_key !== apiKey) {
    return res.status(401).json({ success: false, error: 'API Key inválida' });
  }

  next();
};

// Middleware para obtener API Key desde query o body
const getApiKey = (req: Request): string => {
  return req.query.apiKey as string || req.body.apiKey as string || req.headers['x-api-key'] as string;
};

// ============================================
// RUTAS COMPATIBLES CON TU PANEL (Evolution API style)
// ============================================

// Listar instancias - Compatible con tu panel
router.get('/api/instances', (req: Request, res: Response) => {
  try {
    const instances = db.getAllInstances();
    
    const instancesData = instances.map((instance: any) => {
      const status = baileysService.getInstanceStatus(instance.id);
      return {
        instance: {
          instanceName: instance.name,
          instanceId: instance.id,
          status: status.status || instance.status,
          phone: status.phone || instance.phone,
          qrCode: status.qrCode || instance.qr_code,
          apiKey: instance.api_key,
          created_at: instance.created_at
        }
      };
    });

    res.json(instancesData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Crear instancia - Compatible con tu panel
router.post('/api/instances', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nombre de instancia requerido' });
    }

    const instanceId = uuidv4();
    const apiKey = uuidv4();

    const result = await baileysService.createInstance(instanceId, name, apiKey);

    res.json({
      instance: {
        instanceName: name,
        instanceId: instanceId,
        qrcode: true,
        apiKey: apiKey
      },
      ...result
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar instancia
router.delete('/api/instances/:name', verifyApiKey, async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const apiKey = getApiKey(req);
    
    // Buscar instancia por nombre
    const instances = db.getAllInstances();
    const instance = instances.find((i: any) => i.name === name);
    
    if (instance) {
      await baileysService.disconnect(instance.id);
      db.deleteInstance(instance.id);
    }

    res.json({ status: 'success', instance: { instanceName: name } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener QR - Compatible con tu panel
router.get('/api/instances/:name/qr', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const apiKey = getApiKey(req);
    
    // Buscar instancia por nombre
    const instances = db.getAllInstances();
    const instance = instances.find((i: any) => i.name === name);
    
    if (!instance) {
      return res.status(404).json({ error: 'Instancia no encontrada' });
    }

    const qrCode = baileysService.getQRCode(instance.id);
    const status = baileysService.getInstanceStatus(instance.id);

    res.json({
      qrcode: qrCode,
      code: qrCode ? 200 : 404,
      status: status.status
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener estado de conexión
router.get('/api/instances/:name/state', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    
    const instances = db.getAllInstances();
    const instance = instances.find((i: any) => i.name === name);
    
    if (!instance) {
      return res.json({ instance: name, state: 'NOT_INITIALIZED' });
    }

    const status = baileysService.getInstanceStatus(instance.id);
    
    const stateMap: { [key: string]: string } = {
      'connected': 'OPEN',
      'disconnected': 'CLOSE',
      'pending': 'PAIRING'
    };

    res.json({
      instance: name,
      state: stateMap[status.status] || 'NOT_INITIALIZED'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener chats - Compatible con tu panel
router.get('/api/instances/:name/chats', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const apiKey = getApiKey(req);
    
    const instances = db.getAllInstances();
    const instance = instances.find((i: any) => i.name === name);
    
    if (!instance) {
      return res.status(404).json({ error: 'Instancia no encontrada' });
    }

    const chats = baileysService.getChats(instance.id);
    
    res.json(chats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Marcar mensajes como leídos
router.post('/api/instances/:name/read', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { jid } = req.body;
    
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Enviar mensaje - Compatible con tu panel
router.post('/api/instances/:name/send', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { number, textMessage, text, jid } = req.body;
    const phone = number || jid;
    
    if (!phone || !textMessage?.text && !text) {
      return res.status(400).json({ error: 'Número y mensaje requeridos' });
    }

    const messageText = textMessage?.text || text;
    
    const instances = db.getAllInstances();
    const instance = instances.find((i: any) => i.name === name);
    
    if (!instance) {
      return res.status(404).json({ error: 'Instancia no encontrada' });
    }

    const result = await baileysService.sendMessage(instance.id, phone, messageText);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle bot
router.post('/api/instances/:name/bot-toggle', (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { jid, active } = req.body;
    
    res.json({ success: true, instance: name, jid, active });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTAS DE INSTANCIAS (Mi API)
// ============================================

// Crear nueva instancia
router.post('/instance/create', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Nombre de instancia requerido' });
    }

    const instanceId = uuidv4();
    const apiKey = uuidv4();

    const result = await baileysService.createInstance(instanceId, name, apiKey);

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
    } else {
      res.status(500).json({ success: false, error: result.message });
    }
  } catch (error: any) {
    console.error('Error creando instancia:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener estado de instancia
router.get('/instance/:instanceId/status', verifyApiKey, (req: Request, res: Response) => {
  try {
    const { instanceId } = req.params;
    const status = baileysService.getInstanceStatus(instanceId);

    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener QR Code
router.get('/instance/:instanceId/qr', verifyApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceId } = req.params;
    const qrCode = baileysService.getQRCode(instanceId);
    const status = baileysService.getInstanceStatus(instanceId);

    res.json({
      success: true,
      data: {
        qr: qrCode,
        status: status.status,
        expiresAt: status.qrExpiresAt
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Conectar/Reconectar instancia
router.post('/instance/:instanceId/connect', verifyApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceId } = req.params;
    const result = await baileysService.createInstance(instanceId, 'Reconnect', '');

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Desconectar instancia
router.post('/instance/:instanceId/disconnect', verifyApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceId } = req.params;
    const result = await baileysService.disconnect(instanceId);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Listar todas las instancias
router.get('/instances', (req: Request, res: Response) => {
  try {
    const instances = db.getAllInstances();

    const instancesWithStatus = instances.map((instance: any) => {
      const status = baileysService.getInstanceStatus(instance.id);
      return {
        id: instance.id,
        name: instance.name,
        phone: status.phone,
        status: status.status,
        createdAt: instance.created_at
      };
    });

    res.json({ success: true, data: instancesWithStatus });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// RUTAS DE MENSAJES
// ============================================

// Enviar mensaje de texto
router.post('/message/send', verifyApiKey, async (req: Request, res: Response) => {
  try {
    const { instanceId, phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ success: false, error: 'Teléfono y mensaje requeridos' });
    }

    const result = await baileysService.sendMessage(instanceId, phone, message);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// RUTAS DE CHATS Y CLIENTES
// ============================================

// Obtener todos los chats
router.get('/chats/:instanceId', verifyApiKey, (req: Request, res: Response) => {
  try {
    const { instanceId } = req.params;
    const chats = baileysService.getChats(instanceId);

    res.json({ success: true, data: chats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener clientes
router.get('/clients/:instanceId', verifyApiKey, (req: Request, res: Response) => {
  try {
    const { instanceId } = req.params;
    const clients = baileysService.getClients(instanceId);

    res.json({ success: true, data: clients });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener mensajes de un chat
router.get('/messages/:instanceId/:chatId', verifyApiKey, (req: Request, res: Response) => {
  try {
    const { instanceId, chatId } = req.params;
    const messages = baileysService.getMessages(instanceId, chatId);

    res.json({ success: true, data: messages });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// RUTAS DE WEBHOOKS
// ============================================

// Configurar webhook
router.post('/webhook/set', verifyApiKey, (req: Request, res: Response) => {
  try {
    const { instanceId, url, events } = req.body;

    if (!url || !events) {
      return res.status(400).json({ success: false, error: 'URL y eventos requeridos' });
    }

    db.createWebhook(instanceId, url, events);

    res.json({ success: true, message: 'Webhook configurado correctamente' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// RUTAS PÚBLICAS (para n8n)
// ============================================

// Webhook público para recibir mensajes
router.post('/webhook/:instanceId', async (req: Request, res: Response) => {
  try {
    const { instanceId } = req.params;
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ success: false, error: 'Teléfono y mensaje requeridos' });
    }

    const result = await baileysService.sendMessage(instanceId, phone, message);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Webhook para Evolution API (compatibilidad)
router.post('/webhook/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const body = req.body;
    
    // Buscar instancia por nombre
    const instances = db.getAllInstances();
    const instance = instances.find((i: any) => i.name === name);
    
    if (!instance) {
      return res.status(404).json({ error: 'Instancia no encontrada' });
    }

    // Reenviar al webhook configurado en n8n
    // Esto ya lo maneja baileysService automáticamente
    
    res.json({ status: 'ok' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
