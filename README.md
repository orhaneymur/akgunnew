# Akgün Teknik ERP v1.4

## Proje Özeti

**Akgün Teknik ERP**, eski Laravel monolith yapısından arındırılmış; **Fastify**, **Prisma**, **MySQL** ve **React (Vite + Tailwind v4)** mimarisiyle yazılmış, sunucu dostu hafif ve klavye odaklı akıllı ön muhasebe / ERP sistemidir.

Dükkanın günlük operasyonları — satış, alış, stok, cari, kasa, iade ve raporlama — tek bir monorepo içinde birleştirilmiştir. Canlı veritabanı yedeği (`akgun_canli_data.sql`) repoda tutulur; **16.000+ ürün** ve **180+ müşteri** kaydı ile gerçek veri üzerinde çalışır.

**Canlı ortam:** K3s kümesi · Docker Hub `since1907/akgun-backend:v1.2` · `since1907/akgun-frontend:v1.4`  
**Giriş:** `akgunteknik` / `123456`

---

## Monorepo Yapısı

```
akgunteknik/
├── backend/              # Fastify 5 + Prisma 7 + TypeScript API (Port: 3000)
├── frontend/             # React 19 + Vite 8 + Tailwind v4 (Port: 5173)
├── k8s/                  # Kubernetes manifestleri (backend, frontend, mysql)
├── akgun_canli_data.sql  # Canlı DB yedeği (~2.7 MB) — yalnızca repoda
├── README.md             # Bu dosya — proje özeti
├── REQUIREMENTS.md       # Gereksinimler ve altyapı detayları
├── RUN_LOCAL_AND_PROD.md # Yerel ve canlı çalıştırma kılavuzu
└── NEXT_STEPS.md         # Sıradaki adımlar ve yol haritası
```

---

## Menü Yapısı (v1.4 — 17 canlı ekran)

Placeholder sayfalar kaldırıldı; sidebar yalnızca çalışan modülleri listeler.

| Grup | Ekranlar |
|------|----------|
| **Ana Sayfa** | Dashboard (5 hızlı erişim kartı) |
| **Satış İşlemleri** | Satış Yap (F2), Satış İade |
| **Alış İşlemleri** | Alış Faturası |
| **Stok İşlemleri** | Stok Listesi, Stok Kartı Oluştur, Barkod Etiket |
| **Müşteri İşlemleri** | Müşteri Listesi, Tahsilat / Ödeme, Müşteri Bakiye |
| **Raporlar** | Kâr-Zarar Raporu |
| **Tanımlar** | Ürün Tanımları, Kasa Tanımları, Personel Tanımları |
| **Faturalar** | Fatura Listesi (filtre: Tümü / Satış / Alış / İade) |

Menü tanımları: `frontend/src/lib/navigation.ts`

---

## Tamamlanan Modüller

### Dashboard
- Günlük **kasa durumları** (TL / USD kasalar)
- **Personel ciroları** (günlük, aylık, yıllık)
- Renkli **fatura akışı** ve son **kasa hareketleri**
- **5 hızlı erişim kartı:** Satış Yap, Alış Faturası, İade Al, Stok Kartı Oluştur, Fatura Listesi

### Hızlı Satış (F2)
- **F2** tuşu ile her yerden satış ekranına geçiş ve arama modalı
- Büyük/küçük harfe ve **Türkçe karaktere duyarsız** ürün arama motoru
- **↑ / ↓** ile sonuçlarda gezinme, **Enter** ile sepete ekleme, **Esc** ile kapatma
- Müşterinin **Son Satın Alma Fiyatını** otomatik getirme ve sepet satırında **Maliyet | Liste** kılavuzu
- Nakit / Cari ödeme, şube ve kasa seçimi

