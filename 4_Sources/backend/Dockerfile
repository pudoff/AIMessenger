ARG PYTHON_IMAGE=python:3.12-slim
FROM ${PYTHON_IMAGE}

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY . /app/
ARG PIP_INDEX_URL=https://pypi.org/simple
RUN pip install --upgrade pip --timeout 60 --retries 5 --index-url ${PIP_INDEX_URL} \
    && pip install --no-cache-dir --timeout 60 --retries 5 -r requirements.txt --index-url ${PIP_INDEX_URL}

RUN sed -i 's/\r$//' ./entrypoint.sh \
    && chmod +x ./entrypoint.sh
