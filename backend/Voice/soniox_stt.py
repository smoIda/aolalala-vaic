"""
soniox_stt.py
=============
Speech-to-Text (voice -> text) cho chatbot, dùng Soniox Real-time STT WebSocket API.

Nhận GIỌNG NÓI của người dùng và trả về VĂN BẢN, dùng làm input cho chatbot.

Hai kịch bản trong cùng một class `SonioxSTT`:

  1. FILE / PUSH-TO-TALK  -> `transcribe_file(path)`
     Người dùng thu âm/ upload một đoạn -> nhận về text hoàn chỉnh.
     (Không cần thư viện thu âm; hợp khi bạn đã có sẵn file audio.)

  2. MICROPHONE (real-time) -> `transcribe_microphone(on_utterance=...)`
     Lắng nghe mic liên tục. Nhờ *endpoint detection*, mỗi khi người dùng
     NÓI XONG một lượt, Soniox trả về token đặc biệt "<end>"; ta gom lại thành
     một câu hoàn chỉnh và đẩy vào chatbot ngay -> trải nghiệm trợ lý giọng nói.

Yêu cầu:
  pip install websockets                 # bắt buộc
  pip install sounddevice numpy          # chỉ cần cho chế độ microphone

  export SONIOX_API_KEY=<key của bạn>    # lấy tại https://console.soniox.com

Tài liệu:
  - Real-time transcription: https://soniox.com/docs/stt/rt/real-time-transcription
  - Endpoint detection:      https://soniox.com/docs/stt/rt/endpoint-detection
  - WebSocket API reference: https://soniox.com/docs/api-reference/stt/websocket-api
"""

from __future__ import annotations

import json
import os
import queue
import re
import threading
from dataclasses import dataclass, field
from typing import Callable, Iterable, Iterator, Optional

from websockets.sync.client import connect
from websockets.exceptions import ConnectionClosed

SONIOX_STT_WS_URL = "wss://stt-rt.soniox.com/transcribe-websocket"
DEFAULT_MODEL = "stt-rt-v5"

# Các token điều khiển KHÔNG phải nội dung -> không đưa vào transcript.
END_TOKEN = "<end>"   # endpoint detection: người dùng đã nói xong một lượt
FIN_TOKEN = "<fin>"   # manual finalization: đã chốt các token đang chờ

# Callback tùy chọn
PartialCallback = Optional[Callable[[str], None]]      # text tạm (đang nói), để hiển thị live
UtteranceCallback = Callable[[str], None]              # một lượt nói hoàn chỉnh -> đẩy vào chatbot


def _clean_transcript(text: str) -> str:
    """Chuẩn hoá nhẹ text trước khi đưa vào chatbot (Soniox đã tự chấm câu/viết hoa)."""
    text = re.sub(r"\s+", " ", text)
    return text.strip()


