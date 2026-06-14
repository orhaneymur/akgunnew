#!/bin/bash
# Sunucudaki eski / çift MySQL deployment'larını temizler.
# DIKKAT: Calistirmadan once kubectl get pods -A ile kontrol edin.
set -euo pipefail

echo "==> Mevcut MySQL pod'lari:"
kubectl get pods -A | grep -i mysql || true

echo ""
echo "==> akgunteknik namespace disindaki eski mysql deployment'lari (manuel silin):"
echo "    kubectl delete deployment ESKI_MYSQL_ADI -n NAMESPACE"

echo ""
echo "==> Bu repodaki tek MySQL: akgunteknik-mysql"
kubectl get deployment akgunteknik-mysql 2>/dev/null || echo "akgunteknik-mysql bulunamadi — kubectl apply -f k8s/"

echo ""
echo "==> Sunucudaki SQL dump dosyasi (olmamali):"
echo "    rm -f ~/akgunnew/akgun_canli_data.sql 2>/dev/null; echo 'Silindi veya zaten yok'"

echo ""
echo "Temizlik rehberi tamamlandi. Veri PVC uzerinde kalir."
