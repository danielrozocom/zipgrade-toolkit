# 🛠️ ZipGrade Toolkit

Un Userscript potente y moderno para **ZipGrade** que permite empaquetar plantillas de exámenes en archivos ZIP por clases, gestionar timeouts automáticamente, ordenar registros por grados y actualizar descargas.

---

## 🚀 Instalación Rápida en Tampermonkey

Haz clic en el siguiente botón para instalar directamente en Tampermonkey con un solo clic:

[![Instalar en Tampermonkey](https://img.shields.io/badge/🚀_Instalar_en_Tampermonkey-RAW-10b981?style=for-the-badge&logo=tampermonkey)](https://raw.githubusercontent.com/danielrozocom/zipgrade-toolkit/main/zipgrade-toolkit.user.js)

> **Enlace directo RAW**: `https://raw.githubusercontent.com/danielrozocom/zipgrade-toolkit/main/zipgrade-toolkit.user.js`

---

## ✨ Características Principales

1. **📦 Descarga en Lote de PDFs (descarga individual)**:
   - Descarga múltiples paquetes de exámenes PDF organizados por sesión (`S1`/`S2`). Cada PDF se **descarga de forma individual** a tu carpeta de descargas (el empaquetado en un solo `.zip` no es posible por las restricciones del navegador y del servidor de ZipGrade).
   - Incluye barra de progreso visual en tiempo real y banner de descarga completada.

2. **⏱️ Prevención de Timeouts y Reintentos Adaptativos**:
   - Peticiones con tiempos de espera ampliados (45s - 90s) y pausas inteligentes entre peticiones para prevenir bloqueos de rate-limit en ZipGrade.

3. **🎓 Ordenación por Grados en `/classes/` y `/students/`**:
   - Ordena automáticamente las tablas de cursos y estudiantes de menor a mayor grado académico (ej: `6-1`, `6-2`, `7-1`, `10-1`, `11-2`, etc.).

4. **📋 Selector Automático "Show entries" -> "All"**:
   - Ajusta automáticamente el desplegable de paginación de DataTables a **"All"** para mostrar todas las entradas de la tabla sin necesidad de paginación.

5. **💾 Persistencia y Exportación/Importación JSON**:
   - Guarda tus asignaciones de plantillas en `localStorage` e intercambia configuraciones vía archivos `.json`.

6. **📥 Descarga Personalizada de Resultados**:
   - Detecta automáticamente los *Export Formats* personalizados del quiz: si solo existe uno, lo usa por defecto; si hay varios, muestra un selector con opción Excel/CSV.
   - El archivo se guarda renombrado como `Resultados_<nombre del quiz hasta la sesión>` (ej: `Resultados_Template E.S.A. _ 10_ - 11_ _ P3 _ S2.xlsx`).

7. **📋 Columnas "Estado" y "Descarga Rápida" en `/quizzes/`**:
   - **Estado**: muestra `escaneados/total (%)` por quiz — los papers calificados vs. el total de estudiantes de su clase, con código de color (rojo/ámbar/verde). El total se toma de `/classes/` (si la clase tiene estudiantes asignados se usa directamente; si es un rango de ordenación como `10° - 11°` con 0, suma automáticamente los estudiantes de sus clases reales `10-1`, `10-2`, `11-1`, `11-2`). La celda se inserta de forma síncrona para que nunca quede desalineada con "Descarga Rápida" al cargar la página.
   - **Descarga Rápida**: checkbox + **selector de formato personalizado** (preseleccionado y bloqueado si solo hay uno) + botón de descarga individual.
   - Card "ZipGrade Toolkit" con Seleccionar Todo, Modo de Orden, botón **"Descargar Resultados"** en lote con barra de progreso y banner.
   - Cada archivo se renombra automáticamente como `Resultados_<nombre hasta sesión>`.

8. **📅 Formato de fecha en detalle del quiz y copia de quizzes**:
   - En `/quiz/.../all/`, la fecha `September 16, 2026` se muestra como `Miércoles 16/SEP/2026`.
   - Al **copiar un quiz**, el nuevo quiz hereda automáticamente la **fecha original** del quiz fuente (la captura se dispara al abrir el modal, hacer clic en "Copy Quiz" o enviar el formulario).

---

## 🛠️ Instalación Manual

1. Instala la extensión [Tampermonkey](https://www.tampermonkey.net/) en tu navegador (Chrome, Edge, Firefox, Brave).
2. Haz clic en el botón [Instalar en Tampermonkey](https://raw.githubusercontent.com/danielrozocom/zipgrade-toolkit/main/zipgrade-toolkit.user.js).
3. Presiona **Instalar** (o **Actualizar**).
4. Abre [ZipGrade Classes](https://www.zipgrade.com/classes/) o [ZipGrade Students](https://www.zipgrade.com/students/) y disfruta de la herramienta.
