FROM python:3.11-slim

WORKDIR /app

# Instala dependências do sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copia e instala dependências Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia código do backend e banco de dados inicial
COPY backend_api.py .
COPY processos.db .

# Porta exposta pela API
EXPOSE 8000

CMD ["python", "backend_api.py"]
