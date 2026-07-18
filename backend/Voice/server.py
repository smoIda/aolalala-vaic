"""
server.py
=========
HTTP wrapper quanh `SonioxSTT` (soniox_stt.py) để backend Node/Fastify
(apps/chatbot-api) có thể gọi Speech-to-Text qua một request HTTP đơn giản,
thay vì nhúng thẳng Soniox WebSocket client vào Node.

Chạy:
    pip install -r requirements.txt
    export SONIOX_API_KEY=<key>          # Windows: setx SONIOX_API_KEY "<key>"
    python server.py                      # mặc định lắng nghe :8001

Endpoint:
    POST /voice
        body: raw audio bytes (webm/wav/mp3/ogg/... - Soniox tự nhận container)
        ->    {"transcript": "..."}
    GET /health
        ->    {"ok": true, "service": "soniox-stt"}
"""

import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request

from soniox_stt import SonioxSTT

load_dotenv()

app = Flask(__name__)
stt = SonioxSTT(language_hints=["vi", "en"])


@app.get("/health")
def health():
    return jsonify({"ok": True, "service": "soniox-stt"})


@app.post("/voice")
def voice():
    audio = request.get_data()
    if not audio:
        return jsonify({"error": "empty_audio", "message": "No audio data received."}), 400

    try:
        transcript = stt.transcribe_audio_bytes(audio)
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": "stt_failed", "message": str(exc)}), 502

    return jsonify({"transcript": transcript})


if __name__ == "__main__":
    port = int(os.environ.get("SONIOX_SERVICE_PORT", "8001"))
    app.run(host="0.0.0.0", port=port)
