FROM python:3.11-slim

# System dependencies for RDKit, Open Babel, AutoDock Vina
RUN apt-get update && apt-get install -y --no-install-recommends \
    openbabel \
    libopenbabel-dev \
    wget \
    curl \
    build-essential \
    libboost-all-dev \
    && rm -rf /var/lib/apt/lists/*

# Install AutoDock Vina binary
RUN wget -q https://github.com/ccsb-scripps/AutoDock-Vina/releases/download/v1.2.5/vina_1.2.5_linux_x86_64 \
    -O /usr/local/bin/vina && chmod +x /usr/local/bin/vina

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY backend/ ./backend/
COPY data/ ./data/
COPY .env .env

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
