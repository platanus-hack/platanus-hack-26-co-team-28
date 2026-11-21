# Webcam gaze estimation in the browser on MediaPipe Face Landmarker (iris 468-477) vs/with WebGazer.js — implementation notes

Context: single-page HTML app, @mediapipe/tasks-vision 0.10.14 already loaded for a nose pointer, shown on a TV, 4-8 large targets. Research done 2026-11-21. Items marked [UNVERIFIED] come from my own prior knowledge or inference, not from a fetched source.

## 1. Which features work best (iris/corners, eyelids, eyeLook blendshapes, head pose)

### Takeaway
The best-documented recipe is iris-center offset relative to eye corners (dh, dv), normalized by eye width/inter-corner distance, plus a head-distance proxy and head pose, fed to a small regression fitted per session. No source I found benchmarks the eyeLook* blendshapes as a gaze signal; they are expression coefficients computed from 146 landmarks and should be treated as an extra noisy feature to test, not a primary one.

### Cited Findings
- Face Landmarker outputs 478 3D landmarks, 52 blendshapes (`outputFaceBlendshapes`) and a 4x4 canonical-to-face transform (`outputFacialTransformationMatrixes`); Web uses `delegate: "GPU"`, `runningMode: "VIDEO"`, `detectForVideo(video, ts)`. Left/Right blendshapes refer to the subject's face; mirroring the input inverts them. — [Face Landmarker docs](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker)
- Blendshape list includes eyeBlinkLeft/Right, eyeLookDown/In/Out/Up Left/Right, eyeSquint L/R, eyeWide L/R (indices 9-22). The Blendshape V2 model takes 146 2D FaceMesh landmarks as input, is meant for AR avatar control, was trained on synthetic GHUM-mesh data, and the card warns that noisy/low-light/motion conditions raise "jittering" in blendshapes. No gaze-accuracy metric is given for the eyeLook shapes. — [Blendshape V2 model card (PDF)](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Blendshape%20V2.pdf)
- A MediaPipe maintainer said an unsolved problem in blendshape estimation is distinguishing face shape from blendshape (e.g. eyes 50% closed vs. a person's neutral state); the requester also reported eyelid values drifting with head pose and eyelids never fully closing (2021, pre-Tasks API, so may be outdated). — [google/mediapipe#2526](https://github.com/google/mediapipe/issues/2526)
- Geometry-based paper on MediaPipe Attention Mesh (478 landmarks): 8 geometric descriptors (head rotations RX/RY, face width/height, pupil position relative to eye geometry using iris landmarks 468-477 range) fitted with multiple linear regression (3 sessions; 2 fit, 1 test) gave 1.60 deg x error and 1.95 deg y error, R2 0.98 (x) vs 0.87 (y). Small-N lab study; "less than 1.9 deg". — [Enhui et al., arXiv 2401.00406](https://www.arxiv.org/pdf/2401.00406)
- Reference FaceMesh+KRR browser engine (open TypeScript) uses a 13-dim feature vector: iris dh/dv relative to the inter-corner midpoint of each eye (4), inter-corner distance per eye as head-distance proxy (2), horizontal asymmetry between eyes (1), raw iris and corner coords normalized to face-bbox space (6). Features standardized (SD floor 0.02). — [Chen & Brat, arXiv 2608.11566, App. A.1](https://arxiv.org/pdf/2608.11566)
- Roboflow tutorial: features = iris centers relative to eye corners, normalized by inter-ocular distance, plus iris offset vectors and eyelid openness, left+right concatenated; needs `refineLandmarks: true` in the legacy FaceMesh API (Face Landmarker has iris by default). — [Roboflow blog](https://roboflow.com/blog/build-eye-tracking-in-browser)
- WebEyeTrack uses MediaPipe landmarks for eye patch, metric head pose (iris diameter assumed 1.2 cm for scale) and eye state. — [WebEyeTrack, arXiv 2508.19544](https://arxiv.org/html/2508.19544v1)
- Landmark-only ridge calibrator paper: deployed predictor "consumes only derived facial landmarks and head pose"; adding a low-capacity pose residual helps reduce pose leakage. — [Zhang, arXiv 2603.12388](https://arxiv.org/pdf/2603.12388)

### Inferences
- Landmark indices (standard FaceMesh topology, [UNVERIFIED] in fetched sources): right-eye outer/inner corners 33/133, left-eye inner/outer 362/263 (left/right = subject's); upper/lower lids 159/145 (right), 386/374 (left); iris centers 468 (right) and 473 (left), with 469-472 / 474-477 as the ring.
- Suggested per-eye features: dh = (irisX - midCornerX)/eyeWidth, dv = (irisY - midLidY)/eyeWidth (normalize vertical by eye WIDTH, not height, because height shrinks with squint/blink), plus eye openness = lidGap/eyeWidth. Rotate into the eye-corner axis first so head roll does not leak into dh/dv. Average both eyes.
- Cheap extra features to try: yaw/pitch/roll extracted from `facialTransformationMatrixes[0].data` (column-major 4x4), and the 4 eyeLook values (In/Out/Up/Down averaged per axis, e.g. horiz = (lookOutR - lookInR) - (lookOutL - lookInL)). Include in ridge and let calibration weight them; compare CV error with/without. Blendshapes are cheap (already computed) and normalize for head pose internally per the model card ("encapsulates all necessary scale, rotation and translation normalizations"), which is a plausible advantage, but no evidence either way.

### Gaps
- No benchmark of eyeLook* blendshapes against ground-truth gaze found (two searches). Must be tested empirically.
- Fetched sources did not print landmark indices for corners/lids; indices above come from prior knowledge.

## 2. Mapping/calibration math and open-source JS references

### Takeaway
Ridge regression (closed-form, lambda ~1e-3 on standardized features) or 2nd-order polynomial features from ~9 calibration targets is the established few-shot approach; nonlinear heads (RBF kernel ridge) need denser, edge-covering data (smooth pursuit ~500 pairs). I found no polished vanilla-JS repo that exactly matches "Face Landmarker + eyeLook + ridge"; the closest are a TypeScript reference engine, WebEyeTrack, and EyeGestures JS.

### Cited Findings
- Closed-form ridge with bias: W = (H^T H + lambda I)^-1 H^T Y, H = [e 1]; chosen because a 9-point grid gives few samples; online refinement via recursive least squares with forgetting factor, keeping the explicit-calibration head as fallback and blending only after enough evidence. 9-point calibration: 5.79 deg RMSE overall (2.92 deg still-head) at ~100 cm, 33 sessions; ridge on raw landmarks was far worse than the learned encoder in that paper (raw ridge numbers in its Table 1/2 show large errors, exact value not extracted), Elastic Net 6.68 deg. — [Zhang, arXiv 2603.12388](https://arxiv.org/pdf/2603.12388)
- FaceMesh+KRR: RBF kernel ridge, ridge lambda fixed 1e-3, gamma by median-pairwise-distance heuristic. Calibration patterns: 9-point grid at {5,50,95}% each axis, each fixated/clicked 5 times (~45 pairs); smooth-pursuit Lissajous 18 s at 30 Hz (~500 pairs, 5-95% of each axis). Mean error 8.05 deg (sweep) / 6.50 deg (drift) vs WebGazer 11.11 / 11.09 deg, N=1, 60 cm, MacBook Pro M4; difference within ~4.6 deg between-run variability, so authors do not rank them. KRR error grew radially to corners (best cell 1.3 deg, worst 19.3 deg) because pursuit under-covered the corners. Neither engine got sub-2 deg; "both behave as region-prompting signals". — [Chen & Brat, arXiv 2608.11566](https://arxiv.org/pdf/2608.11566)
- Control layer in that reference app: One-Euro smoothing, I-VT fixation classification, dwell-click. — same source.
- WebEyeTrack (GitHub RedForestAi/WebEyeTrack): few-shot MAML personalization with k<=9 samples, runs on-device in TF.js; error 2.32 cm GazeCapture, 4.56 cm MPIIFaceGaze, 7.53 cm EyeDiap; WebGazer error rose 49% over 20 min (7.79 to 11.62 cm) vs 20% for WebEyeTrack on Eye of the Typer. Requires its own TF.js model (heavier integration than ridge). — [arXiv 2508.19544](https://arxiv.org/html/2508.19544v1), [repo](https://github.com/RedForestAI/WebEyeTrack)
- Roboflow tutorial: 5-9 calibration points minimum, 9-12 better; small TF.js MLP (64-32-2, MSE, 20 epochs) on feature vector; moving average or 1-euro filter; ~20-30 FPS; recalibrate after zoom/resize/layout change. — [Roboflow](https://roboflow.com/blog/build-eye-tracking-in-browser)
- EyeGestures JS port (npm `eyegestures`, v1.0.0, ~13 weekly downloads): built-in 20-point calibration, hidden `<video>`, `onPoint` callback; GPL3 (Python version; JS licence not verified). Low maturity. — [npm eyegestures](https://npmjs.com/package/eyegestures), [README](https://unpkg.com/eyegestures@1.0.0/README.md)
- 5-point user-specific calibration with several regressors reported 1.12 deg (head moving) / 1.3 deg (fixed) in a 2024 IEEE Access paper (via search summary, paper not opened). — [DOAJ record](https://doaj.org/article/21ad3ac72299486a9497a31f1eb60713)

### Inferences
- Minimal implementation for tonight (author sketch, [UNVERIFIED], untested):
```js
// features f (length d) -> standardize -> ridge
function fitRidge(X, Y, lambda=1e-2){            // X: n x d (already standardized), Y: n x 2
  const H = X.map(r => [...r, 1]);               // add bias
  // solve (H'H + lambda I) W = H'Y with small Gauss-Jordan; d is ~10, so trivial
  ...
}
// optional 2nd-order: append f_i*f_j for i<=j, only if >= ~30 samples; else stay linear
```
  For 4-8 big targets, collect 30-60 frames per target (discard the first ~400 ms after the target appears and any blink frames), use leave-one-target-out CV to pick lambda.
- Because calibration targets will coincide with the real targets (or a superset), the screen-edge extrapolation problem seen with KRR is avoided if calibration dots sit on/past the actual target positions.
- WebGazer-style clicks are not needed; use dwell on dots.

### Gaps
- No vanilla-JS CodePen/GitHub repo specific to Face Landmarker + iris ridge was found via search (search engine returned mostly blogs/papers); the "gaze-detection" npm package was not examined.
- Raw-landmark ridge baseline numbers in arXiv 2603.12388 not extracted precisely.

## 3. How WebGazer.js works and how to integrate it

### Takeaway
WebGazer uses a ridge regression from eye-patch pixels to screen coords, self-calibrated by clicks/mouse movement, with a TF.js FaceMesh tracker by default; it is "fully functional" but officially unmaintained (Feb 2026 notice), GPLv3, and measured ~3-4 deg in good lab conditions but 8-11 deg in two recent in-browser reports. Fine as a fallback; not obviously better than a custom landmark ridge.

### Cited Findings
- README: runs entirely in the browser, self-calibrates from clicks/cursor; `calibration.html` has 9-point calibration and accuracy measurement; "official maintenance has ended", updates not guaranteed (page dated Feb 24, 2026), 874 commits, 67 open issues, no GitHub releases; GPLv3 (LGPLv3 for companies under $1M valuation). — [WebGazer repo](https://github.com/brownhci/WebGazer)
- Source (src/index.mjs): defaults `new webgazer.tracker.TFFaceMesh()` and `[new webgazer.reg.RidgeReg()]`; `setTracker(name)` takes names from the tracker map (key spelled `'TFFacemesh'`); `setRegression('ridge'|'weightedRidge'|'threadedRidge')` replaces regressions and keeps data; `addRegression`; `showVideo/showFaceOverlay/showFaceFeedbackBox/showPredictionPoints(bool)` and master `showVideoPreview`; `setGazeListener((data, t)=>...)`; clicks recorded in capture phase and mouse moves (throttled) via `recordScreenPosition(x,y,'click'|'move')` (can be called manually with your own dwell positions); `saveDataAcrossSessions(true)` (call before `begin()`) persists to localforage; `clearData()`; `begin()`, `pause()/resume()`, `end()`, `stopVideo()`. Predictions are smoothed with a 4-sample average. — [raw index.mjs](https://raw.githubusercontent.com/brownhci/WebGazer/master/src/index.mjs)
- `applyKalmanFilter(val)` only sets a param; the fetched summary found no Kalman implementation in that file (a comment asks "do we need this with Kalman filter?"). Treat the Kalman option as effectively inert. — same source (read through a summarizer, so [UNVERIFIED] against the full file/other modules).
- Papers cited by README (2016 IJCAI, 2017 CHIIR, 2018 ETRA) describe an older version; current code no longer matches. — [WebGazer repo](https://github.com/brownhci/WebGazer)
- Reported accuracy: 3-4 deg for best WebGazer model in prior studies (via search summary of a 2023 BRM paper; paper paywalled in fetch). In one N=1 MacBook M4 test, WebGazer had 11.1 deg mean error, p95 inference latency >=51 ms (lower bound), 0% hit rate on drift task, centroid offset ~9.5 deg toward bottom-left. — [arXiv 2608.11566](https://arxiv.org/pdf/2608.11566); [Springer BRM 2023 (not opened)](https://link.springer.com/10.3758/s13428-023-02190-6)

### Inferences
- Custom-UI recipe: `webgazer.setRegression('ridge').showVideoPreview(false).showPredictionPoints(false).saveDataAcrossSessions(false)`; during your own calibration, call `webgazer.recordScreenPosition(x, y, 'click')` repeatedly while the user fixates each dot; disable mouse listeners with `removeMouseEventListeners()` on a TV so stray mouse moves do not poison training. [UNVERIFIED in practice.]
- Running WebGazer next to your Face Landmarker means two FaceMesh pipelines on one camera; WebGazer loads its own TF.js FaceMesh, costing CPU/GPU. A custom ridge over your existing landmarks avoids that. GPLv3 also matters if the app is distributed.

### Gaps
- Did not verify WebGazer's latest npm version or the Kalman code path in other files; accuracy of WebGazer on a TV-distance (2-3 m) setup unknown.

## 4. Vertical vs horizontal gaze

### Takeaway
Vertical is consistently harder because eyelids occlude the top/bottom of the iris and vertical iris travel is small; evidence is from several sources but not universal across systems. Use 1-2 rows of targets (or make rows far apart), include eye-openness/lid features, and consider head pitch as a vertical cue.

### Cited Findings
- Geometry-based MediaPipe study: R2 0.98 x vs 0.87 y; angular error 1.60 vs 1.95 deg; authors explain that left/right limbus is visible while top/bottom is occluded by eyelids, worse for dark irises. — [arXiv 2401.00406](https://www.arxiv.org/pdf/2401.00406)
- Earlier low-cost recorder paper: y error higher than x because eyelids cover upper/lower eye (via search summary, not opened). — [arXiv 1611.09427](https://arxiv.org/pdf/1611.09427)
- UNL dissertation: horizontal iris offset most informative; vertical needs eyelid distance and openness features (via search summary). — [UNL digital commons](https://digitalcommons.unl.edu/computerscidiss/255)
- Counterexample: in a large validation, WebGazer's precision contours were stretched horizontally (Chiasm's vertically), so axis asymmetry is system-dependent. — [arXiv 2611.04946](https://arxiv.org/pdf/2611.04946) (via search summary)
- Head pitch: in the reference KRR app, error vs head pitch slope was -0.01 deg per deg (FaceMesh) and +0.10 (WebGazer), negligible — i.e. no evidence that pitch helps or hurts there. — [arXiv 2608.11566](https://arxiv.org/pdf/2608.11566)

### Inferences
- With a TV and 2 rows, put rows well separated (e.g. 30-40% of screen height apart). At 2-3 m a TV 1 m tall subtends ~20-27 deg vertical; with ~5-8 deg typical error a 2-row layout is feasible, 3+ rows is not.
- Using head pitch as a vertical cue is plausible (people tilt head to look down at lower targets) but I found no source testing it; let the ridge include pitch and check CV weights.

### Gaps
- No quantitative study isolating "head pitch as a substitute for vertical gaze" found.
- Webcam-to-TV distance (2-3 m) accuracy not covered by any fetched source; most evidence is laptop at 50-100 cm. At TV distances the iris is only a few pixels wide at typical webcam resolution, so expect noticeably worse performance [UNVERIFIED].

## 5. Classification (zones) vs regression

### Takeaway
No source directly compares them for webcam gaze. Indirect evidence says coarse webcam gaze behaves like "region prompting" with several-degree error, which supports classifying among few large well-separated zones; this is an inference, not a measured result.

### Cited Findings
- Both WebGazer and the FaceMesh+KRR engine fail sub-2 deg and "behave as region-prompting signals"; hit rate on a 1.8x2.0 deg cell grid was 0-20%. — [arXiv 2608.11566](https://arxiv.org/pdf/2608.11566)
- A poster treating gaze regression as classification over probabilistic regions reports a resolution/accuracy trade-off (75% accuracy for 13x13 cm regions); different setup. — [Jha 2019 poster](https://msp.utdallas.edu/publications/Jha_2019-poster.pdf) (via search summary)
- kNN reached 87.8% accuracy on gaze-object features in a non-webcam-gaze study; indicative only. — [arXiv 2203.15651](https://arxiv.org/pdf/2203.15651) (via search summary)

### Inferences
- Pragmatic hybrid: fit ridge to (x,y), then pick the nearest target center to the smoothed prediction, adding hysteresis/dwell time; or train per-zone k-NN/logistic on standardized features from calibration samples and compare by leave-one-target-out CV. With 4-8 well-separated targets, classification removes extrapolation error and corner blow-up, and allows a confidence margin ("no decision" if top-2 probabilities are close).
- Zone classification needs calibration samples on every zone (it cannot interpolate), so calibrate on exactly the real targets.

### Gaps
- No direct empirical comparison found; run your own CV.

## 6. Blink and eyelid handling

### Takeaway
Drop samples during blinks (eyeBlink blendshape threshold or eye-aspect ratio with a dynamic threshold) and a short window after, and include eye openness as a feature so partial lid droop is explained rather than read as vertical gaze.

### Cited Findings
- WebEyeTrack suppresses predictions during blinks via eye aspect ratio. — [arXiv 2508.19544](https://arxiv.org/html/2508.19544v1)
- EMC-Gaze: EAR from eyelid landmarks with short temporal history; frames below a dynamic threshold are flagged and skipped. — [arXiv 2603.12388](https://arxiv.org/pdf/2603.12388)
- Vertical eye orientation distorts blink/eyelid measures (pupil-based more than eyelid-based) in a BRM study (via search summary). — [Springer BRM 2023](https://link.springer.com/article/10.3758/s13428-023-02237-8)
- Blendshape model card: eyeBlinkLeft/Right exist (indices 9/10); jitter rises in poor light/motion. — [Model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Blendshape%20V2.pdf)

### Inferences
- Rule of thumb [UNVERIFIED thresholds]: discard if max(eyeBlinkL, eyeBlinkR) > ~0.4-0.5, and the 150-200 ms after; also gate on eyeSquint/openness ratio vs user's own median (captured during calibration) to catch droopy lids; reject frames when face is lost or yaw is beyond ~25-30 deg.
- Because lid position changes with vertical gaze (lids follow the eye down), do not threshold on absolute lid gap; use ratio to the user's calibration median.

### Gaps
- No source on handling chronically drooping eyelids (ptosis) specifically.

## 7. Performance on Apple Silicon (Chrome/Safari/Arc)

### Takeaway
Hard numbers are thin: a third-party README reports ~5 ms median per MediaPipe inference on Mac Mini M4 Pro/Chrome, which is far below the 33 ms camera frame time, so the camera (30 fps) is the limit, not the model. No Safari-on-Mac or Arc figures found.

### Cited Findings
- Mac Mini M4 Pro, Chrome 134: MediaPipe 5.2 ms median (WebGPU), 6.1 ms (WASM), p99 7.8/9.4 ms; iPhone 16 Pro Safari WebGPU 9.0 ms. Competitor's own benchmark, methodology not described. — [micro-facemesh README](https://cdn.jsdelivr.net/npm/@svenflow/micro-facemesh@0.1.2/README.md)
- In a MacBook Pro M4 / Chrome test, full FaceMesh pipeline latency (capture to result) was 27 ms p95 at 30 Hz video, vs >=51 ms for WebGazer. — [arXiv 2608.11566](https://arxiv.org/pdf/2608.11566)
- Landmark-only ridge head: calibrated prediction ~12.6 ms in headless Chromium (ONNX Runtime Web); the ridge itself is negligible. — [arXiv 2603.12388](https://arxiv.org/pdf/2603.12388)
- Roboflow tutorial: ~20-30 FPS on typical laptops. — [Roboflow](https://roboflow.com/blog/build-eye-tracking-in-browser)
- Timestamping caveat: measure latency from `requestVideoFrameCallback` capture time, not emission time, or you read ~0 ms. — [arXiv 2608.11566](https://arxiv.org/pdf/2608.11566)

### Inferences
- Since you already run the Landmarker for the nose pointer, gaze features are free; call `detectForVideo` once per new video frame (use `requestVideoFrameCallback`, not every rAF) and reuse landmarks + blendshapes + matrix from the same result.
- Request a higher camera resolution (e.g. 1280x720) for TV-distance use; the model crops the face internally to 256x256 per the model card, so the user should be close enough that the face fills enough pixels [partly UNVERIFIED].

### Gaps
- No measured FPS for Chrome vs Safari vs Arc on M1/M2/M3; Arc is Chromium so should match Chrome [UNVERIFIED]. Measure locally by logging `detectForVideo` time with `delegate: "GPU"` vs `"CPU"`.
- Limitation to flag: MediaPipe's Face Landmarker is a "selfie-mode" model; the blendshape card says unsuitable if looking away more than 80 deg or face too far, relevant for TV viewing distance.
