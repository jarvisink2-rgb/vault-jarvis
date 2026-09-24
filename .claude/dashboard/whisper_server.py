#!/usr/bin/env python3
# JARVIS ears — local Whisper STT sidecar (port 3334). Auto-started by server.js.
import json, tempfile, os
from http.server import HTTPServer, BaseHTTPRequestHandler
from faster_whisper import WhisperModel

MODEL = os.environ.get('WHISPER_MODEL', 'small')  # multilingual: understands English + Chinese (auto-detect)
# Domain prior. Whisper leans on this heavily for proper nouns and acronyms, which is where
# a general model fails on IB vocabulary. Cheap, and the single biggest accuracy win here.
PROMPT = os.environ.get('WHISPER_PROMPT') or (
    'Jarvis, my vault assistant. Boss. IB Diploma, HL, SL, IA, EE, TOK, CAS, Extended Essay, '
    'Computer Science, Math AA, Physics, Psychology, English A, Chinese A, SAT, Bluebook, Digital SAT, '
    'Paper 1, Paper 2, criterion, mark scheme, past paper, revision, syllabus, Obsidian, vault, wikilink, '
    'morning report, night review, inbox brief, deep research, quiz me. '
    '賈維斯，我的筆記助理。中文筆記、複習、考試、報告、行事曆、電子郵件、但以理書、聖經、活著、做工的人、小氣財神。')
print('[whisper] loading model:', MODEL, flush=True)
model = WhisperModel(MODEL, device='cpu', compute_type='int8')
print('[whisper] ready', flush=True)

class H(BaseHTTPRequestHandler):
    def do_GET(self):
        b = b'{"ok":true}'
        self.send_response(200); self.send_header('content-type', 'application/json')
        self.send_header('content-length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_POST(self):
        n = int(self.headers.get('content-length', 0) or 0)
        data = self.rfile.read(n)
        text = ''
        if data:
            lang = (self.headers.get('x-lang') or '').strip().lower()
            lang = {'en': 'en', 'zh': 'zh'}.get(lang)  # anything else (incl. 'auto') -> None = auto-detect
            with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as f:
                f.write(data); p = f.name
            try:
                segs, info = model.transcribe(
                    p, language=lang,
                    beam_size=5, best_of=5,                    # was beam_size=2 — the cheapest accuracy gain
                    temperature=[0.0, 0.2, 0.4, 0.6],          # fall back only when the greedy pass is unconfident
                    condition_on_previous_text=False,          # stops one bad clip poisoning the next
                    no_speech_threshold=0.5,
                    compression_ratio_threshold=2.4,           # drop the repetition loops Whisper falls into
                    vad_filter=True,
                    vad_parameters=dict(min_silence_duration_ms=400, speech_pad_ms=250),  # keep the first syllable
                    initial_prompt=PROMPT)
                text = ' '.join(s.text.strip() for s in segs).strip()
            except Exception:
                text = ''
            finally:
                os.unlink(p)
        b = json.dumps({'text': text}).encode()
        self.send_response(200); self.send_header('content-type', 'application/json')
        self.send_header('content-length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def log_message(self, *a): pass

HTTPServer(('127.0.0.1', 3334), H).serve_forever()
