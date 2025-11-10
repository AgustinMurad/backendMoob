# Configuracion de la DB (MongoDB)

Configure la base de datos utilizando MongoDB Atlas con Mongoose.

---

### User Schema

**Ubicación:** `src/users/schemas/user.schema.ts`

**Campos:**

- `username`: string, único, 3-30 caracteres
- `email`: string, único, validación de formato
- `password`: string, mínimo 7 caracteres
- `createdAt`, `updatedAt`: automáticos

**Características:**

- ✅ Índices únicos automáticos
- ✅ Password excluido en respuestas JSON
- ✅ Timestamps automáticos

### Message Schema

**Ubicación:** `src/messages/schemas/message.schema.ts`

**Campos:**

- `senderId`: ObjectId → referencia a User
- `recipients`: string[] (mínimo 1)
- `platform`: enum (telegram, slack, discord, whatsapp)
- `content`: string, 1-5000 caracteres
- `file`: objeto opcional (name, path, type, size)
- `sent`, `delivered`: boolean (default: false)
- `errorMessage`: string opcional
- `createdAt`, `updatedAt`: automáticos

**Características:**

- ✅ Referencia a User con populate
- ✅ Enum Platform
- ✅ Índices para queries eficientes
- ✅ Validación de recipients

---

## Variables de Entorno

**Archivo `.env`:**

```env
MONGODB_URI=mongodb+srv://root:root@moob.flv6ehj.mongodb.net/moob-db?retryWrites=true&w=majority
```

---

## Estructura de carpetas

---

## Qué Tiene el Proyecto

✅ **Configuración de MongoDB** con Mongoose
✅ **Schema User** con validaciones
✅ **Schema Message** con referencias y enum

---

## Comandos

```bash
# Build
npm run build

# Desarrollo
npm run start:dev

# Producción
npm run start:prod
```

---

## Estado Actual

- ✅ MongoDB conectado a Atlas
- ✅ Schemas User y Message listos

---
