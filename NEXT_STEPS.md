# Sıradaki Adımlar ve Yapılacaklar

**Son güncelleme:** v1.5.1 — deploy scripti ve güvenli backend startup

---

## Canlıya Alma (sunucuda — önerilen)

Sunucuda **docker build gerekmez**. Docker Hub'dan çeker:

```bash
cd ~/akgunnew
git pull origin orhan
bash k8s/deploy-production.sh
```

Script sırasıyla: git pull → schema kontrol → kubectl apply → imaj güncelle → rollout izle

Manuel alternatif:

```bash
kubectl set image deployment/akgunteknik-backend backend=since1907/akgun-backend:v1.5.1
kubectl set image deployment/akgunteknik-frontend frontend=since1907/akgun-frontend:v1.5.1
kubectl rollout status deployment/akgunteknik-backend --timeout=300s
kubectl rollout status deployment/akgunteknik-frontend --timeout=300s
```

### Sunucuda build (isteğe bağlı)

Önce mutlaka `git pull origin orhan`. Paket sayısı ~186 olmalı (`npm ci` çıktısı).

```bash
grep "model ProductStock" backend/prisma/schema.prisma   # satır görünmeli
docker build -t since1907/akgun-backend:v1.5.1 ./backend
docker push since1907/akgun-backend:v1.5.1
```

Build hatası `productstock` vs `productStock` → repo eski, `git pull` yapın.

### git pull çakışması (sunucu)

Yerel dosya değişmişse pull durur. Sunucuda repodaki sürüm esas alınır:

```bash
cd ~/akgunnew
git checkout -- k8s/import-database.sh   # sadece bu dosya ise
git pull origin orhan
bash k8s/deploy-production.sh
```

Veya pull beklemeden doğrudan imaj güncelle:

```bash
kubectl set image deployment/akgunteknik-backend backend=since1907/akgun-backend:v1.5.1
kubectl set image deployment/akgunteknik-frontend frontend=since1907/akgun-frontend:v1.5.1
kubectl rollout status deployment/akgunteknik-backend --timeout=300s
kubectl rollout status deployment/akgunteknik-frontend --timeout=300s
```

---

## Mevcut Durum (v1.5.1)

- [x] Faz 1–5 tamamlandı (menü, alış, raporlar, grafikler, JWT, K8s)
- [x] `k8s/deploy-production.sh` — tek komut deploy
- [x] Backend pod: `db push` kaldırıldı (canlı veri güvenliği)
- [x] Frontend: axios JWT interceptor

---

## Faz 6 — İsteğe Bağlı

- [ ] Tüm API route'larına JWT zorunluluğu
- [ ] Personel şifrelerini bcrypt migrate
- [ ] cert-manager HTTPS
- [ ] Barkod okuyucu, teklif modülü, TCMB kur

---

## Menü (23 ekran)

Satış · Alış · Stok (5) · Müşteri · Raporlar (4) · Tanımlar · Faturalar

---

## Dokümantasyon

- [README.md](./README.md)
- [RUN_LOCAL_AND_PROD.md](./RUN_LOCAL_AND_PROD.md)
