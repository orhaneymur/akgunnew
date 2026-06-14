#!/bin/bash
# akgunteknik-mysql pod'una akgun_canli_data.sql import eder.
# Kullanim: bash k8s/import-database.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL_FILE="${ROOT}/akgun_canli_data.sql"
DEPLOY="akgunteknik-mysql"
MYSQL_ROOT_PASSWORD="akgunteknik123"
MYSQL_DATABASE="akgunteknik"

if [[ ! -f "$SQL_FILE" ]]; then
  echo "HATA: $SQL_FILE bulunamadi. Once: git pull origin orhan"
  exit 1
fi

echo "==> MySQL pod hazir olana kadar bekleniyor..."
kubectl rollout status "deployment/${DEPLOY}" --timeout=300s
kubectl wait --for=condition=Ready pod -l "app=${DEPLOY}" --timeout=300s

POD="$(kubectl get pod -l "app=${DEPLOY}" -o jsonpath='{.items[0].metadata.name}')"
echo "==> Import: ${SQL_FILE} -> pod ${POD}"

kubectl exec -i "$POD" -- mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" < "$SQL_FILE"

echo "==> Dogrulama..."
kubectl exec "$POD" -- mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" "${MYSQL_DATABASE}" -e "
  SHOW TABLES;
  SELECT COUNT(*) AS customer_count FROM Customer;
  SELECT COUNT(*) AS product_count FROM Product;
"

echo "==> Import tamam! Backend'i yenileyin:"
echo "    kubectl rollout restart deployment/akgunteknik-backend"