### Alış Faturası (Mal Kabul)
- Tedarikçiden mal girişi formu (`PurchaseCreate.tsx`)
- `GET /api/purchases/init` — tedarikçiler, kasalar, bir sonraki fatura no
- `POST /api/purchases/store` — `AF{year}xxxx` numaralı `ALIS` faturası
- **MERKEZ_DEPO** stok artışı ve ürün `costPrice` güncellemesi
- Nakit → kasa düşümü + CIKIS hareketi; Cari → tedarikçi bakiye düşümü

### Satış Yönetimi ve Dövizli Muhasebe

Hızlı Satış ekranı (`SalesCreate.tsx`) esnaf fatura düzenine göre **4 üst blok + akıllı sepet + fintech özet paneli** ile tasarlanmıştır.

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
- Üst bardaki kur satış panelinde düzenlenebilir input olarak kullanılır
- Müşteri değişince **Son Satın Aldığı Fiyat** otomatik USD'ye çevrilerek satıra yazılır

#### POST `/api/sales/store` Davranışı

- Tüm üst bilgiler (vade, ödeme, personel, açıklama, ön sipariş) kaydedilir
- **`isPreOrder: true`** → fatura oluşur, **MERKEZ_DEPO stok düşümü yapılmaz**
- Nakit / EFT / Kart → kasa bakiyesi ve tahsilat hareketi TL tutarıyla artar
- Cari → müşteri bakiyesi TL tutarıyla artar

### Stok Yönetimi
- **`MERKEZ_DEPO`** — Satış stoğu (satış düşümü, alış girişi, sağlam iade girişi)
- **`ARIZALI_DEPO`** — Arızalı ürün izolasyon deposu
- Ürün kartlarında **`costPrice` (Alış Maliyeti)** ve **`priceTl` (Satış Fiyatı)** zorunlu takibi
- Stok listesi, barkod etiket ve stok kartı oluşturma ekranları

### Akıllı İade Lojiği
- **`isDefective: true`** → iade stoğu **ARIZALI_DEPO**'ya eklenir
- **`isDefective: false`** → iade stoğu **MERKEZ_DEPO** satış stoğuna geri yüklenir
- Müşteri carisinden iade tutarı düşülür, `IADE` tipi fatura oluşturulur

### Müşteri / Cari Yönetimi
- Excel / canlı yedekten aktarılmış **181 müşteri** ve **16.737 ürün**
- Anlık **borç / alacak** takibi, tahsilat / ödeme kayıtları
- Müşteri bakiye raporu ve **costPrice** bazlı **kâr-zarar analizi**

### Fatura Listesi
- Tek ekranda **Tümü / Satış / Alış / İade** filtresi
- Dashboard kısayolları filtreli listeye yönlendirir

### Mobil Arayüz (v1.3+)
- Hamburger menü, kompakt üst bar, mobil uyumlu padding
- Bildirimler mobilde alt bantta

### Güvenlik Kapısı
- **`akgunteknik` / `123456`** ile korunan admin giriş paneli
- `localStorage` tabanlı oturum kontrolü ve **Router koruması**
- Sol menü altında **Güvenli Çıkış** butonu

---

## Canlı Veri Yedeği (`akgun_canli_data.sql`)

| Konum | Durum |
|-------|-------|
| **Git reposu** | Evet — sürüm kontrolünde (~2.7 MB) |
| **Sunucu dosya sistemi** | Hayır — sunucuya kopyalanmaz |

**Politika:** Veri bir kez çekildikten sonra yedek dosyası yalnızca repoda kalır. Sunucudaki MySQL verisi PVC üzerinde yaşar; SQL dump sunucuda tutulmaz.

**Yerel geliştirme** — Laragon MySQL'e import:

```bash
mysql -u root akgunteknik < akgun_canli_data.sql
```

**K3s kümesine import** — geliştirici makinesinden (kubectl erişimi gerekir):

```bash
bash k8s/import-database.sh
```

Script, repodaki dosyayı `kubectl exec` ile pod'a pipe eder; sunucuya `scp` gerekmez.

---

## Teknoloji Özeti

