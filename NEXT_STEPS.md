# Sıradaki Adımlar ve Yapılacaklar

**Son güncelleme:** v1.5 — Faz 4 ve Faz 5 tamamlandı.

---

## Mevcut Durum (v1.5)

### Çekirdek ERP
- [x] Dashboard, kasa özeti, personel ciroları, **canlı grafikler**, **kritik stok uyarısı**
- [x] F2 hızlı satış, alış faturası, satış iade (IF2026xxxx)
- [x] Depo transfer (MERKEZ ↔ ARIZALI), stok hareketleri listesi
- [x] Raporlar: kâr-zarar, stok değeri, kasa giriş-çıkış, müşteri ekstre (+ CSV)
- [x] JWT oturum, login rate limit, bcrypt hazır altyapı
- [x] K8s: ingress şablonu, secrets örneği, legacy temizlik scripti

### Faz 1–3 (tamamlandı)
Menü sadeleştirme · Alış faturası · Dokümantasyon

### Faz 4 — İşlevsel İyileştirmeler (tamamlandı)
- [x] İade: IF numarası, MERKEZ/ARIZALI depo, cari düşüm (mevcut API doğrulandı)
- [x] Depo transfer ekranı (`StockTransfer.tsx`)
- [x] Stok hareketleri (`StockMovements.tsx` + `/api/reports/stock-history`)
- [x] Kritik stok uyarıları (Dashboard, ≤5 adet)
- [x] Dashboard grafikleri (7 gün ciro, 6 ay aylık, top 10 ürün, personel)
- [x] Stok değeri, kasa raporu, müşteri ekstre + CSV export

### Faz 5 — DevOps ve Güvenlik (tamamlandı)
- [x] `k8s/ingress.yaml` — nginx Ingress şablonu
- [x] `k8s/secrets.example.yaml` — DATABASE_URL + JWT_SECRET
- [x] `k8s/cleanup-legacy.sh` — sunucu temizlik rehberi
- [x] JWT login (`@fastify/jwt`), rate limit (`@fastify/rate-limit`)
- [x] `GET /api/auth/me` — token doğrulama
- [x] Docker imajları: `since1907/akgun-backend:v1.5`, `since1907/akgun-frontend:v1.5`

---

## Faz 6 — İsteğe Bağlı (gelecek)

- [ ] Tüm API route'larına JWT zorunluluğu (breaking change)
- [ ] Personel şifrelerini bcrypt hash'e migrate (seed + admin panel)
- [ ] cert-manager ile otomatik HTTPS
- [ ] Barkod okuyucu (USB HID → F2)
- [ ] Teklif / proforma modülü
- [ ] TCMB otomatik kur

---

## Canlıya Alma (v1.5)

```bash
docker build -t since1907/akgun-backend:v1.5 ./backend
docker build -t since1907/akgun-frontend:v1.5 ./frontend
docker push since1907/akgun-backend:v1.5
docker push since1907/akgun-frontend:v1.5

kubectl set image deployment/akgunteknik-backend backend=since1907/akgun-backend:v1.5
kubectl set image deployment/akgunteknik-frontend frontend=since1907/akgun-frontend:v1.5
kubectl rollout status deployment/akgunteknik-backend --timeout=180s
kubectl rollout status deployment/akgunteknik-frontend --timeout=180s
```

---

## Menü (v1.5 — 23 ekran)

| Grup | Ekranlar |
|------|----------|
| Satış | Satış Yap, Satış İade |
| Alış | Alış Faturası |
| Stok | Liste, Depo Transfer, Hareketler, Stok Kartı, Barkod |
| Müşteri | Liste, Tahsilat, Bakiye |
| Raporlar | Kâr-Zarar, Stok Değeri, Kasa, Ekstre |
| Tanımlar | Ürün, Kasa, Personel |
| Faturalar | Fatura Listesi (filtreli) |

---

## Dokümantasyon

- [README.md](./README.md)
- [RUN_LOCAL_AND_PROD.md](./RUN_LOCAL_AND_PROD.md)
- [REQUIREMENTS.md](./REQUIREMENTS.md)
