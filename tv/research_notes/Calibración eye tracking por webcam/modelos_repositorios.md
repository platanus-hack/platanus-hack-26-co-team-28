# Modelos y repositorios open-source de gaze estimation por webcam (hackathon-ready)

Nota de método: GitHub API devolvio 403 y las paginas de GitHub no muestran fechas de commit en el extracto; por eso "ultimo commit" queda como GAP en casi todos los repos (verificar con `gh api repos/<owner>/<repo> --jq .pushed_at`). Fecha de hoy: 2026-11-21. Lo no verificado se marca [NO VERIFICADO].

## Tabla comparativa

| Proyecto | Salida | Precision reportada | Plataforma | Licencia (uso comercial) | Estado | Calibracion |
|---|---|---|---|---|---|---|
| WebGazer.js | punto en pantalla (x,y) | sin cifras en README | Browser JS | GPLv3; LGPLv3 si valuacion < 1M USD; otro caso = abrir issue | Mantenimiento oficial terminado | Autocalibracion por clics/movimiento de cursor |
| WebEyeTrack (RedForestAI) | punto en pantalla (x,y) | 2.32 cm en GazeCapture; 2.4 ms/inferencia en iPhone 14 (autores) | Browser JS (TF.js) + Python (TF/Keras) | MIT | Paper ago-2025; 421 commits | Few-shot on-device (~9 muestras segun paper) |
| EyeGestures (NativeSensors) | punto en pantalla + fixation/saccade | sin cifras | Python + JS (CDN) | GPL-3.0; negocios contactar; producto publico sin licencia comercial: mencionarlos | 540 commits, sin releases | Si, flag calibrate |
| EyeTrax (ck-zhang) | punto en pantalla | sin cifras | Python | MIT | v0.4.0, 24-feb-2026 | 9/5 puntos, Lissajous, grid denso |
| GazeFollower | punto en pantalla (CSV) | sin cifras (README) | Python | CC BY-NC-SA 4.0 (NO comercial) | v1.1.0, 16-sep-2026 | Si; pesos base grandes requieren email |
| MediaPipe Face Landmarker | 478 landmarks (incl. iris), 52 blendshapes, matriz 4x4 de pose | n/d | Browser JS + Python + mobile | Apache-2.0 [NO VERIFICADO en esta sesion] | activo | Capa propia necesaria |
| GazeTracking (antoinelame) | pupilas (x,y), ratios H/V 0-1, blink | ninguna | Python (dlib) | MIT | 34 commits, 50 issues abiertos | No hay mapeo a pantalla |
| L2CS-Net | vector de mirada (pitch/yaw) | no en README | Python/PyTorch | MIT | pocas commits (15 en el fork visto) | Capa propia necesaria |
| ptgaze (hysts) | vector 3D (mpiigaze, mpiifacegaze, eth-xgaze) | no en README | Python, "solo probado en Ubuntu" | MIT | 90 commits | Capa propia |
| OpenFace 3.0 (CMU) | yaw/pitch por ojo | 2.56 (MPIIGaze; unidad no explicita, presumible grados) | Python | NO CLARO | 45 commits | Capa propia |
| Eyedid/SeeSo SDK | punto en pantalla | n/d | JS, Android, iOS, Flutter | Comercial, license key | n/d | Si, SDK propio |
| Eyeware Beam | gaze 3D / pantalla via SDK | n/d | PC Windows (+ iPhone Face ID); sin macOS verificado | Comercial, suscripcion por dev y usuario final | activo | Si |
| Apple Eye Tracking | no hay API publica | n/a | iOS/iPadOS | n/a | n/a | n/a |
| Project Gameface | cursor por cabeza/gestos | n/a | Windows, Android | licencia no verificada | n/a | n/a |

## 1. Que da punto calibrado en pantalla de fabrica vs que necesita capa de mapeo

### Takeaway
Entregan punto en pantalla con calibracion integrada: WebGazer, WebEyeTrack, EyeGestures, EyeTrax, GazeFollower, Eyedid. Solo dan landmarks o vector (necesitan mapeo propio, p. ej. regresion ridge/polinomial desde 9 puntos): MediaPipe, GazeTracking, L2CS-Net, ptgaze, OpenFace 3.0.

