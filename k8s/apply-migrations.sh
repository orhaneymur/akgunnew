#!/bin/bash
# v1.6+ veritabani migration'lari — deploy oncesi calistirilir (idempotent)
set -euo pipefail

DEPLOY="akgunteknik-mysql"
MYSQL_ROOT_PASSWORD="akgunteknik123"
MYSQL_DATABASE="akgunteknik"

echo "==> MySQL pod bekleniyor..."
kubectl rollout status "deployment/${DEPLOY}" --timeout=300s
kubectl wait --for=condition=Ready pod -l "app=${DEPLOY}" --timeout=300s

POD="$(kubectl get pod -l "app=${DEPLOY}" -o jsonpath='{.items[0].metadata.name}')"
echo "==> Migration pod: ${POD}"

mysql_exec() {
  kubectl exec "$POD" -- mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" "${MYSQL_DATABASE}" -e "$1"
}

column_exists() {
  local table="$1"
  local column="$2"
  local count
  count="$(kubectl exec "$POD" -- mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" "${MYSQL_DATABASE}" -N -e \
    "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${MYSQL_DATABASE}' AND TABLE_NAME='${table}' AND COLUMN_NAME='${column}';")"
  [[ "$count" -gt 0 ]]
}

fk_exists() {
  local name="$1"
  local count
  count="$(kubectl exec "$POD" -- mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" "${MYSQL_DATABASE}" -N -e \
    "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA='${MYSQL_DATABASE}' AND CONSTRAINT_NAME='${name}';")"
  [[ "$count" -gt 0 ]]
}

echo "==> Invoice.originalInvoiceId..."
if ! column_exists "Invoice" "originalInvoiceId"; then
  mysql_exec "ALTER TABLE \`Invoice\` ADD COLUMN \`originalInvoiceId\` INTEGER NULL;"
  echo "    + originalInvoiceId eklendi"
else
  echo "    = zaten var"
fi

echo "==> InvoiceItem.sourceInvoiceItemId..."
if ! column_exists "InvoiceItem" "sourceInvoiceItemId"; then
  mysql_exec "ALTER TABLE \`InvoiceItem\` ADD COLUMN \`sourceInvoiceItemId\` INTEGER NULL;"
  echo "    + sourceInvoiceItemId eklendi"
else
  echo "    = zaten var"
fi

if ! fk_exists "Invoice_originalInvoiceId_fkey"; then
  mysql_exec "ALTER TABLE \`Invoice\` ADD CONSTRAINT \`Invoice_originalInvoiceId_fkey\` FOREIGN KEY (\`originalInvoiceId\`) REFERENCES \`Invoice\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE;"
  echo "    + Invoice FK eklendi"
else
  echo "    = Invoice FK zaten var"
fi

if ! fk_exists "InvoiceItem_sourceInvoiceItemId_fkey"; then
  mysql_exec "ALTER TABLE \`InvoiceItem\` ADD CONSTRAINT \`InvoiceItem_sourceInvoiceItemId_fkey\` FOREIGN KEY (\`sourceInvoiceItemId\`) REFERENCES \`InvoiceItem\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE;"
  echo "    + InvoiceItem FK eklendi"
else
  echo "    = InvoiceItem FK zaten var"
fi

echo "==> Product detay kolonlari (v1.8.16+)..."
for col_def in \
  "brand VARCHAR(191) NULL" \
  "model VARCHAR(191) NULL" \
  "appearance VARCHAR(191) NULL" \
  "quality VARCHAR(191) NULL" \
  "rbmPrice DOUBLE NOT NULL DEFAULT 0" \
  "description TEXT NULL"; do
  col_name="${col_def%% *}"
  if ! column_exists "Product" "$col_name"; then
    mysql_exec "ALTER TABLE \`Product\` ADD COLUMN \`${col_name}\` ${col_def#* };"
    echo "    + Product.${col_name} eklendi"
  else
    echo "    = Product.${col_name} zaten var"
  fi
done

echo "==> Migration tamam."
