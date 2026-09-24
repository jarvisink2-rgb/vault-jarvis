#!/usr/bin/env python3
# JARVIS sight — extract key frames + transcript from a video. Usage: video_ingest.py <video> <outdir>
import sys, os, json, urllib.request

video, outdir = sys.argv[1], sys.argv[2]
os.makedirs(outdir, exist_ok=True)
result = {'frames': 0, 'transcript': False}

try:
    import av
    container = av.open(video)
    vs = container.streams.video[0]
    dur = float(container.duration / av.time_base) if container.duration else 60.0
    n = 8 if dur > 20 else max(3, int(dur / 3) or 3)
    targets = [dur * (0.03 + 0.94 * i / max(1, n - 1)) for i in range(n)]
    idx = 0
    for t in targets:
        try:
            container.seek(int(t * av.time_base))
            frame = next(container.decode(vs), None)
            if frame is None: continue
            w, h = frame.width, frame.height
            nw = min(1024, w); nh = int(h * nw / w) & ~1
            fr = frame.reformat(width=nw, height=nh, format='yuvj420p')
            idx += 1
            out = av.open(os.path.join(outdir, 'frame%02d_t%ds.jpg' % (idx, int(t))), 'w')
            st = out.add_stream('mjpeg', rate=1)
            st.width, st.height, st.pix_fmt = nw, nh, 'yuvj420p'
            for p in st.encode(fr): out.mux(p)
            for p in st.encode(None): out.mux(p)
            out.close()
        except Exception:
            continue
    result['frames'] = idx
    container.close()
except Exception as e:
    result['error'] = str(e)[:200]

# transcript via the local whisper sidecar (if running)
try:
    with open(video, 'rb') as f: data = f.read()
    req = urllib.request.Request('http://127.0.0.1:3334', data=data, method='POST')
    with urllib.request.urlopen(req, timeout=300) as r:
        text = json.loads(r.read().decode()).get('text', '')
    if text:
        with open(os.path.join(outdir, 'transcript.txt'), 'w') as f: f.write(text)
        result['transcript'] = True
except Exception:
    pass

print(json.dumps(result))
