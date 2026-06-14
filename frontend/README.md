# Akgün Teknik ERP — Frontend

React 19 + Vite 8 + Tailwind CSS v4 ile yazılmış ERP arayüzü.

Proje özeti, modül listesi ve kurulum adımları için ana dizindeki **[README.md](../README.md)** dosyasına bakın.

## Hızlı başlangıç

```bash
npm install
npm run dev
```

Tarayıcı: `http://localhost:5173` · Giriş: `akgunteknik` / `123456`

## Önemli dosyalar

| Dosya | Açıklama |
|-------|----------|
| `src/App.tsx` | Ana layout, routing, F2 kısayolu |
| `src/lib/navigation.ts` | Sidebar menü tanımları (17 canlı ekran) |
| `src/lib/api.ts` | Axios istemci ve API yardımcıları |
| `src/pages/` | Ekran bileşenleri |

## Production build

```bash
npm run build
```

Docker imajı: `since1907/akgun-frontend:v1.4` (Nginx ile statik serve)
