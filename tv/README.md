# WOKI · TV de Marta

La pantalla que usa la persona con ELA (mirada + clic EMG) y el puente local que la conecta con WhatsApp, Claude y ElevenLabs.

| Carpeta / archivo | Qué es |
|---|---|
| `prototipo/woki-os.html` | La TV: hablar con 4 frases sugeridas, emociones, teclado por grupos, reacciones, alarma, calibración de nariz o mirada |
| `prototipo/voz.html` | Onboarding de voz para la familia (celular): clonar su voz, elegir voces, dejar candidatas |
| `prototipo/woki-voz.js` | ElevenLabs en la TV: voz de Marta, elegir voz, llamada de emergencia |
| `woki-bridge/` | Puente Node local (`server.ts`): WhatsApp vía wapi, sugerencias con Claude (`sugerir.ts`), ElevenLabs (`voz.ts`) |
| `GUIA-ELEVENLABS.md` · `GUIA-WAPI-*.md` | Cómo configurar cada integración |
| `BRIEF.md`, `INFORME.md`, `PLAN*.md`, `hallazgos/`, `reports/`, `research_notes/` | Investigación UX y planes |
| `raspberry/` | Plan y fotos del hardware |

## Correr en local

```bash
# 1. La TV
cd tv/prototipo && python3 -m http.server 8000     # http://localhost:8000/woki-os.html

# 2. El puente
cd tv/woki-bridge
cp .env.example .env                                # completar claves
cp profile.example.json profile.json                # contactos reales: no se sube
npm install && npm run dev                          # http://localhost:8788
```

Datos reales (`.env`, `profile.json`, `history.json`, `voz.json`) quedan fuera del repo por `.gitignore`.
