# Akgün Teknik ERP v1.5

## Proje Özeti

**Akgün Teknik ERP**, eski Laravel monolith yapısından arındırılmış; **Fastify**, **Prisma**, **MySQL** ve **React (Vite + Tailwind v4)** mimarisiyle yazılmış, sunucu dostu hafif ve klavye odaklı akıllı ön muhasebe / ERP sistemidir.

Dükkanın günlük operasyonları — satış, alış, stok, cari, kasa, iade ve raporlama — tek bir monorepo içinde birleştirilmiştir. Canlı veritabanı yedeği (`akgun_canli_data.sql`) repoda tutulur; **16.000+ ürün** ve **180+ müşteri** kaydı ile gerçek veri üzerinde çalışır.

**Canlı ortam:** K3s kümesi · Docker Hub `since1907/akgun-backend:v1.8.1` · `since1907/akgun-frontend:v1.8.2`  
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

## Menü Yapısı (v1.7 — 24 canlı ekran)

Placeholder sayfalar kaldırıldı; sidebar yalnızca çalışan modülleri listeler. **Alt menü öğeleri yeni tarayıcı sekmesinde açılır** — aynı anda satış, alış ve iade yapabilirsiniz.

| Grup | Ekranlar |
|------|----------|
| **Ana Sayfa** | Dashboard (5 hızlı erişim kartı) |
| **Satış İşlemleri** | Satış Yap (F2), Satış İade, **Ön Siparişler** |
| **Alış İşlemleri** | Alış Faturası |
| **Stok İşlemleri** | Stok Listesi, Depo Transfer, **Stok Hareketleri (ürün arama)**, Stok Kartı, Barkod Etiket |
| **Müşteri İşlemleri** | Müşteri Listesi, Tahsilat / Ödeme, Müşteri Bakiye |
| **Raporlar** | İşletme Özeti, Kâr-Zarar, Stok Değeri, Kasa Raporu, Müşteri Ekstre |
| **Tanımlar** | Ürün Tanımları, Kasa Tanımları, Personel Tanımları |
| **Faturalar** | Fatura Listesi (filtre: Tümü / Satış / Alış / İade) |

Menü tanımları: `frontend/src/lib/navigation.ts` · URL: `?page=sales`, `?page=pre-orders` vb.

---

## Tamamlanan Modüller

### Dashboard
- Günlük **kasa durumları** (TL / USD kasalar)
- **Personel ciroları** (günlük, aylık, yıllık)
- Renkli **fatura akışı** ve son **kasa hareketleri**
- **5 hızlı erişim kartı:** Satış Yap, Alış Faturası, İade Al, Stok Kartı Oluştur, Fatura Listesi

### Hızlı Satış (F2) — v1.7+
- **F2** yalnızca Satış / Alış / İade ekranındayken açılır (sayfa değiştirmez)
- Panel açılınca arama kutusuna **otomatik odaklanır**; klavyeyle doğrudan yazılabilir
- Açılınca **tüm ürünler** listelenir (sayfalı, kaydırınca devamı yüklenir)
- **↑ / ↓** ve **PgUp / PgDn** ile klavyede gezinme; seçili satır otomatik kayar
- **Enter** sepete ekler, **Esc** kapatır
- Müşteri/tedarikçi seçiliyse **son işlem fiyatı** geçerli olur; listede güncel satış fiyatı + “Son fiyat” satırı görünür
- Türkçe karaktere duyarsız arama

### Alış Faturası (Mal Kabul)
- Tedarikçiden mal girişi formu (`PurchaseCreate.tsx`) — **fiyatlar USD ($)** bazlı
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

#### Çift Para Birimi Matematik Motoru (v1.8.1 — varsayılan USD)

