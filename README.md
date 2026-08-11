# 🛠️ ZipGrade Toolkit

Un Userscript potente y moderno para **ZipGrade** que permite descargar plantillas de exámenes y resultados por clases, gestionar timeouts y límites de velocidad automáticamente, ordenar registros por grados, traducir las tablas a español, subir key answers en CSV y copiar quizzes heredando la fecha original.

---

## 🚀 Instalación Rápida en Tampermonkey

Haz clic en el siguiente botón para instalar directamente en Tampermonkey con un solo clic:

[![Instalar en Tampermonkey](https://img.shields.io/badge/🚀_Instalar_en_Tampermonkey-RAW-10b981?style=for-the-badge&logo=tampermonkey)](https://raw.githubusercontent.com/danielrozocom/zipgrade-toolkit/main/zipgrade-toolkit.user.js)

> **Enlace directo RAW**: `https://raw.githubusercontent.com/danielrozocom/zipgrade-toolkit/main/zipgrade-toolkit.user.js`

---

## ✨ Características Principales

### 1. 📦 Descarga de PDFs en `/classes/`
- **Descarga en lote e individual** de paquetes de exámenes PDF por clase. Cada PDF se **descarga de forma individual** a tu carpeta de descargas (el empaquetado en un solo `.zip` no es posible por las restricciones del navegador y del servidor de ZipGrade).
- **Columna "Descarga Rápida"**: checkbox + selector de plantilla + botón de descarga individual por fila.
- **Card "ZipGrade Toolkit"** con:
  - **Seleccionar Todo / Deseleccionar Todo** y contador de filas marcadas.
  - **Selector de Sesión (S1/S2)** con persistencia en `localStorage`.
  - **Asignación Masiva**: elige una plantilla y aplícala a todos los cursos marcados de una sola vez.
  - Botón **"Descargar PDFs"** en lote con barra de progreso visual y banner de descarga completada.
  - Botón **"Detener"** para cancelar el proceso en cualquier momento.
- Los archivos se guardan como `<Clase>_<Sesión>.pdf` (ej: `10-1_S2.pdf`).

### 2. ⏱️ Prevención de Timeouts, Reintentos Adaptativos y Anti-Bloqueo
- Peticiones con tiempos de espera ampliados (45s - 90s).
- **Reintentos adaptativos** con backoff: esperas de 8s/12s/18s para errores de red.
- **Recuperación de límite de velocidad (rate-limit)**: si ZipGrade bloquea la petición, espera 30s/45s/60s antes de reintentar.
- **Enfriamiento automático**: pausa de 20s cada 5 descargas exitosas para evitar bloqueos del servidor.
- Detección de sesión expirada y plantilla no encontrada para omitir cursos sin agotar reintentos.

### 3. 🎓 Ordenación Académica por Grados
- **`/classes/`**: ordena las clases de menor a mayor grado y sección (ej: `6-1`, `6-2`, `7-1`, `10-1`, `11-2`). Las clases sin estudiantes se envían al final.
- **`/students/`**: ordena los estudiantes por grado y **código/Student ID** (menor a mayor).
- **`/quizzes/`**: ordena los quizzes por **Fecha > Curso** o **Curso > Fecha** (modo elegible desde la card y recordado entre visitas).
- **Creación/edición de quiz**: ordena la lista de checkboxes de cursos académicamente (clases individuales primero, luego rangos como `10° - 11°`, y `Sandbox`/`Teachers` al final).

### 4. 📋 Selector Automático "Show entries" -> "All"
- Ajusta automáticamente el desplegable de paginación de DataTables a **"All"** para mostrar todas las entradas de la tabla sin paginación.

### 5. 💾 Persistencia y Exportación/Importación JSON
- Guarda tus asignaciones de plantillas en `localStorage` (independiente por sesión S1/S2) e intercambia configuraciones vía archivos `.json`.

### 6. 📥 Descarga Personalizada de Resultados
- Detecta automáticamente los *Export Formats* personalizados del quiz: si solo existe uno, lo usa por defecto; si hay varios, muestra un selector con opción Excel/CSV.
- El archivo se guarda renombrado como `Resultados_<nombre del quiz hasta la sesión>` (ej: `Resultados_Template E.S.A. _ 10_ - 11_ _ P3 _ S2.xlsx`).

### 7. 📋 Columnas "Estado" y "Descarga Rápida" en `/quizzes/`
- **Estado**: muestra `escaneados/total (%)` por quiz — los papers calificados vs. el total de estudiantes de su clase, con código de color (rojo/ámbar/verde). El total se toma de `/classes/` (si la clase tiene estudiantes asignados se usa directamente; si es un rango de ordenación como `10° - 11°` con 0, suma automáticamente los estudiantes de sus clases reales `10-1`, `10-2`, `11-1`, `11-2`). La celda se inserta de forma síncrona para que nunca quede desalineada con "Descarga Rápida" al cargar la página.
- **Caché de consultas**: el estado de escaneados se cachea en `localStorage` por **5 minutos** y el mapa de estudiantes de `/classes/` por **10 minutos**, evitando recargar las pesadas páginas `/all/` en cada visita.
- **Apertura rápida de modales**: el HTML de las páginas `/all/` y de edición que la columna Estado ya descarga en segundo plano se reutiliza en memoria (TTL 5 min) al abrir **Copiar/Editar**, por lo que los modales abren casi al instante sin volver a descargar.
- **Descarga Rápida**: checkbox + **selector de formato personalizado** (preseleccionado y bloqueado si solo hay uno) + botón de descarga individual.
- Card "ZipGrade Toolkit" con Seleccionar Todo, Modo de Orden, botón **"Descargar Resultados"** en lote con barra de progreso y banner.
- Cada archivo se renombra automáticamente como `Resultados_<nombre hasta sesión>`.

### 8. 📅 Formato de fecha en detalle del quiz y copia de quizzes
- En `/quiz/.../all/`, la fecha `September 16, 2026` se muestra como `Miércoles 16/SEP/2026`.
- Al **copiar un quiz**, el nuevo quiz hereda automáticamente la **fecha original** del quiz fuente (la captura se dispara al abrir el modal, hacer clic en "Copy Quiz" o enviar el formulario).
- En la **edición/creación de quiz**, el campo de fecha muestra el mismo formato en español y el nombre del quiz antiguo se corrige automáticamente al formato `Template E.S.A. | Clase | Periodo | Sesión`.

### 9. ✏️ Copiar y Editar Quiz desde la tabla en `/quizzes/`
- **Columna "Acciones"**: dos botones por fila (copiar / editar), ambos en **modales**.
- **Copiar**: el modal reutiliza el formulario de copia real de ZipGrade y permite crear **varias copias a la vez** — cada fila con su propio nombre y sus clases (puedes marcar **una o varias clases** y se crea **una copia individual por cada clase**, poniendo el nombre de la clase en el nombre del quiz). Todas heredan la **fecha original** del quiz fuente y ninguna clase viene preseleccionada.
- **Editar**: el modal muestra el **formulario completo** (nombre, plantilla/Answer Sheet, carpeta, fecha y checkboxes de clases) y guarda vía AJAX recargando la tabla.
- Las columnas personalizadas (Estado, Descarga Rápida, Key y Acciones) quedan desactivadas para ordenación/búsqueda de DataTables.

### 10. 🌐 Traducción y centrado de las tablas
- Las cabeceras de la tabla de quizzes se traducen al español (`Nombre`, `Clase`, `Preguntas`, `Fecha`, `Carpeta`) y se conservan entre recargas del DOM.
- Todos los encabezados y celdas de `#quizTable` y `#subjectTable` quedan **centrados horizontal y verticalmente**, eliminando también el espacio que DataTables reserva para las flechas de ordenación.

### 11. 🗝️ Columna "Key" en `/quizzes/`
- Verifica automáticamente si cada quiz tiene **key answers** cargadas (`✔ Key` en verde / `✘ Sin key` en rojo / `?` si no se pudo comprobar).
- Botón para **subir un CSV de key answers** usando el endpoint oficial de importación de ZipGrade, con confirmación vía *toast*.
- Enlace **"Ver key ↪"** que abre el editor de key answers del quiz en una pestaña nueva.

---

## 🛠️ Instalación Manual

1. Instala la extensión [Tampermonkey](https://www.tampermonkey.net/) en tu navegador (Chrome, Edge, Firefox, Brave).
2. Haz clic en el botón [Instalar en Tampermonkey](https://raw.githubusercontent.com/danielrozocom/zipgrade-toolkit/main/zipgrade-toolkit.user.js).
3. Presiona **Instalar** (o **Actualizar**).
4. Abre [ZipGrade Classes](https://www.zipgrade.com/classes/) o [ZipGrade Students](https://www.zipgrade.com/students/) y disfruta de la herramienta.
