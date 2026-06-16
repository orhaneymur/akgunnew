#!/bin/bash
# akgun.derneklab.com → akgunteknik-frontend (port 80 ingress)
# NodePort (30179) çalışıyorsa ERP ayaktadır; bu script domain yönlendirmesini düzeltir.
set -euo pipefail

HOST="${INGRESS_HOST:-akgun.derneklab.com}"
INGRESS_NAME="${INGRESS_NAME:-akgunteknik-ingress}"
NAMESPACE="${NAMESPACE:-default}"
SERVICE="${FRONTEND_SERVICE:-akgunteknik-frontend}"
PORT="${FRONTEND_PORT:-80}"

echo "==> Mevcut ingress kayitlari (derneklab):"
kubectl get ingress -A 2>/dev/null | grep -i derneklab || kubectl get ingress -A

echo ""
echo "==> DNS kontrolu:"
if command -v dig >/dev/null 2>&1; then
  dig +short "${HOST}" || true
else
  getent hosts "${HOST}" 2>/dev/null || true
fi

echo ""
echo "==> Ingress guncelleniyor: ${HOST} -> ${SERVICE}:${PORT}"
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${INGRESS_NAME}
  namespace: ${NAMESPACE}
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "600"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "600"
    nginx.ingress.kubernetes.io/client-body-timeout: "600"
    nginx.ingress.kubernetes.io/proxy-request-buffering: "off"
    nginx.ingress.kubernetes.io/proxy-buffering: "off"
spec:
  ingressClassName: nginx
  rules:
    - host: ${HOST}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ${SERVICE}
                port:
                  number: ${PORT}
EOF

echo ""
echo "==> Ingress test (Host header ile, port 80):"
NODE_IP="$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}' 2>/dev/null || true)"
if [ -z "${NODE_IP}" ]; then
  NODE_IP="$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null || true)"
fi
if [ -n "${NODE_IP}" ]; then
  curl -sS -o /dev/null -w "HTTP %{http_code}\n" -H "Host: ${HOST}" "http://${NODE_IP}/" 2>/dev/null \
    || echo "curl basarisiz — tarayicidan ${HOST} deneyin"
else
  echo "Node IP bulunamadi — tarayicidan ${HOST} deneyin"
fi

echo ""
echo "==> Son durum:"
kubectl get ingress "${INGRESS_NAME}" -n "${NAMESPACE}"
echo ""
echo "Tamam. Tarayici: http://${HOST} veya https://${HOST}"