- **Satış, alış ve iade** ekranlarında fiyat girişi ve toplamlar **USD ($)** bazlıdır; TL yalnızca küçük referans satırı olarak gösterilir
- Kayıt anında API'ye TL gönderilir (`$ × kur`); veritabanı muhasebesi TL üzerinden devam eder
- Sepet satırları: `Fiyat ($)` düzenlenebilir; **maliyet sütunu varsayılan olarak gizlidir**
- **F8 basılı tutulduğunda** maliyet ($) sütunu görünür; tuş bırakılınca veya pencere odaktan çıkınca tekrar gizlenir (yalnızca `keydown`/`keyup` dinleyicisi, ek API yükü yok)
- Satır indirimi: `Toplam = (Adet × Fiyat) × (1 − Ind.% / 100)`
- **Net Toplam ($)** kırmızı büyük puntoda; **TL Toplam** = `Net Toplam ($) × Döviz Kuru`
- Üst bardaki kur satış panelinde düzenlenebilir input olarak kullanılır
- Müşteri değişince **Son Satın Aldığı Fiyat** otomatik USD'ye çevrilerek satıra yazılır

#### POST `/api/sales/store` Davranışı

- Tüm üst bilgiler (vade, ödeme, personel, açıklama, ön sipariş) kaydedilir
- **`isPreOrder: true`** → fatura oluşur, **MERKEZ_DEPO stok düşümü yapılmaz**
- Normal satışta stok yetersiz olsa bile satışa izin verilir; **MERKEZ_DEPO bakiyesi eksi değere düşebilir**
- Ön siparişleri görüntüleme: menü **Satış İşlemleri → Ön Siparişler** veya `?page=pre-orders`
- Fatura listesinde **Ön Sipariş** etiketi ile işaretlenir
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
- **Fatura Ara** paneli — müşteri adı/kodu ve ürün (stok kodu, barkod, ad) ile sunucu tarafı arama (v1.7.4)
- Ürün araması geçmiş faturaların kalemlerinde arar; müşteri araması o cariye ait tüm faturaları listeler
- Dashboard kısayolları filtreli listeye yönlendirir
- **Excel İndir / Excel Yükle** ile toplu fatura üst bilgisi güncelleme (v1.7)

### Excel Toplu Aktarım (v1.7.0)

Müşteri carileri, stoklar ve faturalar için **indir → Excel'de düzenle → yükle** akışı eklendi. Bileşen: `frontend/src/components/ExcelActions.tsx` · Backend: `backend/src/utils/excelExchange.ts`

| Ekran | İndir | Yükle | Excel sütunları |
|-------|-------|-------|-----------------|
| **Müşteri Listesi** | Tüm cariler | Yeni ekle / mevcut güncelle | `CariKodu`, `CariAdi`, `YetkiliAdi`, `Adres`, `Ilce`, `Il`, `Email`, `Gsm`, `VergiDairesi`, `VergiTcNo`, `KrediLimiti`, `Bakiye`* |
| **Stok Listesi** | Tüm ürünler + depo miktarları | Yeni ekle / mevcut güncelle | `StokKodu`, `StokAdi`, `Kategori`*, `Barkod`, `AlisFiyati`, `SatisFiyati`, `SatisUsd`, `MerkezDepo` / `Bakiye`, `CinIadeDepo` |
| **Fatura Listesi** | Faturalar + Kalemler (2 sayfa) | Yalnızca mevcut faturaların üst bilgisi | `FaturaNo`, `Odeme`, `Personel`, `Aciklama`, `Teslimat` |

\* **Bakiye** sütunu dışa aktarımda bilgi amaçlıdır; içe aktarmada **değiştirilmez** (cari bakiye fatura/tahsilat ile hesaplanır).

\* **Kategori** sütunu içe aktarmada yoksa oluşturulur ve ürüne bağlanır (`TAMİR GEREÇLERİ` gibi).

**Stok Excel formatı:** Harici sistemden gelen dosyalarda `Id`, `Marka`, `Model`, `AlisAdedi`, `SatisAdedi` gibi ek sütunlar olabilir; bunlar yok sayılır. Stok miktarı için `MerkezDepo` veya `Bakiye` kullanılır.

