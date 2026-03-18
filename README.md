# 📱 Mi WhatsApp API

Una API personalizada para conectar WhatsApp Business con n8n y un panel de administración.

## 🚀 Características

- ✅ Conexión fácil por QR Code
- ✅ Sigue usando WhatsApp en tu celular normalmente
- ✅ Panel de administración visual
- ✅ Base de datos de clientes y conversaciones
- ✅ Webhooks para integración con n8n
- ✅ API REST completa

## 📋 Requisitos

- Node.js 18+ 
- npm o yarn
- Puerto 3000 disponible

## 🛠️ Instalación

### 1. Instalar dependencias

```bash
cd mi-whatsapp-api
npm install
```

### 2. Configurar variables de entorno

Edita el archivo `.env`:

```env
PORT=3000
HOST=0.0.0.0
API_KEY=mi-api-key-secreta
SESSIONS_PATH=./sessions
DATABASE_PATH=./database/whatsapp.db
```

### 3. Compilar TypeScript

```bash
npm run build
```

### 4. Iniciar el servidor

```bash
npm start
```

O para desarrollo con auto-reload:

```bash
npm run dev
```

## 📖 Uso

### Acceso

- **Panel Admin**: http://localhost:3000
- **API JSON**: http://localhost:3000/api

### Endpoints de la API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/instance/create` | Crear nueva instancia |
| GET | `/instance/:id/status` | Ver estado de conexión |
| GET | `/instance/:id/qr` | Obtener QR para conectar |
| POST | `/instance/:id/connect` | Conectar/reconectar |
| POST | `/instance/:id/disconnect` | Desconectar |
| GET | `/instances` | Listar todas las instancias |
| POST | `/message/send` | Enviar mensaje |
| GET | `/chats/:id` | Obtener conversaciones |
| GET | `/clients/:id` | Obtener clientes |
| GET | `/messages/:id/:chatId` | Obtener mensajes |
| POST | `/webhook/set` | Configurar webhook |
| POST | `/webhook/:id` | Enviar mensaje (público) |

## 📱 Conectar WhatsApp

1. Abre el panel en http://localhost:3000
2. Crea una nueva instancia
3. Haz clic en "Ver QR"
4. Escanea el QR con tu WhatsApp Business
5. ¡Listo! Ya puedes usar la API

## 🔗 Integración con n8n

### Recibir mensajes en n8n

1. En el panel, selecciona una instancia
2. Ve a la pestaña "Webhook"
3. Ingresa la URL de tu webhook de n8n
4. Selecciona los eventos a recibir
5. Guarda

### Enviar mensajes desde n8n

Usa el endpoint público:

```
POST http://localhost:3000/webhook/{instanceId}
```

Body:
```json
{
  "phone": "1234567890",
  "message": "Hola desde n8n!"
}
```

Headers:
```
Content-Type: application/json
```

### Usar con HTTP Request en n8n

```
URL: http://tu-servidor:3000/message/send
Method: POST
Headers:
  Content-Type: application/json
  x-api-key: TU-API-KEY
Body:
{
  "instanceId": "uuid-de-instancia",
  "phone": "1234567890",
  "message": "Tu mensaje aquí"
}
```

## 📁 Estructura del Proyecto

```
mi-whatsapp-api/
├── src/
│   ├── index.ts          # Servidor principal
│   ├── database/
│   │   └── database.ts   # Base de datos SQLite
│   ├── services/
│   │   └── baileys.ts    # Conexión WhatsApp
│   └── routes/
│       └── instance.ts   # Endpoints API
├── panel/
│   └── index.html        # Panel de administración
├── sessions/             # Sesiones de WhatsApp
├── database/             # Archivos SQLite
├── package.json
├── tsconfig.json
├── .env
└── README.md
```

## ⚠️ Notas Importantes

1. **Sesiones**: Las sesiones se guardan en la carpeta `sessions/`. No las borres o tendrás que reconectar.

2. **Tiempo de conexión**: El QR dura 60 segundos. Si expira, genera uno nuevo.

3. **Uso simultáneo**: Puedes usar WhatsApp en tu celular mientras la API está conectada.

4. **Reinicio**: Si reinicias el servidor, las instancias se reconectarán automáticamente.

## 🔧 Configuración Avanzada

### Cambiar puerto

Edita el archivo `.env`:
```env
PORT=8080
```

### Usar con Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 📝 Licencia

MIT License - Puedes usar este proyecto libremente.

## 🙌 Soporte

Si tienes problemas:
1. Verifica que el puerto 3000 esté disponible
2. Asegúrate de tener Node.js 18+
3. Revisa los logs en la consola

---

¡Disfruta de tu WhatsApp API personalizada! 🎉
