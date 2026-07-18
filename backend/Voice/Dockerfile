# syntax=docker/dockerfile:1
FROM python:3.13-slim
WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY soniox_stt.py server.py ./

ENV SONIOX_SERVICE_PORT=8001
EXPOSE 8001

# Transcription blocks up to ~15s per request (real-time WS + finalize wait),
# so give gunicorn a generous worker timeout. 2 workers handle light concurrency.
CMD ["gunicorn", "--bind", "0.0.0.0:8001", "--workers", "2", "--timeout", "120", "server:app"]
