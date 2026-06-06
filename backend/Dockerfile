FROM python:3.10-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install system dependencies for build tools and PostgreSQL
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        gcc \
        curl \
        libpq-dev \
        postgresql-client \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy and install python dependencies
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy backend codebase
COPY . /app

EXPOSE 8000
