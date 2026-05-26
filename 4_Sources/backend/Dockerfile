FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY . /app/
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

RUN sed -i 's/\r$//' ./entrypoint.sh \
    && chmod +x ./entrypoint.sh
