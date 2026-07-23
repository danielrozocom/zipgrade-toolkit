# 🛠️ ZipGrade Toolkit

Un Userscript potente y moderno para **ZipGrade** que permite empaquetar plantillas de exámenes en archivos ZIP por clases, gestionar timeouts automáticamente, ordenar registros por grados y actualizar descargas.

---

## 🚀 Instalación Rápida en Tampermonkey

Haz clic en el siguiente botón para instalar directamente en Tampermonkey con un solo clic:

[![Instalar en Tampermonkey](https://img.shields.io/badge/🚀_Instalar_en_Tampermonkey-RAW-10b981?style=for-the-badge&logo=tampermonkey)](https://raw.githubusercontent.com/danielrozocom/zipgrade-toolkit/main/zipgrade-toolkit.user.js)

> **Enlace directo RAW**: `https://raw.githubusercontent.com/danielrozocom/zipgrade-toolkit/main/zipgrade-toolkit.user.js`

---

## ✨ Características Principales

1. **📦 Empaquetado y Descarga en Lote en ZIP**:
   - Descarga múltiples paquetes de exámenes PDF organizados por sesión (`S1`/`S2`) en un solo archivo comprimido `.zip`.
   - Incluye barra de progreso visual en tiempo real y banner de descarga directa por si el navegador bloquea ventanas emergentes.

2. **⏱️ Prevención de Timeouts y Reintentos Adaptativos**:
   - Peticiones con tiempos de espera ampliados (45s - 90s) y pausas inteligentes entre peticiones para prevenir bloqueos de rate-limit en ZipGrade.

3. **🎓 Ordenación por Grados en `/classes/` y `/students/`**:
   - Ordena automáticamente las tablas de cursos y estudiantes de menor a mayor grado académico (ej: `6-1`, `6-2`, `7-1`, `10-1`, `11-2`, etc.).

4. **📋 Selector Automático "Show entries" -> "All"**:
   - Ajusta automáticamente el desplegable de paginación de DataTables a **"All"** para mostrar todas las entradas de la tabla sin necesidad de paginación.

5. **💾 Persistencia y Exportación/Importación JSON**:
   - Guarda tus asignaciones de plantillas en `localStorage` e intercambia configuraciones vía archivos `.json`.

---

## 🛠️ Instalación Manual

1. Instala la extensión [Tampermonkey](https://www.tampermonkey.net/) en tu navegador (Chrome, Edge, Firefox, Brave).
2. Haz clic en el botón [Instalar en Tampermonkey](https://raw.githubusercontent.com/danielrozocom/zipgrade-toolkit/main/zipgrade-toolkit.user.js).
3. Presiona **Instalar** (o **Actualizar**).
4. Abre [ZipGrade Classes](https://www.zipgrade.com/classes/) o [ZipGrade Students](https://www.zipgrade.com/students/) y disfruta de la herramienta.