| Katman | Teknoloji |
|--------|-----------|
| Backend API | Fastify 5, TypeScript, Prisma 7 |
| Veritabanı | MySQL 8.0 (K3s pod veya Laragon) |
| Frontend | React 19, Vite 8, Tailwind CSS v4 |
| HTTP İstemci | Axios |
| İkonlar | Lucide React |
| Container | Docker Hub · K3s rolling update |
| Excel Aktarım | xlsx |

---

## Hızlı Başlangıç

Detaylı kurulum → **[RUN_LOCAL_AND_PROD.md](./RUN_LOCAL_AND_PROD.md)**

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
| GET | `/api/sales/invoices` | Fatura listesi (tip filtresi) |
| GET | `/api/purchases/init` | Alış ekranı başlangıç verisi |
| POST | `/api/purchases/store` | Alış faturası kaydı |
| POST | `/api/products` | Stok kartı oluştur |
| GET | `/api/products?search=&page=&limit=` | Sayfalı stok listesi |
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
| Alış Faturası | `frontend/src/pages/PurchaseCreate.tsx` |
| Stok Listesi | `frontend/src/pages/StockList.tsx` |
| Stok Kartı | `frontend/src/pages/ProductCreate.tsx` |
| Barkod Etiket | `frontend/src/pages/BarcodePrint.tsx` |
| Müşteri Listesi | `frontend/src/pages/CustomerList.tsx` |
| Tahsilat / Ödeme | `frontend/src/pages/CustomerPayment.tsx` |
| Müşteri Bakiye | `frontend/src/pages/CustomerBalances.tsx` |
| Kâr-Zarar Raporu | `frontend/src/pages/ProfitReport.tsx` |
| Fatura Listesi | `frontend/src/pages/Invoices.tsx` |
| Tanımlar | `CategoryManager`, `SafeManager`, `PersonnelManager` |
| Menü tanımları | `frontend/src/lib/navigation.ts` |

---

## Büyük Veri Performans Optimizasyonu

16.000+ ürün ve 180+ müşteri kaydıyla listelerin şişmesini önlemek için **sayfalı (paginated) API** ve **gelişmiş sayfalama paneli** uygulanmıştır.

- `GET /api/products` ve `GET /api/customers` — varsayılan **50** kayıt/sayfa, `totalCount` ile
- Ortak bileşen: `frontend/src/components/PaginationBar.tsx`
- Kullanan ekranlar: `StockList.tsx`, `CustomerList.tsx`

---

## Canlı Dağıtım (Özet)

```bash
# İmaj güncelleme (örnek)
kubectl set image deployment/akgunteknik-frontend frontend=since1907/akgun-frontend:v1.4
kubectl set image deployment/akgunteknik-backend backend=since1907/akgun-backend:v1.2
kubectl rollout status deployment/akgunteknik-frontend --timeout=180s
```

Manifestler: `k8s/apps.yaml`, `k8s/mysql-deployment.yaml` — `kubectl apply -f k8s/`

---

## Geçmiş

Önceki **Laravel + Vue** monolith kod tabanı tamamen temizlendi. Mevcut mimari sıfırdan **Node.js backend + React frontend** üzerine inşa edilmiştir.

| Sürüm | Öne çıkanlar |
|-------|----------------|
| v1.0 | Satış, stok, cari, iade, dashboard |
| v1.1 | Prisma PascalCase düzeltmesi, white-screen fix |
| v1.2 | Alış faturası API + ekranı |
| v1.3 | Mobil UI (hamburger menü) |
| v1.4 | Menü sadeleştirme, tek filtreli fatura listesi |

---

## Diğer Kılavuzlar

- **[REQUIREMENTS.md](./REQUIREMENTS.md)** — Sistem gereksinimleri, paketler, veritabanı şeması
- **[RUN_LOCAL_AND_PROD.md](./RUN_LOCAL_AND_PROD.md)** — Yerel ve production çalıştırma
- **[NEXT_STEPS.md](./NEXT_STEPS.md)** — Sıradaki fazlar ve yapılacaklar
