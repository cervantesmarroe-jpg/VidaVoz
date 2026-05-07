# VidaVoz · Wireframe (TFM)

Prototipo standalone low-fidelity del **asistente de comunicación VidaVoz** para pacientes en UCI. Esta versión wireframe está pensada como **anexo del Trabajo Fin de Máster**: presenta la arquitectura UX, la jerarquía visual y la navegación gaze-driven sin dependencias de cámara, eye-tracking real, backend ni APIs externas.

---

## Objetivo

Mostrar de forma limpia y reproducible:

- La **arquitectura de pantallas** del asistente.
- La **navegación entre módulos** (Urgente, Mensajes, Escalas, Teclado).
- El **patrón de activación por mirada** (dwell de 3 segundos) simulado visualmente al pasar el cursor sobre cada botón.
- La sensación de UX accesible: tipografía clara, jerarquía visual estable y feedback progresivo.

---

## Estructura

```
wireframe-export/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── main.tsx                 ← entry point React
    ├── App.tsx                  ← router (wouter)
    ├── Landing.tsx              ← portada con acceso a las 4 pantallas
    ├── WireframeLayout.tsx      ← header + tabs de navegación
    ├── WireframeButton.tsx      ← botón con dwell 3s simulado
    ├── wireframe.css            ← estilos monocromos (.wf-*)
    └── pages/
        ├── WireframeUrgent.tsx  ← 4 botones críticos
        ├── WireframeMessages.tsx ← 10 necesidades comunes
        ├── WireframeScales.tsx  ← EVA / Borg / Ansiedad (0-10)
        └── WireframeKeyboard.tsx ← QWERTY low-fi
```

---

## Pantallas

| Ruta | Pantalla | Propósito UX |
|---|---|---|
| `/` | Landing | Portada del prototipo con acceso directo a cada módulo |
| `/urgente` | Urgente | Botones de máxima prioridad: aire, dolor, náuseas, sed |
| `/mensajes` | Mensajes | Necesidades comunes: familia, baño, temperatura, posición… |
| `/escalas` | Escalas | Escalas clínicas EVA, Borg y ansiedad de 0 a 10 |
| `/teclado` | Teclado | Entrada libre QWERTY con salida prevista por síntesis de voz |

La navegación entre módulos vive en las **tabs inferiores** del layout, replicando el patrón de la app real.

---

## Navegación gaze-driven (simulada)

Cada botón implementa el mismo patrón de activación que la app de producción:

1. La mirada entra en el botón → arranca un **fill progresivo desde abajo** y un **glow interior**.
2. A los **3000 ms** el botón se activa.
3. Si la mirada sale antes, el progreso se cancela suavemente.

En esta versión standalone el dwell se dispara con `pointer-enter` para que un revisor pueda probarlo con ratón/táctil sin necesidad de cámara.

---

## Cómo ejecutar

Requisitos: **Node.js 18+** y npm.

```bash
cd wireframe-export
npm install
npm run dev
```

Abre `http://localhost:5173`.

Para generar una build estática (HTML+CSS+JS) que pueda anexarse al TFM o subirse a cualquier hosting:

```bash
npm run build
npm run preview
```

La carpeta `dist/` resultante es totalmente portable.

---

## Lo que NO incluye (intencionalmente)

- ❌ Eye-tracking real (sin MediaPipe ni cámara)
- ❌ Calibración ni perfiles de usuario
- ❌ Backend, base de datos ni APIs
- ❌ Síntesis de voz real
- ❌ Service worker / PWA
- ❌ Telemetría ni analytics
- ❌ Autenticación

Sólo presentación visual y navegación.

---

## Diseño visual

- Paleta gris suave (`#f5f5f5`, `#fafafa`, `#bdbdbd`).
- Bordes `dashed` en elementos placeholder.
- Iconografía sustituida por etiquetas textuales.
- Tipografía sans-serif del sistema.
- Layout responsive: portrait (móvil) y landscape (tablet) con grids adaptados.

---

## Licencia

Material académico — Trabajo Fin de Máster. Uso libre con atribución.
