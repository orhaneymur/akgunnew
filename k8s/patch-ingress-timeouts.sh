#!/bin/bash
# Mevcut Ingress'e yalnızca nginx timeout annotation ekler — host/backend'e dokunmaz.
# Rancher ile yönetilen ingress için güvenli.
set -euo pipefail

INGRESS_NAME="${INGRESS_NAME:-akgunteknik-ingress}"
NAMESPACE="${NAMESPACE:-default}"

if ! kubectl get ingress "${INGRESS_NAME}" -n "${NAMESPACE}" >/dev/null 2>&1; then
  echo "UYARI: ${NAMESPACE}/${INGRESS_NAME} bulunamadi — ingress atlandi."
  echo "       ERP'ye dogrudan: kubectl get svc akgunteknik-frontend"
  exit 0
fi

echo "==> Ingress timeout annotation (${NAMESPACE}/${INGRESS_NAME})..."
kubectl annotate ingress "${INGRESS_NAME}" -n "${NAMESPACE}" --overwrite \
  nginx.ingress.kubernetes.io/proxy-body-size="50m" \
  nginx.ingress.kubernetes.io/proxy-connect-timeout="600" \
  nginx.ingress.kubernetes.io/proxy-read-timeout="600" \
  nginx.ingress.kubernetes.io/proxy-send-timeout="600" \
  nginx.ingress.kubernetes.io/client-body-timeout="600" \
  nginx.ingress.kubernetes.io/proxy-request-buffering="off" \
  nginx.ingress.kubernetes.io/proxy-buffering="off"

echo "==> Mevcut ingress kurallari (degistirilmedi):"
kubectl get ingress "${INGRESS_NAME}" -n "${NAMESPACE}" -o jsonpath='{.spec.rules[*].host}{"\n"}' 2>/dev/null || true
kubectl get ingress "${INGRESS_NAME}" -n "${NAMESPACE}" -o jsonpath='{.spec.rules[0].http.paths[0].backend.service.name}{"\n"}' 2>/dev/null || true

echo "Timeout patch tamam."
