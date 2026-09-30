# Single image: builds the React app, then serves it and the API from FastAPI.

FROM node:24-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY ingest/ ingest/
COPY api/ api/
COPY --from=web /web/dist web/dist

# Processed matches + SQLite live on a volume; raw data is downloaded from
# SkillCorner's GitHub unless a local clone is mounted at OPENDATA_DIR.
ENV CLIPPER_CACHE_DIR=/data OPENDATA_DIR=/opendata PRELOAD_MATCHES=1959846
VOLUME /data
EXPOSE 8000
CMD ["uv", "run", "--no-sync", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
