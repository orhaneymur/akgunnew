#!/bin/bash
# akgun.derneklab.com → akgunteknik-frontend
# Bu kümede Traefik 213.238.168.227:80 üzerinde; nginx ingress'in ADDRESS'i yok.
set -euo pipefail

HOST="${INGRESS_HOST:-akgun.derneklab.com}"
INGRESS_NAME="${INGRESS_NAME:-akgunteknik-ingress}"
NAMESPACE="${NAMESPACE:-default}"
SERVICE="${FRONTEND_SERVICE:-akgunteknik-frontend}"
PORT="${FRONTEND_PORT:-80}"
NODE_IP="${NODE_IP:-213.238.168.227}"

# Kümede çalışan ingress sınıfını algıla (derneklab traefik kullanıyor)
INGRESS_CLASS="${INGRESS_CLASS:-}"
if [ -z "${INGRESS_CLASS}" ]; then
  if kubectl get ingress -A -o jsonpath='{range .items[*]}{.spec.ingressClassName}{"\n"}{end}' 2>/dev/null | grep -qx traefik; then
    INGRESS_CLASS=traefik
  elif kubectl get ingressclass traefik >/dev/null 2>&1; then
    INGRESS_CLASS=traefik
  else
    INGRESS_CLASS=nginx
  fi
fi

echo "==> Mevcut ingress kayitlari:"
kubectl get ingress -A 2>/dev/null | grep -iE 'derneklab|akgun' || kubectl get ingress -A

echo ""
echo "==> DNS (${HOST}):"
if command -v dig >/dev/null 2>&1; then
  DNS_IPS="$(dig +short "${HOST}" | tr '\n' ' ')"
  echo "  ${DNS_IPS}"
  if echo "${DNS_IPS}" | grep -qE '172\.|104\.21\.|104\.22\.|104\.23\.|104\.24\.|104\.25\.|104\.26\.|104\.27\.|104\.28\.|104\.29\.|104\.30\.|104\.31\.|141\.101\.|162\.158\.|188\.114\.|190\.93\.|197\.234\.|198\.41\.'; then
    echo "  UYARI: Cloudflare proxy aktif. Origin sunucu ${NODE_IP} olmali (Cloudflare DNS paneli)."
  fi
else
  getent hosts "${HOST}" 2>/dev/null || true
fi

echo ""
echo "==> Ingress: ${INGRESS_CLASS} | ${HOST} -> ${SERVICE}:${PORT}"
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${INGRESS_NAME}
  namespace: ${NAMESPACE}
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: web
spec:
  ingressClassName: ${INGRESS_CLASS}
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

# Nginx ingress kullanılıyorsa timeout annotation (Traefik'te pod nginx'i halleder)
if [ "${INGRESS_CLASS}" = "nginx" ]; then
  bash "$(dirname "$0")/patch-ingress-timeouts.sh" 2>/dev/null || true
fi

echo ""
echo "==> Ingress test (port 80, Host: ${HOST}):"
HTTP_CODE="$(curl -sS -o /tmp/akgun-ingress-test.html -w "%{http_code}" -H "Host: ${HOST}" "http://${NODE_IP}/" 2>/dev/null || echo "000")"
echo "  HTTP ${HTTP_CODE}"
if [ -f /tmp/akgun-ingress-test.html ]; then
  if grep -qi 'Akgün Teknik ERP' /tmp/akgun-ingress-test.html 2>/dev/null; then
    echo "  OK: Akgün Teknik ERP sayfasi geldi."
  else
    echo "  UYARI: Sayfa ERP degil gibi — icerik kontrol edin:"
    head -c 200 /tmp/akgun-ingress-test.html | tr '\n' ' '
    echo ""
  fi
fi

echo ""
echo "==> NodePort karsilastirma (30179):"
curl -sS http://${NODE_IP}:30179/ 2>/dev/null | grep -o '<title>[^<]*</title>' || true

echo ""
echo "==> Son durum:"
kubectl get ingress "${INGRESS_NAME}" -n "${NAMESPACE}"
echo ""
echo "Cloudflare: DNS A kaydi origin = ${NODE_IP} (turuncu bulut aciksa SSL/TLS Full)."
echo "Tarayici: https://${HOST}"
