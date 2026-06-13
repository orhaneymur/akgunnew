# Çalıştırma Kılavuzu — Yerel ve Production

Bu belge, **Akgün Teknik ERP v1.0** projesini yerel geliştirme ortamında ve canlı sunucuda çalıştırma adımlarını içerir.

---

## Yerel (Local) Çalıştırma

### Ön Koşullar

1. **Node.js v18+** kurulu olmalı
2. **Laragon** (veya eşdeğer MySQL sunucusu) kurulu olmalı
3. Git ile proje klonlanmış olmalı

---

### Adım 1 — Veritabanını Hazırla

1. **Laragon'u başlat**
2. **MySQL** servisinin çalıştığından emin ol
3. HeidiSQL veya Laragon arayüzünden `akgunteknik` adında bir veritabanı oluştur (yoksa migration otomatik oluşturur)

---

### Adım 2 — Backend Kurulumu

```bash
cd backend
npm install
```

`.env` dosyasını oluştur veya düzenle:

```env
DATABASE_URL="mysql://root:@127.0.0.1:3306/akgunteknik"
PORT=3000
```

Migration ve seed:

```bash
npx prisma migrate dev
npx prisma db seed
npx prisma generate
```

Backend sunucusunu başlat:

```bash
npm run dev
```

**Backend adresi:** `http://localhost:3000`

> `tsx watch` ile dosya değişikliklerinde otomatik yeniden yüklenir. Schema değişikliği sonrası `npx prisma generate` çalıştırın.

---

### Adım 3 — Frontend Kurulumu

Yeni bir terminal aç:

```bash
cd frontend
npm install
npm run dev
```

**Frontend adresi:** `http://localhost:5173`

---

### Adım 4 — Giriş Yap

Tarayıcıda `http://localhost:5173` adresini aç.

| Alan | Değer |
|------|-------|
| Kullanıcı Adı | `akgunteknik` |
| Şifre | `123456` |

Giriş sonrası tüm ERP modülleri (Dashboard, F2 satış, raporlar, menüler) açılır.

---

### Adım 5 — Excel Veri Aktarımı (Opsiyonel)

Gerçek müşteri ve ürün verilerini yüklemek için Excel dosyalarını `backend/` kök dizinine koy:

- `musteriler.xlsx`
- `urunler.xlsx`

Ardından:

```bash
cd backend
npx tsx src/utils/importAllData.ts
```

Script sırasıyla müşteri ve ürün/stok aktarımını yapar. MERKEZ_DEPO stokları Excel'deki `Bakiye` sütunundan okunur.

---

## Yerel Geliştirme İpuçları

| Konu | Bilgi |
|------|-------|
| **F2 kısayolu** | Her yerden Satış Yap ekranına geçer (giriş yapılmış olmalı) |
| **Backend logları** | Terminalde Fastify request logları görünür |
| **Prisma Studio** | `cd backend && npx prisma studio` ile veritabanını görsel incele |
| **Frontend build** | `cd frontend && npm run build` → `dist/` klasörü |
| **TypeScript kontrol** | Backend: `npx tsc --noEmit` · Frontend: `npm run build` |

---

## Canlı Sunucu (Production) Dağıtım Adımları

Bu bölüm, ERP'yi Linux sunucunuzdaki **Kubernetes (K8s)** kümesine taşımak için hazırlanan Docker imajları ve manifest dosyalarını adım adım anlatır. Rolling update stratejisi sayesinde güncellemeler **sıfır kesinti** hedefiyle yapılır.

### Dosya Yapısı

```
akgunteknik/
├── backend/
│   ├── Dockerfile          # Node 20 Alpine + Prisma + Fastify (3000)
│   └── .dockerignore
├── frontend/
│   ├── Dockerfile          # Vite build + Nginx (80)
│   ├── nginx.conf          # Statik dosya + /api proxy
│   └── .dockerignore
└── k8s/
    ├── backend-deployment.yaml   # Backend Deployment + Service
    └── frontend-deployment.yaml  # Frontend Deployment + Service (LoadBalancer)
```

---

### Ön Koşullar (Sunucu)