**API uçları:**

| Method | Adres |
|--------|-------|
| GET | `/api/customers/export/excel` |
| POST | `/api/customers/import/excel` (multipart `file`) |
| GET | `/api/products/export/excel` |
| POST | `/api/products/import/excel` |
| GET | `/api/sales/invoices/export/excel?type=` |
| POST | `/api/sales/invoices/import/excel` |

**Kullanım:** İlgili listede sağ üstte **Excel İndir** → dosyayı düzenle → **Excel Yükle**. Sonuç mesajında kaç kayıt eklendi/güncellendi gösterilir; hatalı satırlar özetlenir.

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
| GET | `/api/customers/export/excel` | Tüm carileri Excel indir |
| POST | `/api/customers/import/excel` | Excel'den cari toplu güncelle |
| GET | `/api/products/export/excel` | Tüm stokları Excel indir |
| POST | `/api/products/import/excel` | Excel'den stok toplu güncelle |
| GET | `/api/sales/invoices/export/excel` | Faturaları Excel indir |
| POST | `/api/sales/invoices/import/excel` | Fatura üst bilgisi toplu güncelle |
| GET | `/api/reports/profit` | Kâr-zarar raporu |
| POST | *(script)* `src/utils/importAllData.ts` | İlk kurulum Excel aktarımı (offline) |

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
| Tahsilat / Ödeme | `frontend/src/pages/CustomerPayment.tsx` — kod/isim arama + **F2** hızlı müşteri paneli |
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
| v1.5 | Dashboard grafikleri, depo transfer, raporlar, JWT auth, K8s ingress |
| v1.6 | Düzenlenebilir cari/stok/fatura, fatura bazlı iade, F2 kompakt arama |
| v1.7 | Excel indir/yükle — müşteri, stok, fatura toplu güncelleme |
| v1.7.1 | F2 klavye gezinme, ön sipariş listesi, stok hareketi ürün arama, menü yeni sekme, F2 sayfa bağlamı |
| v1.7.2 | F2 arama kutusu yazma/odak düzeltmesi, Esc ve ✕ ile kapanma, fatura listesi arama |
| v1.7.3 | Stok Excel içe aktarımda Kategori otomatik oluşturma, Bakiye sütunu desteği |
| v1.7.4 | Fatura müşteri/ürün arama, Excel 504 timeout düzeltmesi, toplu stok import hızlandırma |
| v1.7.5 | Satış fiyatı TL bazlı kayıt, fatura tarihi/saat düzeltmesi, müşteri seçim doğrulama |
| v1.7.7 | Stok yetersiz olsa bile satışa izin; MERKEZ_DEPO eksi bakiyeye düşebilir |
| v1.7.8 | `/api/version` endpoint, deploy script rollout restart ve sürüm doğrulama |
| v1.7.9 | Tahsilat/Ödeme ekranında müşteri arama ve F2 hızlı müşteri bulma |
| v1.8.0 | Stok hareketi detayları, fatura kalem düzenleme, stok miktarı düzenleme, ön sipariş tamamlama |
| v1.8.1 | Varsayılan işlem para birimi USD; satışta F8 ile maliyet göster/gizle; alış ve iade ekranlarında $ fiyatlandırma |
| v1.8.2 | Sayı alanlarında (adet, fiyat, indirim) tarayıcı yukarı/aşağı okları kaldırıldı |

---

## Diğer Kılavuzlar

- **[REQUIREMENTS.md](./REQUIREMENTS.md)** — Sistem gereksinimleri, paketler, veritabanı şeması
- **[RUN_LOCAL_AND_PROD.md](./RUN_LOCAL_AND_PROD.md)** — Yerel ve production çalıştırma
- **[NEXT_STEPS.md](./NEXT_STEPS.md)** — Sıradaki fazlar ve yapılacaklar
