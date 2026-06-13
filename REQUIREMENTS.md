# Gereksinimler ve Altyapı

Bu belge, **Akgün Teknik ERP v1.0** projesinin çalışması için gerekli sistem bileşenlerini, paket bağımlılıklarını ve veritabanı yapısını tanımlar.

---

## Sistem Gereksinimleri

| Bileşen | Minimum Sürüm | Not |
|---------|---------------|-----|
| **Node.js** | v18+ (önerilen: v20+) | Backend ve frontend geliştirme |
| **npm** | v9+ | Paket yönetimi |
| **MySQL** | 8.0+ | Laragon üzerinden veya bağımsız sunucu |
| **Laragon** | Güncel sürüm | Yerel geliştirme için önerilen MySQL ortamı |
| **Git** | — | Versiyon kontrolü |

### Veritabanı

- **Veritabanı adı:** `akgunteknik`
- **Bağlantı:** `backend/.env` içindeki `DATABASE_URL`
- **Örnek:** `mysql://root:@127.0.0.1:3306/akgunteknik`

---

## Backend Paketleri

**Konum:** `backend/package.json`

| Paket | Amaç |
|-------|------|
| `fastify` | HTTP API sunucusu (hafif, yüksek performans) |
| `@fastify/cors` | Cross-origin istek desteği (frontend ↔ backend) |
| `@prisma/client` | Veritabanı ORM istemcisi |
| `@prisma/adapter-mariadb` | MySQL / MariaDB bağlantı adaptörü |
| `prisma` | Şema yönetimi, migration, generate |
| `dotenv` | Ortam değişkenleri (.env) |
| `xlsx` | Excel import motoru (`importAllData.ts`) |
| `tsx` | TypeScript dosyalarını doğrudan çalıştırma |
| `typescript` | Tip güvenliği |

### Backend Geliştirme Araçları

- `@types/node` — Node.js tip tanımları
- Prisma CLI — `npx prisma migrate dev`, `npx prisma db seed`, `npx prisma generate`

---

## Frontend Paketleri

**Konum:** `frontend/package.json`

| Paket | Amaç |
|-------|------|
| `react` | UI bileşen kütüphanesi |
| `react-dom` | DOM render |
| `vite` | Geliştirme sunucusu ve production build |
| `tailwindcss` (v4) | Utility-first CSS framework |
| `axios` | Backend API HTTP istemcisi |
| `lucide-react` | İkon seti (sidebar, dashboard, formlar) |
| `typescript` | Tip güvenliği |

---

## Proje Dizin Yapısı (Detay)

```
backend/
├── prisma/
│   ├── schema.prisma       # Veritabanı şeması
│   ├── seed.ts             # Başlangıç verileri
│   └── migrations/         # Migration geçmişi
├── src/
│   ├── index.ts            # Ana API sunucusu (tüm endpoint'ler)
│   ├── lib/prisma.ts       # Prisma client singleton
│   └── utils/
│       └── importAllData.ts  # Excel toplu aktarım scripti
├── musteriler.xlsx         # Müşteri Excel kaynağı
├── urunler.xlsx            # Ürün Excel kaynağı
└── .env                    # DATABASE_URL ve PORT

frontend/
├── src/
│   ├── App.tsx             # Ana layout, auth koruması, routing
│   ├── components/
│   │   └── Sidebar.tsx     # Sol menü + güvenli çıkış
│   ├── lib/
│   │   ├── api.ts          # API base URL, kur sabitleri, yardımcılar
│   │   └── navigation.ts   # Menü ağacı ve sayfa ID'leri
│   └── pages/              # Tüm ERP ekranları
└── public/                 # Statik dosyalar (favicon vb.)
```

---

## Veritabanı Yapısı (MySQL / Prisma)

### Temel Tablolar

#### `Product` — Stok Kartı
| Alan | Tip | Açıklama |
|------|-----|----------|
| `sku` | String (unique) | Stok kodu |
| `barcode` | String? (unique) | Barkod |
| `name` | String | Ürün adı |
| `costPrice` | Float | Alış maliyeti (kâr hesabı) |
| `priceTl` | Float | Satış fiyatı (TL) |
| `priceUsd` | Float | Satış fiyatı (USD) |

#### `ProductStock` — Depo Stokları
| Alan | Tip | Açıklama |
|------|-----|----------|
| `productId` | Int | Ürün FK |
| `branchId` | Int | Şube / depo FK |
| `quantity` | Float | Mevcut adet |

**Depo şubeleri:** `MERKEZ_DEPO` (satış stoğu), `ARIZALI_DEPO` (arızalı iade)

