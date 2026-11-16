# Construir desde Canasta_sana/prototipo (necesita la base de web/public/datos):
#   docker build -f api/Dockerfile -t canasta-api .
#   docker run --rm -p 8000:8000 -v canasta_datos:/datos canasta-api
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    CANASTA_BASE=/app/productos_cr.json CANASTA_BD=/datos/precios.sqlite3 CANASTA_DOCS=0

WORKDIR /app
COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
 && useradd --create-home --uid 10001 canasta && mkdir /datos && chown canasta /datos
COPY api/canasta_api ./canasta_api
COPY web/public/datos/productos_cr.json ./productos_cr.json

USER canasta
VOLUME ["/datos"]
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/salud')"
# --no-access-log: el registro de acceso guardaría la IP de cada persona. --no-server-header: no anuncia «uvicorn».
# --limit-concurrency: con más de 64 conexiones a la vez responde 503 en lugar de agotar la memoria (P-07).
# CANASTA_DOCS=0 (arriba): sin /docs, que carga scripts de cdn.jsdelivr.net.
CMD ["uvicorn", "--factory", "canasta_api.main:crear_app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log",      "--no-server-header", "--limit-concurrency", "64"]
