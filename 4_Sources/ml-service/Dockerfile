ARG PYTHON_IMAGE=python:3.12-slim
FROM ${PYTHON_IMAGE}

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt /app/requirements.txt
ARG PIP_INDEX_URL=https://pypi.org/simple
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt --index-url ${PIP_INDEX_URL}

COPY . /app/

RUN sed -i 's/\r$//' /app/entrypoint.sh \
    && chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
