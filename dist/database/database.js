"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const sql_js_1 = __importDefault(require("sql.js"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const DATABASE_PATH = process.env.DATABASE_PATH || './database/whatsapp.db';
let database = null;
let dbPath = DATABASE_PATH;
async function initDatabase() {
    const SQL = await (0, sql_js_1.default)();
    // Cargar base de datos existente o crear nueva
    if (fs_1.default.existsSync(dbPath)) {
        const fileBuffer = fs_1.default.readFileSync(dbPath);
        database = new SQL.Database(fileBuffer);
    }
    else {
        database = new SQL.Database();
    }
    initializeTables();
    return database;
}
function saveDatabase() {
    if (database) {
        const data = database.export();
        const buffer = Buffer.from(data);
        const dbDir = path_1.default.dirname(dbPath);
        if (!fs_1.default.existsSync(dbDir)) {
            fs_1.default.mkdirSync(dbDir, { recursive: true });
        }
        fs_1.default.writeFileSync(dbPath, buffer);
    }
}
function initializeTables() {
    if (!database)
        return;
    database.run(`
    CREATE TABLE IF NOT EXISTS instances (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      status TEXT DEFAULT 'disconnected',
      qr_code TEXT,
      qr_expires_at INTEGER,
      api_key TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
    database.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      name TEXT,
      profile_picture TEXT,
      is_business INTEGER DEFAULT 0,
      last_message_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
    database.run(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      last_message TEXT,
      last_message_at INTEGER,
      unread_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
    database.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      message_id TEXT,
      type TEXT NOT NULL,
      content TEXT,
      media_url TEXT,
      from_me INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
    database.run(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL,
      url TEXT NOT NULL,
      events TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL
    )
  `);
    saveDatabase();
    console.log('✅ Base de datos inicializada correctamente');
}
// Métodos para Instancias
function createInstance(id, name, apiKey) {
    if (!database)
        return;
    const now = Date.now();
    database.run(`INSERT INTO instances (id, name, status, api_key, created_at, updated_at) VALUES (?, ?, 'pending', ?, ?, ?)`, [id, name, apiKey, now, now]);
    saveDatabase();
}
function updateInstanceQR(id, qr, expiresAt) {
    if (!database)
        return;
    database.run(`UPDATE instances SET qr_code = ?, qr_expires_at = ?, updated_at = ? WHERE id = ?`, [qr, expiresAt, Date.now(), id]);
    saveDatabase();
}
function updateInstanceStatus(id, status, phone) {
    if (!database)
        return;
    database.run(`UPDATE instances SET status = ?, phone = ?, updated_at = ? WHERE id = ?`, [status, phone || null, Date.now(), id]);
    saveDatabase();
}
function getInstance(id) {
    if (!database)
        return null;
    const result = database.exec(`SELECT * FROM instances WHERE id = ?`, [id]);
    if (result.length === 0 || result[0].values.length === 0)
        return null;
    const columns = result[0].columns;
    const values = result[0].values[0];
    const instance = {};
    columns.forEach((col, i) => instance[col] = values[i]);
    return instance;
}
function getAllInstances() {
    if (!database)
        return [];
    const result = database.exec(`SELECT * FROM instances ORDER BY created_at DESC`);
    if (result.length === 0)
        return [];
    const columns = result[0].columns;
    return result[0].values.map((values) => {
        const instance = {};
        columns.forEach((col, i) => instance[col] = values[i]);
        return instance;
    });
}
function deleteInstance(id) {
    if (!database)
        return;
    database.run(`DELETE FROM instances WHERE id = ?`, [id]);
    saveDatabase();
}
// Métodos para Clientes
function createOrUpdateClient(instanceId, phone, name, profilePicture) {
    if (!database)
        return null;
    const now = Date.now();
    const id = `client_${phone}`;
    const existing = database.exec(`SELECT * FROM clients WHERE instance_id = ? AND phone = ?`, [instanceId, phone]);
    if (existing.length > 0 && existing[0].values.length > 0) {
        database.run(`UPDATE clients SET name = ?, profile_picture = ?, last_message_at = ?, updated_at = ? WHERE instance_id = ? AND phone = ?`, [name, profilePicture, now, now, instanceId, phone]);
        saveDatabase();
        return { id, instance_id: instanceId, phone, name };
    }
    else {
        database.run(`INSERT INTO clients (id, instance_id, phone, name, profile_picture, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, instanceId, phone, name || null, profilePicture || null, now, now]);
        saveDatabase();
        return { id, instance_id: instanceId, phone, name, created_at: now, updated_at: now };
    }
}
function getClients(instanceId) {
    if (!database)
        return [];
    const result = database.exec(`SELECT * FROM clients WHERE instance_id = ? ORDER BY last_message_at DESC`, [instanceId]);
    if (result.length === 0)
        return [];
    const columns = result[0].columns;
    return result[0].values.map((values) => {
        const client = {};
        columns.forEach((col, i) => client[col] = values[i]);
        return client;
    });
}
// Métodos para Chats
function createOrUpdateChat(instanceId, clientId) {
    if (!database)
        return null;
    const now = Date.now();
    const id = `chat_${clientId}`;
    const existing = database.exec(`SELECT * FROM chats WHERE instance_id = ? AND client_id = ?`, [instanceId, clientId]);
    if (existing.length > 0 && existing[0].values.length > 0) {
        return { id, instance_id: instanceId, client_id: clientId };
    }
    else {
        database.run(`INSERT INTO chats (id, instance_id, client_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`, [id, instanceId, clientId, now, now]);
        saveDatabase();
        return { id, instance_id: instanceId, client_id: clientId, created_at: now, updated_at: now };
    }
}
function updateChatLastMessage(chatId, message, timestamp) {
    if (!database)
        return;
    database.run(`UPDATE chats SET last_message = ?, last_message_at = ?, updated_at = ? WHERE id = ?`, [message, timestamp, Date.now(), chatId]);
    saveDatabase();
}
function getChats(instanceId) {
    if (!database)
        return [];
    const result = database.exec(`SELECT c.*, cl.phone, cl.name, cl.profile_picture FROM chats c JOIN clients cl ON c.client_id = cl.id WHERE c.instance_id = ? ORDER BY c.last_message_at DESC`, [instanceId]);
    if (result.length === 0)
        return [];
    const columns = result[0].columns;
    return result[0].values.map((values) => {
        const chat = {};
        columns.forEach((col, i) => chat[col] = values[i]);
        return chat;
    });
}
// Métodos para Mensajes
function saveMessage(instanceId, chatId, clientId, messageId, type, content, mediaUrl, fromMe, timestamp) {
    if (!database)
        return;
    const now = Date.now();
    const id = `msg_${messageId}`;
    database.run(`INSERT INTO messages (id, instance_id, chat_id, client_id, message_id, type, content, media_url, from_me, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, instanceId, chatId, clientId, messageId, type, content, mediaUrl, fromMe ? 1 : 0, timestamp, now]);
    saveDatabase();
}
function getMessages(chatId) {
    if (!database)
        return [];
    const result = database.exec(`SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC`, [chatId]);
    if (result.length === 0)
        return [];
    const columns = result[0].columns;
    return result[0].values.map((values) => {
        const msg = {};
        columns.forEach((col, i) => msg[col] = values[i]);
        return msg;
    });
}
// Métodos para Webhooks
function createWebhook(instanceId, url, events) {
    if (!database)
        return;
    const now = Date.now();
    const id = `webhook_${Date.now()}`;
    const eventsJson = JSON.stringify(events);
    database.run(`INSERT INTO webhooks (id, instance_id, url, events, created_at) VALUES (?, ?, ?, ?, ?)`, [id, instanceId, url, eventsJson, now]);
    saveDatabase();
}
function getWebhooks(instanceId) {
    if (!database)
        return [];
    const result = database.exec(`SELECT * FROM webhooks WHERE instance_id = ? AND enabled = 1`, [instanceId]);
    if (result.length === 0)
        return [];
    const columns = result[0].columns;
    return result[0].values.map((values) => {
        const webhook = {};
        columns.forEach((col, i) => webhook[col] = values[i]);
        return webhook;
    });
}
function deleteWebhook(id) {
    if (!database)
        return;
    database.run(`DELETE FROM webhooks WHERE id = ?`, [id]);
    saveDatabase();
}
exports.db = {
    init: initDatabase,
    createInstance,
    updateInstanceQR,
    updateInstanceStatus,
    getInstance,
    getAllInstances,
    deleteInstance,
    createOrUpdateClient,
    getClients,
    createOrUpdateChat,
    updateChatLastMessage,
    getChats,
    saveMessage,
    getMessages,
    createWebhook,
    getWebhooks,
    deleteWebhook
};
//# sourceMappingURL=database.js.map