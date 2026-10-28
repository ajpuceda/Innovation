# Startup-in-a-Box AI Architect

Plataforma web para que emprendedores construyan su proyecto ejecutivo completo basado en datos reales, con asistencia de la API de Mistral AI.

## Cómo ejecutar

La app es HTML/JS puro sin dependencias ni build. Cualquier servidor estático sirve:

```bash
# Opción 1: Python
python3 -m http.server 8080

# Opción 2: Node
npx serve .
```

Luego abre `http://localhost:8080` en tu navegador.

## Persistencia de estado

Todo el progreso vive en un único objeto de estado exportable como `business_project.json`:

- **Guardar Progreso Actual** (botón permanente en la barra superior): descarga el JSON actualizado en cualquier momento.
- **Cargar Proyecto Anterior** (pantalla de bienvenida): sube el `business_project.json` para restaurar la clave de Mistral, los datos acumulados y el paso exacto donde te quedaste.
- **Iniciar Nuevo Proyecto**: limpia el estado por completo.

La Clave API de Mistral AI se solicita en la interfaz, se guarda en el estado y se incluye en el archivo exportado.

## Flujo de pasos

1. **Bienvenida** — API Key + Nuevo/Cargar proyecto.
2. **Datos Básicos** — nombre, sector, país, ciudad y descripción del negocio (guardado en tiempo real en el estado).
3. **Validación Preliminar** — consulta a Mistral AI con la descripción del negocio; devuelve JSON puro con 3 desafíos iniciales, mostrados en pantalla y guardados en el estado.
