# Sıradaki Adımlar ve Yapılacaklar

Bu belge, **Akgün Teknik ERP** geliştirme yol haritasını tanımlar. Faz numaraları operasyonel önceliğe göre güncellenmiştir.

---

## Mevcut Durum (v1.4 — Haziran 2026)

### Çekirdek ERP (tamamlandı)
- [x] Dashboard, kasa özeti, personel ciroları
- [x] F2 hızlı satış motoru (Türkçe / case-insensitive arama)
- [x] MERKEZ_DEPO / ARIZALI_DEPO depo ayrımı
- [x] costPrice + priceTl zorunlu stok kartı
- [x] Akıllı iade lojiği (arızalı / sağlam)
- [x] Excel / canlı SQL yedek ile veri (16.737 ürün, 181 müşteri)
- [x] Cari yönetimi, tahsilat, bakiye ve kâr raporu
- [x] Üst bar döviz çevirici
- [x] Admin giriş kapısı (akgunteknik / 123456)
- [x] Büyük veri sayfalama (Stok / Müşteri listeleri)

### Faz 1 — Menü sadeleştirme (tamamlandı)
- [x] 35 maddeden 17 canlı ekrana indirildi
- [x] Placeholder sayfalar kaldırıldı (`PageShell`, `Reports`, `WarehouseList`)
- [x] Tek **Fatura Listesi** (Tümü / Satış / Alış / İade filtresi)
- [x] Dashboard: 5 hızlı erişim kartı
- [x] Frontend `since1907/akgun-frontend:v1.4`

### Faz 2 — Alış faturası (tamamlandı)
- [x] `PurchaseCreate.tsx` — tedarikçiden mal girişi formu
- [x] `GET /api/purchases/init` ve `POST /api/purchases/store`
- [x] `AF{year}xxxx` numaralı `ALIS` faturası, MERKEZ_DEPO stok artışı
- [x] Nakit kasa düşümü / Cari tedarikçi borç kaydı
- [x] Backend `since1907/akgun-backend:v1.2`

### Faz 3 — Dokümantasyon (tamamlandı)
- [x] `README.md` — güncel modül listesi, menü yapısı, sürüm geçmişi
- [x] `NEXT_STEPS.md` — faz durumları yeniden numaralandı
- [x] `RUN_LOCAL_AND_PROD.md` — Docker Hub etiketleri, SQL yedek politikası
- [x] `akgun_canli_data.sql` — repoda kalır, sunucuda tutulmaz

---

## Faz 4 — İşlevsel İyileştirmeler (sıradaki)

### İade — Tam Test ve İyileştirme
- [ ] `SalesReturn.tsx` uçtan uca test senaryoları (arızalı / sağlam)
- [ ] İade sonrası stok doğrulama (MERKEZ_DEPO / ARIZALI_DEPO)
- [ ] İade fatura numarası (`IF2026xxxx`) listeleme entegrasyonu
- [ ] Müşteri cari bakiye düşümü doğrulama

### Stok ve Depo (gelecek modüller)
- [ ] Depo transfer ekranı (MERKEZ ↔ ARIZALI)
- [ ] Stok hareketleri geçmişi
- [ ] Kritik stok seviyesi uyarıları (Dashboard)

### Dashboard Canlı Grafikler
- [ ] Günlük / aylık ciro grafiği
- [ ] Kâr-zarar trend grafiği
- [ ] En çok satan 10 ürün widget'ı
- [ ] Personel ciroları karşılaştırma chart'ı

### Gelişmiş Raporlar
- [ ] Stok değeri raporu (adet × costPrice)
- [ ] Kasa giriş-çıkış raporu (dönemsel)
- [ ] Müşteri ekstre (cari hesap hareketleri)
- [ ] Excel / PDF export

---

## Faz 5 — DevOps ve Güvenlik

### Kubernetes / Sunucu
- [x] `backend/Dockerfile`, `frontend/Dockerfile`
- [x] `k8s/apps.yaml`, `k8s/mysql-deployment.yaml`
- [x] K3s rolling update (`since1907/*` imajları)
- [ ] Sunucudaki eski / gereksiz MySQL pod veya manifest temizliği
- [ ] `k8s/ingress.yaml` (LoadBalancer yerine Ingress)
- [ ] HTTPS / reverse proxy (Traefik veya nginx Ingress)

### Güvenlik Güçlendirme
- [ ] JWT tabanlı oturum (localStorage token doğrulama)
- [ ] Şifre hash (bcrypt) — veritabanı tabanlı kullanıcı
- [ ] Rate limiting (login endpoint)
- [ ] Production DATABASE_URL — Secret ile (gömülü değer yerine)

---

## Uzun Vadeli — Faz 6+ (İsteğe Bağlı)

- [ ] Barkod okuyucu entegrasyonu (USB HID → F2 arama)
- [ ] Çoklu şube / kasa yetkilendirme
- [ ] Teklif / proforma modülü
- [ ] SMS / WhatsApp fatura bildirimi
- [ ] Otomatik kur güncelleme (TCMB API)
- [ ] Zamanlanmış MySQL yedekleme (sunucuda dump üret, repoya commit etme — ayrı süreç)

---

## Öncelik Matrisi

| Öncelik | Görev | Tahmini Efor |
|---------|-------|--------------|
| 🔴 Yüksek | İade uçtan uca test | 0.5 gün |
| 🟡 Orta | Dashboard grafikleri | 2 gün |
| 🟡 Orta | Depo transfer + stok hareketleri | 2–3 gün |
| 🟢 Düşük | JWT auth güçlendirme | 1 gün |
| 🟢 Düşük | K8s Ingress + HTTPS | 1 gün |
| 🟢 Düşük | Sunucu manifest temizliği | 0.5 gün |

---

## Veri Yedek Politikası

| Dosya | Repoda | Sunucuda |
|-------|--------|----------|
| `akgun_canli_data.sql` | Evet (~2.7 MB, git) | Hayır |

- Canlı veri bir kez import edildikten sonra MySQL PVC üzerinde kalır.
- Yeni yedek almak: sunucudan `mysqldump` → geliştirici makinesine indir → repoya commit.
- Sunucuya `scp akgun_canli_data.sql` **yapılmaz**; import script geliştirici makinesinden `kubectl exec` pipe ile çalışır.

---

## Geliştirme Notları

- Her yeni modül: **backend endpoint** → **frontend sayfa** sırası
- Schema değişikliği: `npx prisma migrate dev` + `npx prisma generate` + backend restart
- Yeni sayfa: `frontend/src/lib/navigation.ts` içindeki `PageId` ve menü ağacını güncelle
- Docker imaj sürümü artır → push → `kubectl set image` ile canlıya al
- Git branch: `orhan` → `https://github.com/orhaneymur/akgunnew`

---

## Dokümantasyon

| Dosya | İçerik |
|-------|--------|
| [README.md](./README.md) | Proje özeti, modül listesi, API |
| [REQUIREMENTS.md](./REQUIREMENTS.md) | Paketler ve veritabanı şeması |
| [RUN_LOCAL_AND_PROD.md](./RUN_LOCAL_AND_PROD.md) | Yerel ve K3s dağıtım adımları |