### Cited Findings
- WebEyeTrack devuelve un punto (x,y) en pantalla, usa CNN ligera con personalizacion few-shot en el dispositivo; JS en TF.js, Python en TF/Keras — [GitHub](https://github.com/RedForestAI/webeyetrack)
- WebEyeTrack: paper arXiv 2508.19544 (27-ago-2025), 2.32 cm de error en GazeCapture, 2.4 ms en iPhone 14, minimo ~9 muestras de calibracion, deteccion de parpadeo con eye aspect ratio. Cifras de los propios autores, sin replicacion independiente hallada — [arXiv](https://arxiv.org/html/2508.19544v1)
- WebEyeTrack existe tambien como paquetes `webeyetrack` en PyPI y npm (nombres segun README) — [PyPI](https://pypi.org/project/webeyetrack/); la pagina npm devolvio 403, version [NO VERIFICADA]
- Harvard MMLA integra WebEyeTrack con MediaPipe + modelo TF.js y calibracion guiada de 2 rondas x 25 objetivos — [MMLA](https://mmla.gse.harvard.edu/tools/webeyetrack)
- WebGazer: sin cifras de precision, autocalibracion por clics/cursor, backend de landmarks no declarado en README — [GitHub](https://github.com/brownhci/WebGazer)
- EyeGestures JS `onPoint(point, calibration)`; Python `event.point`, `event.fixation` — [GitHub](https://github.com/NativeSensors/EyeGestures)
- EyeTrax: `GazeEstimator`, `extract_features()` + `predict()` devuelve coordenadas de pantalla; calibraciones 9/5 puntos, Lissajous, grid; filtros Kalman, Kalman+EMA, KDE; guardar/cargar modelo — [PyPI](https://pypi.org/project/eyetrax/)
- GazeTracking: solo posicion de pupilas, ratios, blink; sin mapeo a pantalla — [GitHub](https://github.com/antoinelame/GazeTracking)
- OpenFace 3.0: `predict()` devuelve yaw/pitch; error 2.56 en MPII Gaze — [GitHub](https://github.com/CMU-MultiComp-Lab/OpenFace-3.0), [arXiv](https://arxiv.org/abs/2506.02891v1)
- ptgaze: modos `mpiigaze`, `mpiifacegaze`, `eth-xgaze`; salida es overlay de video, no punto en pantalla — [GitHub](https://github.com/hysts/pytorch_mpiigaze_demo)

### Inferences
- Para el hackathon, las salidas tipo vector (L2CS, ptgaze, OpenFace) exigen ademas geometria camara-pantalla o regresion aprendida; con 9 puntos de calibracion es lo mas rapido.

### Gaps
- Precision real (cm/grados) de WebGazer, EyeGestures, EyeTrax, GazeFollower, L2CS en este hardware: no hay cifras en sus README; requiere medir.

## 2. Realista para una pagina HTML con MediaPipe tasks-vision 0.10.14

### Takeaway
Mejor encaje: seguir con tasks-vision (ya cargado) y agregar una capa propia de regresion sobre landmarks de iris + pose de cabeza, o probar WebEyeTrack JS (MIT, TF.js, punto en pantalla, calibracion few-shot). WebGazer es el camino mas rapido pero GPL.

### Cited Findings
- `npm install @mediapipe/tasks-vision`; la matriz de transformacion 4x4 se activa con `outputFacialTransformationMatrixes`; 478 landmarks y 52 blendshapes — [Google docs](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker)
- Modelo: https://huggingface.co/litert-community/MediaPipe-FaceLandmarker/resolve/main/face_landmarker.task — [Google docs](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker)
- WebGazer: `npm install` + `npm run build`, probado Node 16/18, `import webgazer from 'webgazer'`; ejemplos con `cd www; npm install; npm run serve`; requiere servidor local — [GitHub](https://github.com/brownhci/WebGazer)
- EyeGestures JS carga por CDN (`eyegestures.js`, `ml.min.js`, `math.min.js`) y requiere `<video>` — [GitHub](https://github.com/NativeSensors/EyeGestures)
- Eyedid/SeeSo web SDK: inicializa con license key, Chrome 80+, Firefox, Edge, Safari 15.2+; requiere cross-origin isolation (SharedArrayBuffer) en algunos navegadores — [unpkg README](https://unpkg.com/seeso@0.2.4/README.md)

### Inferences
- Cross-origin isolation (COOP/COEP) es un gotcha para Eyedid en una sola pagina HTML servida sin cabeceras.
- Las blendshapes eyeLook* de MediaPipe existen en el modelo (52 blendshapes) pero la pagina consultada no las lista [NO VERIFICADO el detalle].

### Gaps
- Fecha del ultimo commit de WebGazer y version npm exacta; pricing de Eyedid; licencia exacta de MediaPipe (se sabe Apache-2.0 por conocimiento previo, no verificado aqui).

## 3. Stream de gaze a navegador por WebSocket desde Python

### Takeaway
Ninguno trae servidor WebSocket integrado (segun lo leido); es trivial envolverlos. Candidatos Python: EyeTrax (MIT, punto en pantalla, calibracion), EyeGestures (GPL), L2CS/ptgaze (vector, requiere mapeo).

### Cited Findings
- EyeTrax instala con `pip install eyetrax`, Python 3.9+, v0.4.0 (24-feb-2026), tambien ofrece `eyetrax-virtualcam` (overlay a camara virtual), no WebSocket — [PyPI](https://pypi.org/project/eyetrax/)
- EyeGestures Python: `python3 -m pip install eyeGestures`; loop con `gestures.step(...)`; instalar mediapipe/scikit-learn/opencv por separado si falla — [GitHub](https://github.com/NativeSensors/EyeGestures)
- L2CS-Net: `pip install git+https://github.com/edavalosanaya/L2CS-Net.git@main`; pesos en Google Drive (`drive.google.com/drive/folders/17p6ORr-JQJcw-eYtG2WGNiuS_qVKwdWd`), demo usa `L2CSNet_gaze360.pkl`; MIT. OJO: la pagina leida resolvio al fork edavalosanaya, no se confirmo el repo Ahmednull — [GitHub](https://github.com/Ahmednull/L2CS-Net)
- ptgaze: `pip install ptgaze`; pesos desde Hugging Face Hub en primer uso; `face_landmarker.task` en `~/.ptgaze/mediapipe/`; `libgles2` en Linux — [GitHub](https://github.com/hysts/pytorch_mpiigaze_demo)
- GazeFollower: `python -m pip install gazefollower`, v1.1.0, CC BY-NC-SA 4.0; blink detection, jitter reduction, calibration optimization marcados como no implementados — [PyPI](https://pypi.org/project/gazefollower/)
- OpenFace 3.0: `pip install -r requirements.txt; pip install openface-test; openface download`; pesos en HF `nutPace/openface_weights` — [GitHub](https://github.com/CMU-MultiComp-Lab/OpenFace-3.0)
- GazeTracking: Python 3.10+, `pip install -e .`, dlib puede compilar (CMake via Homebrew en macOS) — [GitHub](https://github.com/antoinelame/GazeTracking)

### Inferences
- Patron recomendado: loop Python (EyeTrax) + `websockets` enviando JSON {x,y,t} a la pagina; la pagina solo pinta. Ahorra problemas de TF.js pero agrega latencia de red local (bajo) y depende de camara compartida (un proceso solo abre la webcam).

### Gaps
- Ningun repo verificado trae servidor WebSocket; fps en Apple Silicon no reportado en ninguna fuente leida.

## 4. Comerciales, nativos y otros

### Takeaway
Eyeware Beam y Eyedid son comerciales; Apple no expone gaze; Gameface es head/face, no gaze.

### Cited Findings
- Eyeware Beam SDK: Unity, Python, C#, C++, C; el acceso es via suscripcion in-app, y tanto el dev como cada usuario final deben comprarla; requiere Beam Eye Tracker >= 2.6.3; soporte iPhone/iPad con Face ID; sin evidencia de macOS nativo — [Eyeware dev](https://beam.eyeware.tech/developers/), [FAQ](https://beam.eyeware.tech/?p=4928)
- Apple: Eye Tracking es funcion de accesibilidad del sistema en iOS/iPadOS 18; en foros no hay API publica; en visionOS un ingeniero de Apple dijo que no hay forma soportada de obtener datos de mirada — [Apple forums](https://developer.apple.com/forums/thread/766870), [visionOS](https://developer.apple.com/forums/thread/835881). No hallado API para macOS.
- Project Gameface: open source, MediaPipe Face Landmark, Windows y Android; licencia no verificada — [Google blog](https://developers.googleblog.com/en/project-gameface-makes-gaming-accessible-to-everyone/)
- OpenFace 3.0: licencia no encontrada; el OpenFace original requeria licencia separada de CMU para uso comercial segun mirrors viejos — [arXiv](https://arxiv.org/abs/2506.02891v1)

### Inferences
- ARKit `ARFaceAnchor.lookAtPoint` existe en iOS con TrueDepth (conocimiento previo, [NO VERIFICADO]); no sirve para una web en Mac.

### Gaps
- No investigados por falta de presupuesto: Pupil Core (headset, no relevante para webcam), GazeRecorder, GazePointer, Talon, OptiKey, ETH-XGaze/FAZE/iTracker repos oficiales, MediaPipe Iris original, GazeCapture. Cifras de latencia/fps en M-series: ninguna.