@dataclass
class SonioxSTT:
    api_key: Optional[str] = None
    model: str = DEFAULT_MODEL
    # Gợi ý ngôn ngữ để tăng độ chính xác, ví dụ ["vi"] hoặc ["vi", "en"] cho câu pha tiếng Anh.
    language_hints: Optional[list[str]] = None
    # Ngữ cảnh giúp nhận đúng thuật ngữ/tên riêng. Ví dụ:
    #   {"general": [{"key": "domain", "value": "ngân hàng"}],
    #    "terms": ["Techcombank", "OTP", "sao kê"]}
    context: Optional[dict] = None
    enable_speaker_diarization: bool = False

    def __post_init__(self) -> None:
        self.api_key = self.api_key or os.environ.get("SONIOX_API_KEY")
        if not self.api_key:
            raise RuntimeError(
                "Thiếu SONIOX_API_KEY. Lấy key tại https://console.soniox.com "
                "rồi: export SONIOX_API_KEY=<key>"
            )

    # -- Cấu hình mở phiên (message JSON đầu tiên gửi lên WebSocket) --
    def _build_config(
        self,
        audio_format: str,
        sample_rate: Optional[int],
        num_channels: Optional[int],
        enable_endpoint_detection: bool,
    ) -> dict:
        cfg: dict = {
            "api_key": self.api_key,
            "model": self.model,
            "audio_format": audio_format,
        }
        if sample_rate is not None:
            cfg["sample_rate"] = sample_rate
        if num_channels is not None:
            cfg["num_channels"] = num_channels
        if self.language_hints:
            cfg["language_hints"] = self.language_hints
        if self.context:
            cfg["context"] = self.context
        if self.enable_speaker_diarization:
            cfg["enable_speaker_diarization"] = True
        if enable_endpoint_detection:
            cfg["enable_endpoint_detection"] = True
        return cfg

    # ------------------------------------------------------------------ #
    # Lõi: gửi audio (binary frames) trong 1 thread, nhận token ở thread chính.
    # ------------------------------------------------------------------ #
    def _run(
        self,
        audio_chunks: Iterable[bytes],
        audio_format: str,
        sample_rate: Optional[int],
        num_channels: Optional[int],
        enable_endpoint_detection: bool,
        on_partial: PartialCallback,
        on_utterance: Optional[UtteranceCallback],
        stop_event: Optional[threading.Event],
        finalize_timeout: float = 3.0,
    ) -> str:
        # `finalize_timeout`: sau khi đã gửi hết audio (frame rỗng = kết thúc
        # stream), một số phiên không trả về "finished" đúng như tài liệu Soniox
        # mô tả (https://soniox.com/docs/api-reference/stt/websocket-api) mà cứ
        # im lặng rồi tự đóng với lỗi 408 "request_timeout" sau khoảng 20s.
        # Quan sát thực tế: transcript đúng đã có sẵn trong token "provisional"
        # (is_final=false) ngay khi việc gửi audio kết thúc, chỉ là chưa được
        # server chốt (is_final=true). Để tránh treo/lỗi, nếu không có phản hồi
        # mới trong `finalize_timeout` giây sau khi đã gửi xong, dùng transcript
        # tạm tích luỹ được làm kết quả cuối thay vì tiếp tục chờ.
        config = self._build_config(
            audio_format, sample_rate, num_channels, enable_endpoint_detection
        )
        send_error: list[Exception] = []
        send_done = threading.Event()

        with connect(SONIOX_STT_WS_URL) as ws:
            def sender() -> None:
                try:
                    ws.send(json.dumps(config))          # 1) cấu hình
                    for chunk in audio_chunks:           # 2) audio dạng binary frame
                        if stop_event is not None and stop_event.is_set():
                            break
                        if chunk:
                            ws.send(chunk)
                    ws.send(b"")                         # 3) frame rỗng = kết thúc stream
                except Exception as exc:  # noqa: BLE001
                    send_error.append(exc)
                finally:
                    send_done.set()

            threading.Thread(target=sender, daemon=True).start()

            full_final: list[str] = []       # toàn bộ transcript (mọi token final)
            utterance: list[str] = []         # transcript của lượt nói hiện tại
            provisional = ""                  # token chưa final -> hiển thị tạm
            timed_out = False

            try:
                while True:
                    if send_error:
                        raise RuntimeError(f"Lỗi khi gửi audio: {send_error[0]}")

                    try:
                        raw = ws.recv(timeout=finalize_timeout if send_done.is_set() else None)
                    except TimeoutError:
                        timed_out = True
                        break

                    res = json.loads(raw)

                    if res.get("error_code") is not None:
                        # Đã gửi xong audio và có transcript tạm -> coi lỗi finalize
                        # (vd 408 request_timeout) là "hết audio", không phải lỗi thật.
                        if send_done.is_set() and (full_final or provisional):
                            timed_out = True
                            break
                        raise RuntimeError(
                            f"Soniox lỗi {res['error_code']} "
                            f"({res.get('error_type')}): {res.get('error_message')}"
                        )

                    provisional = ""
                    for tok in res.get("tokens", []):
                        text = tok.get("text", "")

                        # Người dùng vừa nói xong một lượt.
                        if text == END_TOKEN:
                            phrase = _clean_transcript("".join(utterance))
                            utterance.clear()
                            if phrase and on_utterance:
                                on_utterance(phrase)
                            continue
                        if text == FIN_TOKEN:
                            continue

                        if tok.get("is_final"):
                            full_final.append(text)
                            utterance.append(text)
                        else:
                            provisional += text

                    if on_partial and provisional:
                        on_partial(_clean_transcript(provisional))

                    if res.get("finished"):
                        break
            except ConnectionClosed:
                pass  # server đóng sau khi 'finished' -> bình thường

            tail_text = "".join(utterance) + (provisional if timed_out else "")
            if on_utterance:
                tail = _clean_transcript(tail_text)
                if tail:
                    on_utterance(tail)

        result_text = "".join(full_final)
        if timed_out and provisional:
            result_text += provisional
        return _clean_transcript(result_text)

    # ------------------------------------------------------------------ #
    # Chế độ 1: FILE / PUSH-TO-TALK  ->  trả về text hoàn chỉnh
    # ------------------------------------------------------------------ #
    def transcribe_file(
        self,
        path: str,
        chunk_size: int = 8192,
        on_partial: PartialCallback = None,
    ) -> str:
        """
        Nhận diện toàn bộ một file audio (wav/mp3/flac/ogg... tự nhận container).
        Trả về text để làm input cho chatbot.
        """
        def read_chunks() -> Iterator[bytes]:
            with open(path, "rb") as fh:
                while True:
                    data = fh.read(chunk_size)
                    if not data:
                        break
                    yield data

        return self._run(
            audio_chunks=read_chunks(),
            audio_format="auto",              # tự nhận định dạng từ header file
            sample_rate=None,
            num_channels=None,
            enable_endpoint_detection=False,  # muốn cả file, không cắt theo câu
            on_partial=on_partial,
            on_utterance=None,
            stop_event=None,
        )

    def transcribe_audio_bytes(self, audio: bytes, **kwargs) -> str:
        """Như transcribe_file nhưng nhận thẳng bytes (vd audio upload từ web)."""
        chunk_size = kwargs.pop("chunk_size", 8192)

        def gen() -> Iterator[bytes]:
            for i in range(0, len(audio), chunk_size):
                yield audio[i : i + chunk_size]

        return self._run(
            audio_chunks=gen(),
            audio_format="auto",
            sample_rate=None,
            num_channels=None,
            enable_endpoint_detection=False,
            on_partial=kwargs.pop("on_partial", None),
            on_utterance=None,
            stop_event=None,
        )

    # ------------------------------------------------------------------ #
    # Chế độ 2: MICROPHONE real-time  ->  gọi on_utterance mỗi lượt nói xong
    # ------------------------------------------------------------------ #
    def transcribe_microphone(
        self,
        on_utterance: UtteranceCallback,
        on_partial: PartialCallback = None,
        sample_rate: int = 16000,
        stop_event: Optional[threading.Event] = None,
    ) -> None:
        """
        Lắng nghe micro liên tục. Mỗi khi người dùng nói xong một lượt
        (endpoint detection), gọi on_utterance(text) -> bạn đẩy text vào chatbot.

        Chạy tới khi stop_event được set, hoặc nhấn Ctrl+C.
        Cần: pip install sounddevice numpy
        """
        try:
            import sounddevice as sd
        except ImportError as exc:  # noqa: BLE001
            raise RuntimeError(
                "Chế độ microphone cần: pip install sounddevice numpy"
            ) from exc

        stop_event = stop_event or threading.Event()
        audio_q: "queue.Queue[bytes]" = queue.Queue()

        def audio_callback(indata, frames, time_info, status) -> None:  # noqa: ANN001
            if status:
                print(f"[audio] {status}")
            audio_q.put(bytes(indata))  # int16 PCM little-endian, mono

        def mic_chunks() -> Iterator[bytes]:
            while not stop_event.is_set():
                try:
                    yield audio_q.get(timeout=0.1)
                except queue.Empty:
                    continue

        stream = sd.RawInputStream(
            samplerate=sample_rate,
            channels=1,
            dtype="int16",
            blocksize=int(sample_rate * 0.1),  # ~100ms mỗi block
            callback=audio_callback,
        )

        print("🎙️  Đang lắng nghe... (Ctrl+C để dừng)")
        with stream:
            try:
                self._run(
                    audio_chunks=mic_chunks(),
                    audio_format="pcm_s16le",
                    sample_rate=sample_rate,
                    num_channels=1,
                    enable_endpoint_detection=True,   # phát hiện khi người dùng nói xong
                    on_partial=on_partial,
                    on_utterance=on_utterance,
                    stop_event=stop_event,
                )
            except KeyboardInterrupt:
                stop_event.set()
                print("\n⏹️  Đã dừng.")


