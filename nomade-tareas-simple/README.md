# Nomade Chile - Tracker de tareas (minimo)

## Stack mas simple posible
- HTML
- CSS
- JavaScript (vanilla)
- localStorage (persistencia local)

No usa framework, no usa backend, no requiere instalacion.

## Funciones incluidas
1. Crear tareas con campos:
- titulo
- descripcion breve
- proyecto
- tipo (Oficina o Campamento)
- responsable
- prioridad (Alta, Media, Baja)
- fecha compromiso
- estado (Pendiente, En curso, Vencida, Cerrada)

2. Listado de tareas con filtros por:
- proyecto
- responsable
- tipo
- estado

3. Resumen simple:
- tareas pendientes
- tareas vencidas
- tareas que vencen hoy
- tareas cerradas

4. Reglas basicas:
- Si la fecha compromiso ya paso y la tarea no esta cerrada, se marca como Vencida.
- Colores simples rojo/amarillo/verde.

## Como usar local
Opcion 1 (mas simple):
- Abrir `index.html` con doble clic.

Opcion 2 (URL local):
```bash
cd "/Users/sebastianantirenojoui/Documents/New project/nomade-tareas-simple"
python3 -m http.server 8080
```
Abrir: `http://localhost:8080`

## Archivo principal
- `index.html`
