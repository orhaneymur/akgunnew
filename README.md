# Akgün Teknik ERP v1.0

## Proje Özeti

**Akgün Teknik ERP**, eski Laravel monolith yapısından arındırılmış; **Fastify**, **Prisma**, **MySQL** ve **React (Vite + Tailwind v4)** mimarisiyle yazılmış, sunucu dostu hafif ve klavye odaklı akıllı ön muhasebe / ERP sistemidir.

Dükkanın günlük operasyonları — satış, stok, cari, kasa, iade ve raporlama — tek bir monorepo içinde birleştirilmiştir. Excel'den aktarılmış **16.000+ ürün** ve **180+ müşteri** kaydı ile gerçek veri üzerinde çalışır.

---

## Monorepo Yapısı

```
akgunteknik/
├── backend/          # Fastify 5 + Prisma 7 + TypeScript API (Port: 3000)
├── frontend/         # React 19 + Vite 8 + Tailwind v4 (Port: 5173)
├── k8s/              # Kubernetes manifestleri (planlanıyor)
├── README.md         # Bu dosya — proje özeti
├── REQUIREMENTS.md   # Gereksinimler ve altyapı detayları
├── RUN_LOCAL_AND_PROD.md  # Yerel ve canlı çalıştırma kılavuzu
└── NEXT_STEPS.md     # Sıradaki adımlar ve yol haritası
```

---

## Tamamlanan Modüller

### Dashboard
- Günlük **kasa durumları** (TL / USD kasalar)
- **Personel ciroları** (günlük, aylık, yıllık)
- Renkli **fatura akışı** ve son **kasa hareketleri**
- Üst kısımda **6 hızlı erişim kartı**: Satış Yap, Alış Yap, İade Al, Stok Kartı Oluştur, Alış Listesi, Satış Listesi

### Hızlı Satış (F2)
- **F2** tuşu ile her yerden satış ekranına geçiş ve arama modalı
- Büyük/küçük harfe ve **Türkçe karaktere duyarsız** ürün arama motoru
- **↑ / ↓** ile sonuçlarda gezinme, **Enter** ile sepete ekleme, **Esc** ile kapatma
- Müşterinin **Son Satın Alma Fiyatını** otomatik getirme ve sepet satırında **Maliyet | Liste** kılavuzu
- Nakit / Cari ödeme, şube ve kasa seçimi

### Satış Yönetimi ve Dövizli Muhasebe

Hızlı Satış ekranı (`SalesCreate.tsx`) esnaf fatura düzenine göre **4 üst blok + akıllı sepet + fintech özet paneli** ile yeniden tasarlanmıştır.

#### Evrak ve Müşteri Üst Blokları