| Araç | Açıklama |
|------|----------|
| **Docker** | İmajları derlemek için |
| **kubectl** | K8s kümesine bağlı olmalı (`kubectl cluster-info`) |
| **MySQL** | Küme dışında veya cluster içinde erişilebilir veritabanı |
| **Registry** *(opsiyonel)* | İmajları uzak sunucuya push etmek için (Docker Hub, GHCR vb.) |

---

### Adım 1 — Veritabanı Secret'ını Oluştur

Backend pod'ları MySQL bağlantı dizesine ihtiyaç duyar. Kümede bir kez çalıştırın:

```bash
kubectl create secret generic akgunteknik-secrets \
  --from-literal=DATABASE_URL='mysql://KULLANICI:SIFRE@mysql-host:3306/akgunteknik'
```

> `mysql-host` — K8s içindeyse servis adı (ör. `mysql.default.svc.cluster.local`), dışarıdaysa sunucu IP'si.

---

### Adım 2 — Backend Docker İmajını Derle

Proje **ana dizininden** (monorepo kökü):

```bash
docker build -t akgunteknik-backend:latest ./backend
```

**İmaj içinde olanlar:**
- Node.js 20 Alpine (hafif)
- `npx prisma generate` ile üretilmiş Prisma Client
- Fastify API — port **3000**

Test (opsiyonel):

```bash
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="mysql://root:sifre@host.docker.internal:3306/akgunteknik" \
  akgunteknik-backend:latest
```

---

### Adım 3 — Frontend Docker İmajını Derle

```bash
docker build -t akgunteknik-frontend:latest ./frontend
```

**İmaj içinde olanlar:**
- `npm run build` ile derlenmiş Vite `dist/` çıktısı
- **Nginx Alpine** — statik dosyaları ışık hızında sunar
- `/api/*` isteklerini otomatik olarak `akgunteknik-backend:3000` servisine proxy eder

> Production build'de `VITE_API_BASE` boş bırakılır; tarayıcı aynı adresten `/api` konuşur.

Test (opsiyonel):

```bash
docker run --rm -p 8080:80 akgunteknik-frontend:latest
# Tarayıcı: http://localhost:8080
```

---

### Adım 4 — İmajları Registry'ye Push Et *(Uzak küme için)*

Sunucu imajları yerelde derlediyse bu adım gerekmez. CI/CD veya uzak registry kullanıyorsanız:

```bash
# Örnek: Docker Hub
docker tag akgunteknik-backend:latest KULLANICI/akgunteknik-backend:latest
docker tag akgunteknik-frontend:latest KULLANICI/akgunteknik-frontend:latest
docker push KULLANICI/akgunteknik-backend:latest
docker push KULLANICI/akgunteknik-frontend:latest
```

Manifest dosyalarındaki `image:` satırlarını registry adresinize göre güncelleyin.

---

### Adım 5 — Veritabanı Migration'larını Çalıştır

