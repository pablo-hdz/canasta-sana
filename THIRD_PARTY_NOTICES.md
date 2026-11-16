# Software de terceros

Canasta sana usa las siguientes bibliotecas. Cada una conserva su propia licencia. Las versiones y licencias se tomaron de los paquetes instalados (`package.json` y los metadatos de Python).

## App web (`prototipo/web`)

| Paquete | Versión | Licencia |
|---|---|---|
| [React](https://react.dev) y React DOM | 18.3.1 | MIT |
| [Tesseract.js](https://github.com/naptha/tesseract.js) | 5.1.1 | Apache-2.0 |
| [tesseract.js-core](https://github.com/naptha/tesseract.js-core) (motor OCR compilado a WebAssembly; incluye Tesseract OCR y Leptonica, cada uno con su licencia) | 5.1.1 | Apache-2.0 |
| [@tesseract.js-data/spa](https://www.npmjs.com/package/@tesseract.js-data/spa) (modelo de español) | 1.0.0 | MIT (según su paquete) |
| [PDF.js](https://github.com/mozilla/pdf.js) (`pdfjs-dist`) | 4.8.69 | Apache-2.0 |
| [Atkinson Hyperlegible Next](https://www.npmjs.com/package/@fontsource/atkinson-hyperlegible-next) (`@fontsource/atkinson-hyperlegible-next`) | 5.3.0 | SIL Open Font License 1.1 |

Desarrollo: Vite (MIT), Vitest (MIT), TypeScript (Apache-2.0), @vitejs/plugin-react (MIT) y los tipos de React (MIT).

## Servicio (`prototipo/api`)

| Paquete | Versión | Licencia |
|---|---|---|
| [FastAPI](https://fastapi.tiangolo.com) | 0.141.1 | MIT |
| [Starlette](https://www.starlette.io) | 1.10.0 | BSD-3-Clause |
| [Pydantic](https://docs.pydantic.dev) y pydantic-core | 2.14.3 / 2.50.4 | MIT |
| [Uvicorn](https://www.uvicorn.org) | 0.38.0 | BSD-3-Clause |

Los textos completos de cada licencia están en el repositorio de cada proyecto y en la carpeta del paquete instalado.

## Datos

Ver [`LICENCIA-DATOS.md`](LICENCIA-DATOS.md): Open Food Facts (ODbL 1.0 y DbCL 1.0).