#### `Customer` — Cari Hesap
| Alan | Tip | Açıklama |
|------|-----|----------|
| `code` | String (unique) | Cari kodu |
| `name` | String | Ünvan |
| `contactPerson` | String? | Yetkili adı soyadı |
| `address`, `district`, `city` | String? | Adres bilgileri |
| `email`, `phone` | String? | İletişim |
| `taxOffice`, `taxNumber` | String? | Vergi bilgileri |
| `creditLimit` | Float | Kredi limiti |
| `balance` | Float | Cari bakiye (borç/alacak) |

#### `Invoice` — Fatura
| Alan | Tip | Açıklama |
|------|-----|----------|
| `invoiceNo` | String (unique) | Fatura numarası |
| `type` | String | `SATIS`, `ALIS`, `IADE` |
| `customerId` | Int | Müşteri FK |
| `safeId` | Int | Kasa FK |
| `branchId` | Int | Şube FK |
| `userId` | Int? | Personel FK |
| `paymentMethod` | String | Ödeme kanalı: Nakit, EFT/Havale, Kart, Cari |
| `paymentType` | String? | Ödeme şekli: Peşin, Vadeli |
| `exchangeRate` | Float | Satış anı USD/TL kuru |
| `deliveryType` | String | Mağazadan Teslim, Kargo |
| `dueDate` | DateTime? | Vade tarihi |
| `isPreOrder` | Boolean | Ön sipariş (stok düşmez) |
| `processedBy` | String? | İşlemi yapan personel adı |
| `orderNotes` | Text? | Sipariş açıklaması |
| `totalAmountTl` | Float | Toplam tutar (TL) |
| `totalAmountUsd` | Float | Toplam tutar (USD) |

#### `InvoiceItem` — Fatura Kalemi
| Alan | Tip | Açıklama |
|------|-----|----------|
| `invoiceId` | Int | Fatura FK |
| `productId` | Int | Ürün FK |
| `quantity` | Float | Adet |
| `unitPrice` | Float | Birim fiyat (satış anındaki) |
| `totalPrice` | Float | Satır toplamı |

#### `Transaction` — Kasa Hareketi
| Alan | Tip | Açıklama |
|------|-----|----------|
| `safeId` | Int | Kasa FK |
| `customerId` | Int? | Opsiyonel cari FK |
| `type` | Enum | `GIRIS` / `CIKIS` |
| `amount` | Float | Tutar |
| `description` | String | Açıklama |

#### `Safe` — Kasa
| Alan | Tip | Açıklama |
|------|-----|----------|
| `branchId` | Int | Şube FK |
| `name` | String | Kasa adı |
| `currency` | String | TRY, USD, EUR |
| `balance` | Float | Güncel bakiye |

#### `User` — Personel
| Alan | Tip | Açıklama |
|------|-----|----------|
| `name` | String | Ad soyad |
| `email` | String (unique) | E-posta |
| `password` | String | Şifre (hash) |
| `role` | String | `admin`, `staff` |

### Yardımcı Tablolar

- **`Branch`** — Şube / depo tanımı (`STORE`, `WAREHOUSE`)
- **`Category`** — Ürün kategorisi
- **`BrandModel`** — Marka / model tanımı

---

## Ortam Değişkenleri

### Backend (`backend/.env`)

```env
DATABASE_URL="mysql://root:@127.0.0.1:3306/akgunteknik"
PORT=3000
```

### Frontend

API adresi `frontend/src/lib/api.ts` içinde sabitlenmiştir:

```typescript
export const API_BASE = 'http://localhost:3000';
```

Production ortamında bu değer güncellenmelidir.

---

## Auth (Güvenlik)

| Parametre | Değer |
|-----------|-------|
| Endpoint | `POST /api/auth/login` |
| Kullanıcı adı | `akgunteknik` |
| Şifre | `123456` |
| Frontend anahtarı | `localStorage.isLoggedIn = 'true'` |

> **Not:** v1.0'da tek ortak admin girişi kullanılmaktadır. Çoklu kullanıcı yapısı Faz 2+ kapsamındadır.

---

## Excel Import Gereksinimleri

| Dosya | Konum | İçerik |
|-------|-------|--------|
| `musteriler.xlsx` | `backend/` | CariKodu, CariAdi, YetkiliAdi, Adres, Il, Ilce, Email, Gsm, Vergi bilgileri |
| `urunler.xlsx` | `backend/` | StokKodu, StokAdi, AlisFiyati, SatisFiyati, Bakiye (stok miktarı) |

Çalıştırma: `cd backend && npx tsx src/utils/importAllData.ts`