İlk dağıtımdan **önce** (veya backend pod'u üzerinden bir kez):

```bash
docker run --rm \
  -e DATABASE_URL="mysql://KULLANICI:SIFRE@mysql-host:3306/akgunteknik" \
  akgunteknik-backend:latest \
  npx prisma migrate deploy
```

---

### Adım 6 — Kubernetes'e Uygula

Proje ana dizininden:

```bash
kubectl apply -f k8s/
```

Bu komut şunları oluşturur/günceller:

| Kaynak | Replika | Port | Servis Tipi |
|--------|---------|------|-------------|
| `akgunteknik-backend` | 2 | 3000 | ClusterIP (iç ağ) |
| `akgunteknik-frontend` | 2 | 80 | LoadBalancer (dış erişim) |

Durumu kontrol et:

```bash
kubectl get pods
kubectl get svc
kubectl rollout status deployment/akgunteknik-backend
kubectl rollout status deployment/akgunteknik-frontend
```

Frontend **EXTERNAL-IP** adresinden ERP'ye girin:

```bash
kubectl get svc akgunteknik-frontend
```

---

### Adım 7 — Sıfır Kesintili Güncelleme (Rolling Update)

Kod değişikliği sonrası yeni imaj derleyip aynı etiketle güncelleyin:

```bash
# 1. Yeni imajları derle
docker build -t akgunteknik-backend:latest ./backend
docker build -t akgunteknik-frontend:latest ./frontend

# 2. Pod'ları yeniden başlat (rolling update tetiklenir)
kubectl rollout restart deployment/akgunteknik-backend
kubectl rollout restart deployment/akgunteknik-frontend

# 3. Güncellemenin tamamlandığını izle
kubectl rollout status deployment/akgunteknik-backend
kubectl rollout status deployment/akgunteknik-frontend
```

Manifest'te `maxUnavailable: 0` ve `maxSurge: 1` ayarlı — eski pod kapanmadan yenisi ayağa kalkar.

Geri alma gerekirse:

```bash
kubectl rollout undo deployment/akgunteknik-backend
kubectl rollout undo deployment/akgunteknik-frontend
```

---

### Production Ortam Değişkenleri

| Değişken | Nerede | Açıklama |
|----------|--------|----------|
| `DATABASE_URL` | K8s Secret | MySQL bağlantı dizesi |
| `PORT` | Deployment env | Backend dinleme portu (3000) |
| `NODE_ENV` | Deployment env | `production` |
| `VITE_API_BASE` | Docker build ARG | Boş = nginx proxy; dev'de `http://localhost:3000` |

---

### Mimari Özet

```
                    ┌─────────────────────────┐
  Kullanıcı ──────► │  akgunteknik-frontend   │  LoadBalancer :80
                    │  (Nginx + React SPA)    │
                    └───────────┬─────────────┘
                                │ /api/* proxy
                    ┌───────────▼─────────────┐
                    │  akgunteknik-backend    │  ClusterIP :3000
                    │  (Fastify + Prisma)     │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │  MySQL (harici / pod)   │
                    └─────────────────────────┘
```

---

## Canlı Sunucu (Production) Ön Bilgisi *(Arşiv)*

<details>
<summary>Eski planlama notları (tamamlandı)</summary>

### Mimari Hedefler

- **Stateless yapı** — Oturum bilgisi frontend `localStorage`'da; backend pod'lar arası paylaşımsız
- **Dockerize edilmeye hazır** — Backend ve frontend ayrı container imajları
- **Kubernetes (K8s) uyumlu** — `k8s/` dizinine manifestler eklendi
- **RAM hedefi** — Pod başına **15–20 MB** tüketim (Fastify + Prisma hafif stack)

### Production Checklist

```
[x] backend/Dockerfile
[x] frontend/Dockerfile (nginx ile statik serve)
[x] k8s/backend-deployment.yaml
[x] k8s/frontend-deployment.yaml
[ ] k8s/ingress.yaml (LoadBalancer yerine Ingress kullanılacaksa)
[ ] Production DATABASE_URL (managed MySQL)
[ ] HTTPS / reverse proxy (nginx veya Traefik)
[ ] Auth güvenliği güçlendirme (JWT, bcrypt — Faz 2+)
```

</details>

## Sorun Giderme

| Sorun | Çözüm |
|-------|-------|
| F2 arama sonuç vermiyor | `npx prisma generate` çalıştır, backend'i yeniden başlat |
| `Unknown field costPrice` | Prisma client güncel değil → `npx prisma generate` |
| Frontend API'ye ulaşamıyor | Backend'in 3000 portunda çalıştığını doğrula |
| MySQL bağlantı hatası | Laragon MySQL servisini kontrol et, `DATABASE_URL`'i doğrula |
| Giriş yapılamıyor | `akgunteknik` / `123456` — backend `/api/auth/login` endpoint'ini test et |
| Excel import hatası | `musteriler.xlsx` ve `urunler.xlsx` dosyalarının `backend/` içinde olduğunu doğrula |

---

## Port Özeti

| Servis | Port | URL |
|--------|------|-----|
| Backend API | 3000 | http://localhost:3000 |
| Frontend (Vite dev) | 5173 | http://localhost:5173 |
| MySQL (Laragon) | 3306 | 127.0.0.1:3306 |
| Prisma Studio | 5555 | http://localhost:5555 |