| Kutu | Alanlar |
|------|---------|
| **Evrak** | Sipariş No (`SF2026xxxx` önizleme), Fatura Tarihi, Vade Tarihi |
| **Müşteri** | Arama motorlu dropdown, anlık **Limit** ve **Bakiye** (seçim anında API'den) |
| **Ödeme** | EFT/Havale, Nakit, Kart, Cari · Peşin/Vadeli · Banka/Kasa seçimi |
| **Teslimat** | Mağazadan Teslim / Kargo · Sipariş açıklaması (textarea) |

#### Çift Para Birimi Matematik Motoru

- Sepet satırları **USD ($)** bazlı: `Maliyet ($)` ve `Fiyat ($)` veritabanından gelir
- Satır indirimi: `Toplam = (Adet × Fiyat) × (1 − Ind.% / 100)`
- **Net Toplam ($)** kırmızı büyük puntoda; **TL Toplam** = `Net Toplam ($) × Döviz Kuru`
- Üst bardaki kur (`46.3900`) satış panelinde düzenlenebilir input olarak kullanılır
- Müşteri değişince **Son Satın Aldığı Fiyat** otomatik USD'ye çevrilerek satıra yazılır

#### Veritabanı — Invoice Genişletmeleri

| Alan | Tip | Açıklama |
|------|-----|----------|
| `invoiceNo` | String | Benzersiz fatura numarası |
| `dueDate` | DateTime? | Vade tarihi |
| `paymentMethod` | String? | EFT/Havale, Nakit, Kart, Cari |
| `paymentType` | String? | Peşin, Vadeli |
| `deliveryType` | String? | Mağazadan Teslim, Kargo |
| `exchangeRate` | Float | Satış anı dolar kuru |
| `totalAmountUsd` | Float | Dolar net toplam |
| `totalAmountTl` | Float | TL net toplam |
| `isPreOrder` | Boolean | Ön sipariş — stok düşmez |
| `processedBy` | String? | İşlemi yapan personel |
| `orderNotes` | Text | Sipariş açıklaması |

`InvoiceItem.discountPercent` — satır indirim yüzdesi (varsayılan 0).

#### POST `/api/sales/store` Davranışı

- Tüm üst bilgiler (vade, ödeme, personel, açıklama, ön sipariş) kaydedilir
- **`isPreOrder: true`** → fatura oluşur, **MERKEZ_DEPO stok düşümü yapılmaz**
- Nakit / EFT / Kart → kasa bakiyesi ve tahsilat hareketi TL tutarıyla artar
- Cari → müşteri bakiyesi TL tutarıyla artar

#### Ön Sipariş & Yazdır

- **Ön Sipariş** checkbox'ı stoksuz sipariş kaydı için
- **Yazdır** tikliyken kayıt sonrası `window.print()` tetiklenir
- **KAYDET** — büyük yeşil esnaf butonu; tüm veriyi backend'e gönderir

### Stok ve Depo Yönetimi
- **`MERKEZ_DEPO`** — Satış stoğu (satış düşümü, sağlam iade girişi)
- **`ARIZALI_DEPO`** — Arızalı ürün izolasyon deposu
- Ürün kartlarında **`costPrice` (Alış Maliyeti)** ve **`priceTl` (Satış Fiyatı)** zorunlu takibi
- Stok listesi, barkod etiket, depo transfer ve stok kartı oluşturma ekranları

### Akıllı İade Lojiği
- **`isDefective: true`** → iade stoğu **ARIZALI_DEPO**'ya eklenir
- **`isDefective: false`** → iade stoğu **MERKEZ_DEPO** satış stoğuna geri yüklenir
- Müşteri carisinden iade tutarı düşülür, `IADE` tipi fatura oluşturulur

### Müşteri / Cari Yönetimi
- Excel'den aktarılmış **181 müşteri** ve **16.737 ürün** canlı veritabanında
- Anlık **borç / alacak** takibi, tahsilat / ödeme kayıtları
- Müşteri bakiye raporu ve **costPrice** bazlı **kâr-zarar analizi**

### Üst Bar Araçları
- Anlık **USD** ve **EUR** kur göstergeleri
- Satır içi **Döviz Çevirici** kutuları ($ ve € → anlık TL karşılığı)

### Güvenlik Kapısı
- **`akgunteknik` / `123456`** ile korunan admin giriş paneli
- `localStorage` tabanlı oturum kontrolü ve **Router koruması**
- Sol menü altında **Güvenli Çıkış** butonu

### Tanımlama Modülleri
- Kategori & Marka, Kasa, Personel tanımları
- Fatura listesi (Satış / Alış / İade filtreli)

---

## Teknoloji Özeti

| Katman | Teknoloji |
|--------|-----------|
| Backend API | Fastify 5, TypeScript, Prisma 7 |
| Veritabanı | MySQL (Laragon), MariaDB adapter |
| Frontend | React 19, Vite 8, Tailwind CSS v4 |
| HTTP İstemci | Axios |
| İkonlar | Lucide React |
| Excel Aktarım | xlsx |

---

## Hızlı Başlangıç

Detaylı kurulum adımları için → **[RUN_LOCAL_AND_PROD.md](./RUN_LOCAL_AND_PROD.md)**

```bash
# 1. Laragon'da MySQL'i başlat
# 2. Backend
cd backend && npm install && npx prisma migrate dev && npm run dev

# 3. Frontend (ayrı terminal)
cd frontend && npm install && npm run dev

# 4. Tarayıcı
http://localhost:5173
```

**Giriş:** `akgunteknik` / `123456`

---

## API Öne Çıkan Uçlar

| Method | Adres | Açıklama |
|--------|-------|----------|
| POST | `/api/auth/login` | Admin giriş |
| GET | `/api/sales/dashboard` | Ana sayfa verileri |
| GET | `/api/sales/products?search=&customerId=` | F2 ürün arama |
| POST | `/api/sales/store` | Satış kaydı |
| POST | `/api/sales/return` | İade kaydı |
| POST | `/api/products` | Stok kartı oluştur |
| GET | `/api/products?search=&page=&limit=` | Sayfalı stok listesi (`totalCount`, `page`, `limit`) |
| GET | `/api/customers?search=&page=&limit=` | Sayfalı müşteri listesi |
| GET | `/api/reports/profit` | Kâr-zarar raporu |
| POST | *(script)* `src/utils/importAllData.ts` | Excel toplu aktarım |

---

## Frontend Sayfa Haritası

| Sayfa | Dosya |
|-------|-------|
| Giriş | `frontend/src/pages/Login.tsx` |
| Ana Sayfa | `frontend/src/pages/Dashboard.tsx` |
| Hızlı Satış (F2) | `frontend/src/pages/SalesCreate.tsx` |
| Satış İade | `frontend/src/pages/SalesReturn.tsx` |
| Stok Kartı Oluştur | `frontend/src/pages/ProductCreate.tsx` |
| Fatura Listesi | `frontend/src/pages/Invoices.tsx` |
| Menü tanımları | `frontend/src/lib/navigation.ts` |

---

## Büyük Veri Performans Optimizasyonu

16.000+ ürün ve 180+ müşteri kaydıyla listelerin şişmesini önlemek için **sayfalı (paginated) API** ve **gelişmiş sayfalama paneli** uygulanmıştır.

### Backend

| Endpoint | Parametreler | Davranış |
|----------|--------------|----------|
| `GET /api/products` | `page` (1'den başlar), `limit` (varsayılan **50**), `search` | Sayfa başına en fazla 50 kayıt; arama filtresine uyan `totalCount` ile birlikte döner |
| `GET /api/customers` | `page`, `limit`, `search` | Aynı mantık; Türkçe normalize arama destekli |

**Yanıt formatı:**

```json
{
  "success": true,
  "data": [ /* kayıtlar */ ],
  "totalCount": 16737,
  "limit": 50,
  "page": 1,
  "message": "Products retrieved successfully."
}
```

- `totalCount` — Filtreye (arama kelimesine) uyan toplam kayıt (`prisma.count()` ile paralel hesaplanır)
- `limit` — Sayfa başına kayıt sayısı
- `page` — Aktif sayfa numarası (1 tabanlı)
- Geriye dönük uyumluluk: `take` / `skip` parametreleri hâlâ desteklenir

### Frontend — Gelişmiş Sayfalama Paneli

Ortak bileşen: `frontend/src/components/PaginationBar.tsx`

| Kontrol | İşlev |
|---------|--------|
| `<<` | İlk sayfaya zıpla (page = 1) |
| `<` | Önceki sayfa |
| Sayfa numaraları | Tıklanabilir; aktif sayfa indigo/mavi parlar; çok sayfada `…` ile kısaltma |
| `>` | Sonraki sayfa |
| `>>` | Son sayfaya zıpla (`Math.ceil(totalCount / limit)`) |

**Bilgi metni:** `Toplam X kayıttan Y–Z arası gösteriliyor (Sayfa A / B)`

| Ekran | Dosya |
|-------|-------|
| Stok Listesi | `StockList.tsx` |
| Müşteri Listesi | `CustomerList.tsx` |

**Sabitler:** `LIST_PAGE_SIZE = 50` · `buildVisiblePages()` · `getTotalPages()` → `frontend/src/lib/api.ts`

---

## Geçmiş

Önceki **Laravel + Vue** monolith kod tabanı tamamen temizlendi. Mevcut mimari sıfırdan **Node.js backend + React frontend** üzerine inşa edilmiştir ve **v1.0** fonksiyonel ERP seviyesine ulaşmıştır.

---

## Diğer Kılavuzlar

- **[REQUIREMENTS.md](./REQUIREMENTS.md)** — Sistem gereksinimleri, paketler, veritabanı şeması
- **[RUN_LOCAL_AND_PROD.md](./RUN_LOCAL_AND_PROD.md)** — Yerel ve production çalıştırma
- **[NEXT_STEPS.md](./NEXT_STEPS.md)** — Faz 2 yol haritası ve yapılacaklar