# --------------------------------------------------------------------------- #
# Ví dụ tích hợp chatbot
# --------------------------------------------------------------------------- #

def transcribe_once(path: str) -> str:
    """Push-to-talk: đưa 1 file audio -> nhận text để feed chatbot."""
    stt = SonioxSTT(language_hints=["vi", "en"])
    text = stt.transcribe_file(path)
    print(f"Người dùng nói: {text}")
    return text


def voice_assistant_loop() -> None:
    """
    Trợ lý giọng nói: nghe mic, mỗi lượt nói xong thì đẩy vào chatbot.
    Thay `fake_chatbot` bằng chatbot thật của bạn.
    """
    def fake_chatbot(user_text: str) -> str:
        return f"(chatbot đã nhận: '{user_text}')"

    def on_utterance(user_text: str) -> None:
        print(f"\n👤 {user_text}")
        reply = fake_chatbot(user_text)      # <-- gọi chatbot của bạn ở đây
        print(f"🤖 {reply}")

    def on_partial(partial: str) -> None:
        print(f"   …{partial}", end="\r")    # hiển thị text tạm khi đang nói

    stt = SonioxSTT(
        language_hints=["vi", "en"],
        context={"terms": ["Soniox", "chatbot", "API"]},  # từ khoá hay gặp -> nhận đúng hơn
    )
    stt.transcribe_microphone(on_utterance=on_utterance, on_partial=on_partial)


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        # python soniox_stt.py duong_dan_file.mp3   -> nhận diện một file
        transcribe_once(sys.argv[1])
    else:
        # python soniox_stt.py                        -> trợ lý giọng nói (cần mic)
        voice_assistant_loop()
