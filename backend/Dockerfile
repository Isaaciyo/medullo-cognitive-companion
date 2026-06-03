# Medullo backend — FastAPI + SQLAlchemy + SQLite (or Postgres via DATABASE_URL).
#
# Build: docker build -t medullo-backend ./backend
# Run:   docker run -p 8000:8000 \
#          -e GEMINI_API_KEY=... \
#          -v medullo-data:/data \
#          medullo-backend
#
# In Railway / Fly / similar hosts, the platform injects $PORT; we honor it.
# Persistent SQLite goes in /data so a mounted volume keeps it across deploys.

FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System deps kept minimal: curl for healthchecks, ca-certs for HTTPS (Gemini).
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Install Python deps first for layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application.
COPY app ./app

# Persistent volume for SQLite. Defaults align with this path.
RUN mkdir -p /data
ENV DATABASE_URL=sqlite:////data/medullo.db \
    PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

# uvicorn binds 0.0.0.0 and honors $PORT (Railway / Fly inject it).
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
