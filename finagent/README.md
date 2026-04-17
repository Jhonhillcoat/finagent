# FinAdvisor — Setup completo

App de análisis financiero personal con Claude AI, Next.js y Firebase.

---

## Stack

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS
- **Backend**: Next.js API Routes (serverless)
- **AI**: Claude claude-sonnet-4-20250514 via Anthropic SDK
- **Auth**: Firebase Authentication (Google Sign-In)
- **DB**: Firestore (guarda historial de análisis)
- **Deploy**: Firebase Hosting + Cloud Run

---

## Setup paso a paso

### 1. Clonar y instalar dependencias

```bash
cd finagent
npm install
```

### 2. Crear proyecto en Firebase

1. Ir a [console.firebase.google.com](https://console.firebase.google.com)
2. Crear nuevo proyecto → dale el nombre que quieras
3. Activar **Authentication** → Sign-in method → Google
4. Activar **Firestore Database** → modo producción
5. En Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada (descargás un JSON)

### 3. Activar APIs en Google Cloud Console

1. Ir a [console.cloud.google.com](https://console.cloud.google.com) → mismo proyecto que Firebase
2. APIs y Servicios → Habilitar API:
   - **Google Drive API**
   - **Google Picker API**
3. APIs y Servicios → Credenciales:
   - Crear **Clave de API** (para Google Picker) → copiar
   - En **IDs de cliente de OAuth 2.0** ya debería estar el de Firebase → copiar el Client ID

### 4. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Completar `.env.local` con:
- `ANTHROPIC_API_KEY` → [console.anthropic.com](https://console.anthropic.com) → API Keys
- Variables de Firebase del JSON de cuenta de servicio
- Variables `NEXT_PUBLIC_FIREBASE_*` del panel de Firebase (Configuración → General → Tu app web)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` y `NEXT_PUBLIC_GOOGLE_API_KEY` de Google Cloud Console

### 5. Probar en local

```bash
npm run dev
# → http://localhost:3000
```

### 6. Deploy a Firebase (Hosting + Cloud Run)

`firebase.json` enruta **todo** el tráfico a **Cloud Run** (`finagent`, región `us-central1`). Primero hay que tener **esa imagen** desplegada; después **Hosting + Firestore**.

1. **Proyecto por defecto**  
   Ajustá el id en `.firebaserc` (`default`) si no es el tuyo.

2. **Login**
```bash
npm install -g firebase-tools
firebase login
gcloud auth login
gcloud config set project TU_PROJECT_ID
```

3. **Imagen Docker** (desde la carpeta `finagent/`, con Docker instalado)
```bash
node scripts/docker-build-from-env.mjs -t gcr.io/TU_PROJECT_ID/finagent:latest
gcloud auth configure-docker
docker push gcr.io/TU_PROJECT_ID/finagent:latest
```

4. **Cloud Run** (variables del servidor: Anthropic + Firebase Admin)
```bash
gcloud run deploy finagent \
  --image gcr.io/TU_PROJECT_ID/finagent:latest \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "ANTHROPIC_API_KEY=...,FIREBASE_PROJECT_ID=...,FIREBASE_CLIENT_EMAIL=..."
```
`FIREBASE_PRIVATE_KEY` conviene cargarlo como **secreto** en Cloud Run (Variables y secretos).

5. **Hosting + reglas Firestore**
```bash
npm run deploy:hosting
```

La URL queda en `https://TU_PROJECT_ID.web.app`.

`npm run deploy` solo hace `next build` + `firebase deploy` (útil para verificar build); **no** sube la imagen a Cloud Run.

### 7. Agregar dominio personalizado (opcional)

Firebase Hosting → Dominios personalizados → Agregar dominio

---

## Estructura del proyecto

```
finagent/
├── app/
│   ├── api/
│   │   ├── analyze/route.ts    ← llama a Claude con los archivos
│   │   └── history/route.ts    ← historial desde Firestore
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                ← landing + upload
├── components/
│   └── Dashboard.tsx           ← dashboard interactivo
├── lib/
│   ├── firebase.ts             ← Firebase client
│   ├── firebaseAdmin.ts        ← Firebase Admin (server-side)
│   └── systemPrompt.ts         ← prompt del agente FinAdvisor
├── .env.example
├── firebase.json
├── firestore.rules
└── next.config.js
```

---

## Customización rápida

### Cambiar el modelo de Claude
En `app/api/analyze/route.ts`:
```ts
model: "claude-opus-4-6"  // más potente, más caro
model: "claude-haiku-4-5-20251001"  // más rápido, más barato
```

### Ajustar el prompt del agente
Todo en `lib/systemPrompt.ts`. Podés agregar:
- Contexto macroeconómico específico (ej: tasas BCRA actuales)
- Nuevas métricas o dimensiones de análisis
- Objetivos financieros personales (casa, jubilación, etc.)

### Agregar historial de análisis
En `components/Dashboard.tsx` podés agregar un botón que llame
a `/api/history?userId=...` para ver análisis anteriores y comparar.

---

## Archivos soportados

| Tipo | Extensiones | Qué extrae |
|------|-------------|------------|
| Excel | `.xlsx`, `.xls`, `.xlsm` | Todas las hojas como CSV |
| PDF | `.pdf` | Texto del documento |
| CSV | `.csv`, `.txt` | Texto plano |

---

## Costos estimados

| Servicio | Uso mensual estimado | Costo |
|----------|---------------------|-------|
| Claude Sonnet | 2-4 análisis/mes × 30K tokens | ~$0.30-0.60 |
| Firebase Hosting | — | Gratis (plan Spark) |
| Firestore | < 50K lecturas/escrituras | Gratis (plan Spark) |
| Cloud Run | Solo si superás el free tier | ~$0 para uso personal |

**Total estimado: < $1 USD/mes para uso personal.**
