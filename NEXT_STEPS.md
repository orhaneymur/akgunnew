# Sıradaki Adımlar ve Yapılacaklar

Bu belge, **Akgün Teknik ERP v1.0** tamamlandıktan sonraki geliştirme yol haritasını tanımlar. Her faz, dükkanın operasyonel ihtiyaçlarına göre önceliklendirilmiştir.

---

## Mevcut Durum (v1.0 — Tamamlandı)

- [x] Dashboard, kasa özeti, personel ciroları
- [x] F2 hızlı satış motoru (Türkçe / case-insensitive arama)
- [x] MERKEZ_DEPO / ARIZALI_DEPO depo ayrımı
- [x] costPrice + priceTl zorunlu stok kartı
- [x] Akıllı iade lojiği (arızalı / sağlam)
- [x] Excel toplu aktarım (16.737 ürün, 181 müşteri)
- [x] Cari yönetimi, tahsilat, bakiye ve kâr raporu
- [x] Üst bar döviz çevirici
- [x] Admin giriş kapısı (akgunteknik / 123456)
- [x] 6 hızlı erişim kartı (Dashboard)
- [x] Büyük veri performans optimizasyonu (sayfalı API + Stok/Müşteri listeleri)

---

## Performans Optimizasyonu (Tamamlandı)

- [x] `GET /api/products` — `take` / `skip` sayfalama (varsayılan 50 kayıt)
- [x] `GET /api/customers` — `take` / `skip` sayfalama (varsayılan 50 kayıt)
- [x] Arama sorgularında limitli sonuç (ilk 50 eşleşme)
- [x] `StockList.tsx` — sayfa navigasyonu + debounce arama
- [x] `CustomerList.tsx` — sayfa navigasyonu + debounce arama
- [x] API yanıtına `totalCount`, `limit`, `page` eklendi (yeni JSON formatı)
- [x] `PaginationBar.tsx` — <<, <, sayfa numaraları, >, >> kontrol paneli
- [x] Stok / Müşteri listelerinde gelişmiş sayfalama arayüzü

---

## Öncelikli Aşama — Faz 2 (İşlevsel Tamamlama)

### Alış Yap (Mal Kabul) Ekranı
- [ ] Tedarikçiden mal girişi formu (`invoice-purchase` sayfası şu an şablon)
- [ ] `POST /api/purchases/store` endpoint'i
- [ ] Alış faturası oluşturma → MERKEZ_DEPO stok artışı
- [ ] Tedarikçi cari borç kaydı
- [ ] Dashboard hızlı menüdeki **Alış Yap** kartını canlı ekrana bağlama

### İade Al — Tam Test ve İyileştirme
- [ ] `SalesReturn.tsx` uçtan uca test senaryoları (arızalı / sağlam)
- [ ] İade sonrası stok doğrulama (MERKEZ_DEPO / ARIZALI_DEPO)
- [ ] İade fatura numarası (`IF2026xxxx`) listeleme entegrasyonu
- [ ] Müşteri cari bakiye düşümü doğrulama

### Stok ve Depo
- [ ] Depo transfer ekranını canlı API'ye bağlama
- [ ] Stok hareketleri geçmişi (`stock-movements`)
- [ ] Kritik stok seviyesi uyarıları (Dashboard pill)

---

## Analiz Aşaması — Faz 3 (Raporlama ve Grafikler)

### Dashboard Canlı Grafikler
- [ ] Gerçek veriler üzerinden **günlük / aylık ciro** grafiği
- [ ] **Kâr-zarar** trend grafiği (`costPrice` vs satış fiyatı)
- [ ] En çok satan 10 ürün widget'ı
- [ ] Personel ciroları karşılaştırma chart'ı

### Gelişmiş Raporlar
- [ ] Stok değeri raporu (adet × costPrice)
- [ ] Kasa giriş-çıkış raporu (dönemsel)
- [ ] Müşteri ekstre (cari hesap hareketleri)
- [ ] Excel / PDF export

---

## Canlıya Geçiş Aşaması — Faz 4 (DevOps)

### Docker ve Container
- [ ] `backend/Dockerfile` — multi-stage, Alpine tabanlı
- [ ] `frontend/Dockerfile` — nginx ile statik serve
- [ ] `docker-compose.yml` — yerel production simülasyonu (backend + frontend + mysql)

### Kubernetes Kümesi
- [ ] `k8s/deployment-backend.yaml`
- [ ] `k8s/deployment-frontend.yaml`
- [ ] `k8s/service.yaml` + `ingress.yaml`
- [ ] ConfigMap / Secret (DATABASE_URL, auth)
- [ ] Kiralık Linux sunucusundaki K8s kümesine deploy
- [ ] RAM tüketim hedefi: **15–20 MB / pod**

### Güvenlik Güçlendirme
- [ ] JWT tabanlı oturum (localStorage token doğrulama)
- [ ] Şifre hash (bcrypt) — veritabanı tabanlı kullanıcı
- [ ] HTTPS zorunluluğu (production)
- [ ] Rate limiting (login endpoint)

---

## Uzun Vadeli — Faz 5+ (İsteğe Bağlı)

- [ ] Barkod okuyucu entegrasyonu (USB HID → F2 arama)
- [ ] Çoklu şube / kasa yetkilendirme
- [ ] Teklif / proforma modülü
- [ ] SMS / WhatsApp fatura bildirimi
- [ ] Mobil uyumlu satış ekranı (tablet)
- [ ] Otomatik kur güncelleme (TCMB API)
- [ ] Yedekleme ve geri yükleme scripti

---

## Öncelik Matrisi

| Öncelik | Görev | Tahmini Efor |
|---------|-------|--------------|
| 🔴 Yüksek | Alış Yap ekranı + API | 2–3 gün |
| 🔴 Yüksek | İade uçtan uca test | 0.5 gün |
| 🟡 Orta | Dashboard grafikleri | 2 gün |
| 🟡 Orta | Dockerfile + docker-compose | 1 gün |
| 🟢 Düşük | K8s manifestleri | 1–2 gün |
| 🟢 Düşük | JWT auth güçlendirme | 1 gün |

---

## Geliştirme Notları

- Her yeni modül önce **backend endpoint** → sonra **frontend sayfa** sırasıyla geliştirilmeli
- Schema değişikliği sonrası: `npx prisma migrate dev` + `npx prisma generate` + backend restart
- Yeni sayfa eklerken `frontend/src/lib/navigation.ts` içindeki `PageId` ve menü ağacını güncelle
- Canlı veri testleri için `importAllData.ts` scripti tekrar çalıştırılabilir (upsert mantığı)

---

## İletişim ve Dokümantasyon

Yeni geliştirme başlamadan önce şu dosyaları oku:

1. **[README.md](./README.md)** — Proje özeti ve modül listesi
2. **[REQUIREMENTS.md](./REQUIREMENTS.md)** — Paketler ve veritabanı şeması
3. **[RUN_LOCAL_AND_PROD.md](./RUN_LOCAL_AND_PROD.md)** — Çalıştırma adımları
