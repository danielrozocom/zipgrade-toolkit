// ==UserScript==
// @name         ZipGrade Toolkit
// @namespace    http://tampermonkey.net/
// @version      25.0
// @description  Empaqueta descargas en ZIP con selección de archivos nativa, gestión de timeouts, barra de progreso, descarga directa, recuperación automática de límites de velocidad y ordenación por grados y código en /classes/ y /students/.
// @match        https://www.zipgrade.com/classes/*
// @match        https://www.zipgrade.com/students/*
// @downloadURL  https://raw.githubusercontent.com/danielrozocom/zipgrade-toolkit/main/zipgrade-toolkit.user.js
// @updateURL    https://raw.githubusercontent.com/danielrozocom/zipgrade-toolkit/main/zipgrade-toolkit.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// ==/UserScript==

(async function () {
    'use strict';

    // ==========================================
    // 1. CARGA DINÁMICA DE FONT AWESOME
    // ==========================================
    function loadFontAwesome() {
        if (document.querySelector('link[href*="font-awesome"], link[href*="fontawesome"]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css';
        link.onload = () => console.log("✅ [ZipGrade] Font Awesome cargado.");
        document.head.appendChild(link);
    }
    loadFontAwesome();

    let availableSheets = [];
    let cancelDownloadRequested = false;
    const STORAGE_KEY_MAPPINGS = 'zipgrade_toolkit_saved_mappings';

    // ==========================================
    // 2. PONDERACIÓN ACADÉMICA Y ORDENACIÓN POR GRADOS
    // ==========================================
    function extractGradeWeight(text) {
        if (!text) return 99999;
        let clean = text.replace(/[º°ª]/g, '').replace(/\s+/g, ' ').trim();

        // Patrón: 6-1, 10-2, 6-A, etc.
        const dashMatch = clean.match(/\b(\d{1,2})\s*[-\s°]\s*(\d{1,2}|[A-Za-z])\b/);
        if (dashMatch) {
            const grade = parseInt(dashMatch[1], 10);
            let sec = parseInt(dashMatch[2], 10);
            if (isNaN(sec)) {
                sec = dashMatch[2].toUpperCase().charCodeAt(0) - 64;
            }
            return (grade * 100) + sec;
        }

        // Patrón: 6A, 10B
        const letterMatch = clean.match(/\b(\d{1,2})\s*([A-Za-z])\b/);
        if (letterMatch) {
            const grade = parseInt(letterMatch[1], 10);
            const sec = letterMatch[2].toUpperCase().charCodeAt(0) - 64;
            return (grade * 100) + sec;
        }

        // Patrón: 601, 1002
        const numMatch = clean.match(/\b(\d{3,4})\b/);
        if (numMatch) {
            const val = parseInt(numMatch[1], 10);
            if (val >= 600 && val <= 1200) {
                const grade = Math.floor(val / 100);
                const sec = val % 100;
                return (grade * 100) + sec;
            }
        }

        // Patrón: Grado simple (ej: 6, 7, 10, 11)
        const singleNumMatch = clean.match(/\b(\d{1,2})\b/);
        if (singleNumMatch) {
            const grade = parseInt(singleNumMatch[1], 10);
            if (grade >= 1 && grade <= 12) {
                return grade * 100;
            }
        }

        return 99999;
    }

    function checkZeroStudents(row, baseWeight) {
        const countEl = row.querySelector('td:nth-child(4) h4') || row.querySelector('td:nth-child(4)');
        if (countEl) {
            const text = countEl.innerText.trim();
            const studentCount = parseInt(text, 10);
            if (studentCount === 0 || text === '0') {
                return baseWeight + 50000;
            }
        }
        return baseWeight;
    }

    function getAcademicWeight(row) {
        // En /classes/ buscar preferiblemente en la celda 2 (nombre de clase)
        const nameEl = row.querySelector('td:nth-child(2) h4') || row.querySelector('td:nth-child(2) a') || row.querySelector('td:nth-child(2)');
        if (nameEl) {
            const w = extractGradeWeight(nameEl.innerText);
            if (w < 99999) return checkZeroStudents(row, w);
        }
        return checkZeroStudents(row, 99999);
    }

    // ==========================================
    // 3. HELPER DE PETICIÓN HÍBRIDA CON TIMEOUT AMPLIADO Y NORMALIZACIÓN DE BLOBS
    // ==========================================
    function customRequest(options, timeoutMs = 45000) {
        return new Promise((resolve, reject) => {
            let isSettled = false;
            let timer = setTimeout(() => {
                if (!isSettled) {
                    isSettled = true;
                    reject(new Error(`Timeout (${Math.round(timeoutMs / 1000)}s) en petición: ${options.url}`));
                }
            }, timeoutMs);

            const cleanup = () => {
                if (timer) clearTimeout(timer);
            };

            if (typeof GM_xmlhttpRequest !== 'undefined') {
                GM_xmlhttpRequest({
                    anonymous: false,
                    ...options,
                    timeout: timeoutMs,
                    onload: (res) => {
                        if (isSettled) return;
                        isSettled = true;
                        cleanup();

                        let resp = res.response;

                        // Normalización si se solicitó un blob pero regresó como ArrayBuffer o String
                        if (options.responseType === 'blob' && !(resp instanceof Blob)) {
                            if (resp instanceof ArrayBuffer) {
                                const contentType = res.responseHeaders?.match(/content-type:\s*([^\s;]+)/i)?.[1] || 'application/pdf';
                                resp = new Blob([resp], { type: contentType });
                            }
                        }

                        resolve({
                            status: res.status,
                            responseText: res.responseText || '',
                            response: resp,
                            headers: res.responseHeaders
                        });
                    },
                    onerror: (err) => {
                        if (isSettled) return;
                        isSettled = true;
                        cleanup();
                        reject(err || new Error("Error en la conexión HTTP"));
                    },
                    ontimeout: () => {
                        if (isSettled) return;
                        isSettled = true;
                        cleanup();
                        reject(new Error(`Timeout en GM_xmlhttpRequest (${Math.round(timeoutMs / 1000)}s)`));
                    }
                });
            } else {
                fetch(options.url, {
                    method: options.method || 'GET',
                    headers: options.headers || {},
                    body: options.data,
                    credentials: 'include'
                }).then(async (res) => {
                    if (isSettled) return;
                    isSettled = true;
                    cleanup();

                    let body;
                    if (options.responseType === 'blob') {
                        body = await res.blob();
                    } else {
                        body = await res.text();
                    }

                    resolve({
                        status: res.status,
                        responseText: typeof body === 'string' ? body : '',
                        response: body
                    });
                }).catch(err => {
                    if (isSettled) return;
                    isSettled = true;
                    cleanup();
                    reject(err);
                });
            }
        });
    }

    // ==========================================
    // 4. OBTENER PLANTILLAS DE CUSTOMSHEET
    // ==========================================
    async function fetchSheets() {
        console.log("🔍 [ZipGrade] Obteniendo lista global de plantillas...");
        try {
            const res = await customRequest({
                method: "GET",
                url: "https://www.zipgrade.com/customSheet/list/"
            }, 30000);

            if (res.status !== 200) throw new Error(`Error HTTP ${res.status} al obtener plantillas`);

            const doc = new DOMParser().parseFromString(res.responseText, "text/html");
            availableSheets = [];

            const rows = Array.from(doc.querySelectorAll('#sheetTable tbody tr'));
            rows.forEach(row => {
                const nameTd = row.querySelector('td:first-child');
                if (nameTd) {
                    const sheetName = nameTd.innerText.trim();
                    if (sheetName && !availableSheets.includes(sheetName)) {
                        availableSheets.push(sheetName);
                    }
                }
            });
            console.log(`✅ [ZipGrade] Se cargaron ${availableSheets.length} plantillas disponibles.`);
        } catch (err) {
            console.error("❌ [ZipGrade] Error cargando plantillas:", err);
        }
    }

    function getStorageKey() {
        const session = document.getElementById('zg-global-session')?.value || 'S1';
        return STORAGE_KEY_MAPPINGS + '_' + session;
    }

    // Persistencia local por sesión
    function saveMappingsToStorage() {
        try {
            const selects = Array.from(document.querySelectorAll('.zg-row-sheet'));
            const mappings = {};
            selects.forEach(s => {
                if (s.value) mappings[s.dataset.className] = s.value;
            });
            localStorage.setItem(getStorageKey(), JSON.stringify(mappings));
        } catch (e) {
            console.warn("No se pudo guardar la configuración en localStorage", e);
        }
    }

    function loadSavedMappingsFromStorage() {
        try {
            // Limpiar selecciones actuales primero
            const allChecks = document.querySelectorAll('.zg-row-check');
            allChecks.forEach(chk => chk.checked = false);
            const allSelects = document.querySelectorAll('.zg-row-sheet');
            allSelects.forEach(s => s.value = '');

            const raw = localStorage.getItem(getStorageKey());
            if (!raw) {
                updateSelectedCounter();
                return;
            }
            const mappings = JSON.parse(raw);
            const selects = Array.from(document.querySelectorAll('.zg-row-sheet'));
            selects.forEach(s => {
                const name = s.dataset.className;
                if (mappings[name]) {
                    s.value = mappings[name];
                    const chk = s.closest('td')?.querySelector('.zg-row-check');
                    if (chk) chk.checked = true;
                }
            });
            updateSelectedCounter();
        } catch (e) {
            console.warn("No se pudieron cargar selecciones guardadas", e);
        }
    }

    function updateSelectedCounter() {
        const checkedCount = document.querySelectorAll('.zg-row-check:checked').length;
        const totalCount = document.querySelectorAll('.zg-row-check').length;
        const counterEl = document.getElementById('zg-counter-badge');
        if (counterEl) {
            counterEl.innerText = `${checkedCount} de ${totalCount} marcados`;
            counterEl.style.background = checkedCount > 0 ? '#2563eb' : 'rgba(255,255,255,0.25)';
            counterEl.style.color = '#ffffff';
        }
    }

    // ==========================================
    // 5. SELECCIONAR MOSTRAR TODAS LAS ENTRADAS ("Show entries" -> "All")
    // ==========================================
    function ensureAllEntriesShown() {
        console.log("🔍 [ZipGrade] Ajustando 'Show entries' a 'All'...");

        // 1. Vía jQuery DataTables API si existe
        if (typeof window.jQuery !== 'undefined' && window.jQuery.fn && window.jQuery.fn.dataTable) {
            try {
                window.jQuery('table').each(function () {
                    if (window.jQuery.fn.DataTable.isDataTable(this)) {
                        window.jQuery(this).DataTable().page.len(-1).draw();
                    }
                });
            } catch (e) {
                console.warn("No se pudo ajustar límite via jQuery DataTables API:", e);
            }
        }

        // 2. Vía DOM en los desplegables de DataTables (_length)
        const lengthSelects = document.querySelectorAll('select[name*="_length"], .dataTables_length select, select[name*="length"]');
        lengthSelects.forEach(select => {
            let allOption = Array.from(select.options).find(opt =>
                opt.value === '-1' ||
                opt.value === 'all' ||
                opt.text.toLowerCase().includes('all') ||
                opt.text.toLowerCase().includes('todo')
            );

            if (!allOption) {
                allOption = document.createElement('option');
                allOption.value = '-1';
                allOption.innerText = 'All';
                select.appendChild(allOption);
            }

            if (select.value !== allOption.value) {
                select.value = allOption.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                console.log(`✅ [ZipGrade] 'Show entries' cambiado a 'All' (${allOption.value}).`);
            }
        });
    }

    // ==========================================
    // 6. INICIALIZAR EN /STUDENTS/ (ORDENAR TABLA DE ESTUDIANTES POR GRADO Y CÓDIGO MENOR A MAYOR)
    // ==========================================
    function getStudentGradeWeight(row) {
        const table = row.closest('table');
        let classColIdx = -1;
        if (table) {
            const ths = Array.from(table.querySelectorAll('thead th'));
            classColIdx = ths.findIndex(th => th.innerText.toLowerCase().includes('class'));
        }

        let text = '';
        if (classColIdx !== -1 && row.cells[classColIdx]) {
            text = row.cells[classColIdx].innerText;
        } else {
            const cell = row.querySelector('td:nth-child(6)');
            if (cell) text = cell.innerText;
        }

        if (!text || !text.trim() || text.trim() === '-') return 99999;

        const parts = text.split(/[,;\n]+/);
        let minWeight = 99999;
        for (const part of parts) {
            const w = extractGradeWeight(part);
            if (w < minWeight) minWeight = w;
        }
        return minWeight;
    }

    function getStudentId(row) {
        const table = row.closest('table');
        let idColIdx = -1;
        if (table) {
            const ths = Array.from(table.querySelectorAll('thead th'));
            idColIdx = ths.findIndex(th => {
                const txt = th.innerText.toLowerCase();
                return txt.includes('student id') || (txt.includes('id') && !txt.includes('external'));
            });
        }

        let text = '';
        if (idColIdx !== -1 && row.cells[idColIdx]) {
            text = row.cells[idColIdx].innerText;
        } else {
            const cell = row.querySelector('td:nth-child(2)');
            if (cell) text = cell.innerText;
        }

        const cleanText = text.trim();
        const num = parseInt(cleanText.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(num)) return num;
        return cleanText || 999999;
    }

    function sortStudentTable() {
        console.log("⚙️ [ZipGrade] Reorganizando la página /students/ por grado y código (menor a mayor)...");
        ensureAllEntriesShown();

        const table = document.getElementById('studentTable');
        if (!table) return;

        const mainCol = table.closest('.col-md-8') || table.closest('.col-md-9') || table.closest('.col-md-12') || table.parentElement;
        if (mainCol) {
            mainCol.style.width = '100%';
            mainCol.style.marginLeft = '0';
        }

        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        let rows = Array.from(tbody.querySelectorAll('tr'));
        if (rows.length === 0) return;

        rows.sort((a, b) => {
            const gradeA = getStudentGradeWeight(a);
            const gradeB = getStudentGradeWeight(b);
            if (gradeA !== gradeB) return gradeA - gradeB;

            const idA = getStudentId(a);
            const idB = getStudentId(b);
            if (typeof idA === 'number' && typeof idB === 'number') {
                return idA - idB;
            }
            return String(idA).localeCompare(String(idB), undefined, { numeric: true, sensitivity: 'base' });
        });

        const fragment = document.createDocumentFragment();
        rows.forEach(row => fragment.appendChild(row));
        tbody.appendChild(fragment);

        // Actualizar el estado interno de DataTables si existe para preservar nuestro orden
        if (typeof window.jQuery !== 'undefined' && window.jQuery.fn && window.jQuery.fn.DataTable) {
            try {
                if (window.jQuery.fn.DataTable.isDataTable(table)) {
                    const dt = window.jQuery(table).DataTable();
                    dt.order([]); // Desactivar ordenación interna de DataTables
                    dt.rows().invalidate('dom');
                    dt.draw(false);
                    console.log("✅ [ZipGrade] DataTables re-sincronizado con el orden por Grado + Código.");
                }
            } catch (e) {
                console.warn("No se pudo actualizar DataTables:", e);
            }
        }

        console.log(`✅ [ZipGrade] ${rows.length} filas reorganizadas por grado + código (menor a mayor) en /students/.`);
    }

    function initStudentsPage() {
        sortStudentTable();
        // Re-verificar tras renderizado dinámico de DataTables
        setTimeout(sortStudentTable, 400);
        setTimeout(sortStudentTable, 1000);
    }

    // ==========================================
    // 7. INICIALIZAR EN /CLASSES/ (INTERFAZ COMPLETA DOWLOADER ZIP)
    // ==========================================
    async function initUI() {
        console.log("⚙️ [ZipGrade] Inicializando interfaz y ordenando cursos...");
        ensureAllEntriesShown();

        const table = document.getElementById('subjectTable');
        if (!table) return;

        try {
            await fetchSheets();

            const mainCol = table.closest('.col-md-8') || table.parentElement;
            if (mainCol) {
                mainCol.style.width = '100%';
                mainCol.style.marginLeft = '0';
            }

            const tbody = table.querySelector('tbody');
            let rows = Array.from(tbody.querySelectorAll('tr'));

            rows.sort((a, b) => {
                const weightA = getAcademicWeight(a);
                const weightB = getAcademicWeight(b);
                if (weightA !== weightB) return weightA - weightB;

                const nameElA = a.querySelector('td:nth-child(2)');
                const nameElB = b.querySelector('td:nth-child(2)');
                const nameA = nameElA ? nameElA.innerText.trim() : '';
                const nameB = nameElB ? nameElB.innerText.trim() : '';
                return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
            });
            rows.forEach(row => tbody.appendChild(row));

            // Cabecera
            const theadRow = table.querySelector('thead tr');
            if (theadRow && !theadRow.querySelector('.zg-custom-th')) {
                const newTh = document.createElement('th');
                newTh.className = 'text-center zg-custom-th';
                newTh.style.cssText = 'vertical-align:middle; width:220px; color:#ffffff;';
                newTh.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; gap:3px;">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <input type="checkbox" id="zg-master-check" title="Seleccionar/Deseleccionar todos" style="margin:0; cursor:pointer; width:16px; height:16px;" />
                            <span style="font-weight:700; font-size:12px; color:#ffffff;">Descarga Rápida</span>
                        </div>
                        <span id="zg-counter-badge" style="font-size:10px; padding:2px 8px; border-radius:10px; background:rgba(255,255,255,0.25); color:#ffffff; font-weight:600;">
                            0 marcados
                        </span>
                    </div>
                `;
                theadRow.appendChild(newTh);
            }

            // Barra superior Dashboard
            if (!document.getElementById('zg-top-bar')) {
                const topBar = document.createElement('div');
                topBar.id = 'zg-top-bar';
                topBar.style.cssText = `
                    display: flex; flex-direction: column; gap: 12px;
                    background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;
                    padding: 16px 20px; margin: 0 auto 18px auto; width: 100%;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.06); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                `;
                topBar.innerHTML = `
                    <!-- Fila 1: Controles de Selección y Asignación -->
                    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; border-bottom:1px solid #f1f5f9; padding-bottom:10px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-weight:700; font-size:14px; color:#1e293b; display:flex; align-items:center; gap:6px;">
                                <i class="fa fa-cogs"></i> ZipGrade Toolkit <small style="font-size:11px; font-weight:normal; color:#64748b;">v${(typeof GM !== 'undefined' && GM.info?.script?.version) || (typeof GM_info !== 'undefined' && GM_info?.script?.version) || '24.7'}</small>
                            </span>
                            <button id="zg-btn-select-all" class="btn btn-default btn-xs" style="font-size:11px; font-weight:600; border-radius:4px;">
                                <i class="fa fa-check-square-o"></i> Seleccionar Todo
                            </button>
                            <button id="zg-btn-deselect-all" class="btn btn-default btn-xs" style="font-size:11px; font-weight:600; border-radius:4px;">
                                <i class="fa fa-square-o"></i> Deseleccionar Todo
                            </button>
                        </div>

                        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <label style="font-weight:600; font-size:12px; color:#334155; margin:0;">Sesión:</label>
                                <select id="zg-global-session" style="padding:4px 8px; font-size:12px; border-radius:6px; border:1px solid #cbd5e1; outline:none; background:#fff; cursor:pointer;">
                                    <option value="S1">S1</option>
                                    <option value="S2">S2</option>
                                </select>
                            </div>

                            <div style="display:flex; align-items:center; gap:6px; border-left: 1px solid #e2e8f0; padding-left:12px;">
                                <label style="font-weight:600; font-size:12px; color:#334155; margin:0;">Asignación Masiva:</label>
                                <select id="zg-bulk-apply-sheet" style="padding:4px 8px; font-size:12px; border-radius:6px; border:1px solid #cbd5e1; outline:none; background:#fff; max-width:180px; cursor:pointer;">
                                    <option value="">-- Seleccionar Hoja --</option>
                                    ${availableSheets.map(s => `<option value="${s}">${s}</option>`).join('')}
                                </select>
                                <button id="zg-btn-apply-checked" class="btn btn-primary btn-xs" style="font-size:11px; font-weight:600; border-radius:4px; padding:4px 10px;">
                                    <i class="fa fa-check"></i> Aplicar a Marcados
                                </button>
                            </div>

                            <div style="display:flex; align-items:center; gap:6px; border-left: 1px solid #e2e8f0; padding-left:12px;">
                                <button id="zg-btn-export-json" class="btn btn-default btn-xs" style="font-size:11px; border-radius:4px;" title="Exportar asignaciones a JSON">
                                    <i class="fa fa-upload"></i> Exportar Config
                                </button>
                                <label id="zg-label-import-json" class="btn btn-default btn-xs" style="font-size:11px; margin:0; cursor:pointer; font-weight:normal; border-radius:4px;" title="Cargar asignaciones desde JSON">
                                    <i class="fa fa-download"></i> Importar Config
                                    <input type="file" id="zg-file-input" accept=".json" style="display:none;" />
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- Fila 2: Acciones Principales y Botón Detener -->
                    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <button id="zg-btn-download-selected" style="background:#2563eb; color:#ffffff; border:none; padding:8px 22px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 4px rgba(37,99,235,0.2); transition:all 0.2s;">
                                <i class="fa fa-download"></i> Descargar PDFs
                            </button>
                            <button id="zg-btn-stop-download" style="display:none; background:#ef4444; color:#ffffff; border:none; padding:8px 16px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; transition:all 0.2s;">
                                <i class="fa fa-stop-circle"></i> Detener
                            </button>
                        </div>
                        <div id="zg-status-text" style="font-size:12px; color:#475569; font-weight:500;">
                            <i class="fa fa-info-circle"></i> Listo para procesar.
                        </div>
                    </div>

                    <!-- Fila 3: Contenedor de Barra de Progreso -->
                    <div id="zg-progress-container" style="display:none; flex-direction:column; gap:4px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 14px;">
                        <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:600; color:#334155;">
                            <span id="zg-progress-title">Procesando lote...</span>
                            <span id="zg-progress-percent">0%</span>
                        </div>
                        <div style="width:100%; background:#cbd5e1; height:8px; border-radius:4px; overflow:hidden;">
                            <div id="zg-progress-bar" style="width:0%; background:#2563eb; height:100%; transition:width 0.3s ease;"></div>
                        </div>
                    </div>

                    <!-- Fila 4: Banner de descarga completada -->
                    <div id="zg-download-banner" style="display:none; background:#ecfdf5; border:1px solid #10b981; border-radius:8px; padding:10px 16px; align-items:center; justify-content:space-between; color:#065f46;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <i class="fa fa-check-circle" style="font-size:20px; color:#10b981;"></i>
                            <div>
                                <strong style="font-size:13px; display:block;">¡Descargas completadas!</strong>
                                <span style="font-size:11px; opacity:0.9;">Los PDFs se han descargado individualmente a tu carpeta de descargas.</span>
                            </div>
                        </div>
                    </div>
                `;
                table.parentNode.insertBefore(topBar, table);
            }

            // Filas de Cursos
            rows.forEach(row => {
                if (row.querySelector('.zg-custom-td')) return;

                const nameEl = row.querySelector('td:nth-child(2) h4');
                const countEl = row.querySelector('td:nth-child(4) h4');
                const downloadLinkEl = row.querySelector('a[href*="/answerSheetPacks/"]');
                const studentCount = countEl ? parseInt(countEl.innerText.trim(), 10) || 0 : 0;

                if (nameEl && downloadLinkEl && studentCount > 0) {
                    const className = nameEl.innerText.trim();
                    const href = downloadLinkEl.getAttribute('href');
                    const idMatch = href.match(/\/classes\/([^\/]+)\//);

                    if (idMatch) {
                        const classId = idMatch[1];
                        const td = document.createElement('td');
                        td.className = 'zg-custom-td';
                        td.style.cssText = 'vertical-align:middle; text-align:center; white-space:nowrap;';

                        td.innerHTML = `
                            <div style="display:inline-flex; gap:6px; align-items:center; justify-content:center;">
                                <input type="checkbox" class="zg-row-check" data-class-id="${classId}" style="margin:0; cursor:pointer; width:15px; height:15px;" />
                                <select class="zg-row-sheet" data-class-id="${classId}" data-class-name="${className}" style="padding:4px 6px; font-size:11px; border-radius:6px; border:1px solid #cbd5e1; max-width:160px; background:#fff; cursor:pointer;">
                                    <option value="">-- Seleccionar --</option>
                                    ${availableSheets.map(s => `<option value="${s}">${s}</option>`).join('')}
                                </select>
                                <button class="zg-btn-row-download btn btn-default btn-xs" style="padding:3px 8px;" title="Descargar PDF individual">
                                    <span class="glyphicon glyphicon-download-alt"></span>
                                </button>
                            </div>
                        `;

                        row.appendChild(td);

                        // Evento checkbox individual
                        const chk = td.querySelector('.zg-row-check');
                        chk.addEventListener('change', () => {
                            updateSelectedCounter();
                            saveMappingsToStorage();
                        });

                        // Evento cambio de plantilla
                        const rowSelect = td.querySelector('.zg-row-sheet');
                        rowSelect.addEventListener('change', () => {
                            if (rowSelect.value) {
                                chk.checked = true;
                            }
                            updateSelectedCounter();
                            saveMappingsToStorage();
                        });

                        // Descarga Individual
                        td.querySelector('.zg-btn-row-download').addEventListener('click', async (e) => {
                            e.preventDefault();
                            const select = td.querySelector('.zg-row-sheet');
                            if (!select.value) {
                                alert('Selecciona una plantilla para este curso primero.');
                                return;
                            }
                            const session = document.getElementById('zg-global-session').value;
                            const btn = e.currentTarget;
                            btn.disabled = true;
                            btn.style.opacity = '0.5';

                            console.log(`▶️ [Individual] Descargando ${className}...`);
                            updateStatusText(`Descargando individual: ${className}...`);
                            const t0 = Date.now();

                            const pdfBlob = await processSingleDownloadWithRetry(classId, className, select.value, session);
                            const elapsed = Math.round((Date.now() - t0) / 1000);
                            if (pdfBlob) {
                                const filename = `${className}_${session}.pdf`;
                                downloadBlob(pdfBlob, filename);
                                updateStatusText(`✅ ${filename} descargado en ${elapsed}s`);
                            } else {
                                alert(`No se pudo descargar el PDF de ${className}. Revisa la consola o intenta nuevamente.`);
                                updateStatusText(`❌ Error al descargar ${className} (${elapsed}s)`);
                            }

                            btn.disabled = false;
                            btn.style.opacity = '1';
                        });
                    }
                } else {
                    const emptyTd = document.createElement('td');
                    emptyTd.className = 'zg-custom-td';
                    emptyTd.style.cssText = 'vertical-align:middle; text-align:center; color:#94a3b8; font-size:11px;';
                    emptyTd.innerText = studentCount === 0 ? 'Sin estudiantes' : '-';
                    row.appendChild(emptyTd);
                }
            });

            // Cargar selecciones previas guardadas en localStorage
            loadSavedMappingsFromStorage();

            // Persistir selector de sesión en localStorage y recargar asignaciones
            const sessionSelect = document.getElementById('zg-global-session');
            const savedSession = localStorage.getItem('zipgrade_toolkit_session');
            if (savedSession && sessionSelect) {
                sessionSelect.value = savedSession;
            }
            if (sessionSelect) {
                sessionSelect.addEventListener('change', () => {
                    localStorage.setItem('zipgrade_toolkit_session', sessionSelect.value);
                    loadSavedMappingsFromStorage();
                });
            }

            // Controles de Selección
            const setAllChecks = (state) => {
                const checks = document.querySelectorAll('.zg-row-check');
                checks.forEach(chk => chk.checked = state);
                const masterChk = document.getElementById('zg-master-check');
                if (masterChk) masterChk.checked = state;
                updateSelectedCounter();
                saveMappingsToStorage();
            };

            document.getElementById('zg-btn-select-all').addEventListener('click', (e) => {
                e.preventDefault();
                setAllChecks(true);
            });

            document.getElementById('zg-btn-deselect-all').addEventListener('click', (e) => {
                e.preventDefault();
                setAllChecks(false);
            });

            const masterChkEl = document.getElementById('zg-master-check');
            if (masterChkEl) {
                masterChkEl.addEventListener('change', (e) => {
                    setAllChecks(e.target.checked);
                });
            }

            document.getElementById('zg-btn-apply-checked').addEventListener('click', (e) => {
                e.preventDefault();
                const selectedSheet = document.getElementById('zg-bulk-apply-sheet').value;
                if (!selectedSheet) {
                    alert('Selecciona una hoja del menú para aplicar.');
                    return;
                }
                const checkedRows = document.querySelectorAll('.zg-row-check:checked');
                if (checkedRows.length === 0) {
                    alert('Marca al menos una casilla en la tabla.');
                    return;
                }
                checkedRows.forEach(chk => {
                    const rowSelect = chk.closest('td').querySelector('.zg-row-sheet');
                    if (rowSelect) rowSelect.value = selectedSheet;
                });
                saveMappingsToStorage();
                alert(`¡Se aplicó "${selectedSheet}" a ${checkedRows.length} cursos!`);
            });

            // Listeners JSON
            document.getElementById('zg-btn-export-json').addEventListener('click', (e) => {
                e.preventDefault();
                exportConfigJSON();
            });

            document.getElementById('zg-file-input').addEventListener('change', importConfigJSON);

            // Listener Descarga Lote
            document.getElementById('zg-btn-download-selected').addEventListener('click', downloadSelectedAsZip);

            // Listener Detener
            document.getElementById('zg-btn-stop-download').addEventListener('click', (e) => {
                e.preventDefault();
                cancelDownloadRequested = true;
                console.warn("🛑 [ZipGrade] Cancelación solicitada por el usuario.");
                const btnStop = e.currentTarget;
                btnStop.innerText = 'Deteniendo...';
                btnStop.disabled = true;
            });

            console.log("✅ [ZipGrade] UI lista para usar.");
        } catch (e) {
            console.error("❌ [ZipGrade] Error inicializando UI:", e);
        }
    }

    function updateStatusText(msg) {
        const el = document.getElementById('zg-status-text');
        if (el) el.innerText = msg;
    }

    function setProgressBar(percent, title = "Procesando...") {
        const container = document.getElementById('zg-progress-container');
        const titleEl = document.getElementById('zg-progress-title');
        const percentEl = document.getElementById('zg-progress-percent');
        const barEl = document.getElementById('zg-progress-bar');

        if (container && titleEl && percentEl && barEl) {
            container.style.display = 'flex';
            titleEl.innerText = title;
            percentEl.innerText = `${Math.round(percent)}%`;
            barEl.style.width = `${Math.min(100, Math.max(0, percent))}%`;
        }
    }

    function hideProgressBar() {
        const container = document.getElementById('zg-progress-container');
        if (container) container.style.display = 'none';
    }

    // Descarga simple de un blob (para PDFs individuales o JSON)
    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            if (link.parentNode) link.parentNode.removeChild(link);
            URL.revokeObjectURL(url);
        }, 60000);
    }



    // ==========================================
    // 7. FUNCIONES DE IMPORTAR / EXPORTAR JSON
    // ==========================================
    function exportConfigJSON() {
        const session = document.getElementById('zg-global-session').value;
        const selects = Array.from(document.querySelectorAll('.zg-row-sheet'));

        const configData = { session: session, mappings: {} };
        selects.forEach(s => {
            if (s.value) {
                configData.mappings[s.dataset.className] = s.value;
            }
        });

        const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
        downloadBlob(blob, `config_zipgrade_${session}.json`);
    }

    function importConfigJSON(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const configData = JSON.parse(e.target.result);
                if (configData.session) {
                    document.getElementById('zg-global-session').value = configData.session;
                }
                if (configData.mappings) {
                    const selects = Array.from(document.querySelectorAll('.zg-row-sheet'));
                    selects.forEach(s => {
                        const courseName = s.dataset.className;
                        if (configData.mappings[courseName]) {
                            s.value = configData.mappings[courseName];
                            const chk = s.closest('td')?.querySelector('.zg-row-check');
                            if (chk) chk.checked = true;
                        }
                    });
                    updateSelectedCounter();
                    saveMappingsToStorage();
                    alert('¡Configuración cargada correctamente desde el JSON!');
                }
            } catch (err) {
                alert('Error al leer el archivo JSON.');
                console.error(err);
            }
        };
        reader.readAsText(file);
    }

    // ==========================================
    // 8. DESCARGA INDIVIDUAL DE PDFs
    // ==========================================
    async function downloadSelectedAsZip() {
        const session = document.getElementById('zg-global-session').value;
        const checkedBoxes = Array.from(document.querySelectorAll('.zg-row-check:checked'));
        const queue = [];

        checkedBoxes.forEach(chk => {
            const select = chk.closest('td').querySelector('.zg-row-sheet');
            if (select && select.value) {
                queue.push({
                    classId: select.dataset.classId,
                    className: select.dataset.className,
                    sheetName: select.value
                });
            }
        });

        if (queue.length === 0) {
            alert('Marca los cursos con el checkbox y asegúrate de que tengan una plantilla seleccionada en la columna.');
            return;
        }

        console.log(`🚀 [ZipGrade] Descargando ${queue.length} PDFs individualmente (Sesión ${session})...`);
        const btnDownload = document.getElementById('zg-btn-download-selected');
        const btnStop = document.getElementById('zg-btn-stop-download');
        const bannerEl = document.getElementById('zg-download-banner');

        if (bannerEl) bannerEl.style.display = 'none';

        cancelDownloadRequested = false;
        btnDownload.disabled = true;

        if (btnStop) {
            btnStop.style.display = 'inline-block';
            btnStop.disabled = false;
            btnStop.innerText = '🛑 Detener';
        }

        let successCount = 0;
        let consecutiveErrors = 0;
        const startTime = Date.now();
        let totalCoolingTime = 0;

        for (let i = 0; i < queue.length; i++) {
            if (cancelDownloadRequested) {
                console.warn('🛑 [ZipGrade] Proceso interrumpido por el usuario.');
                updateStatusText('Proceso detenido.');
                alert('Proceso detenido.');
                break;
            }

            const item = queue[i];
            const currentNum = i + 1;
            const progressPercent = (i / queue.length) * 90;

            console.log(`--------------------------------------------------`);
            console.log(`📄 [${currentNum}/${queue.length}] Curso: ${item.className}`);

            setProgressBar(progressPercent, `Descargando PDF ${currentNum}/${queue.length}: ${item.className}`);
            updateStatusText(`Descargando ${currentNum}/${queue.length}: ${item.className}...`);
            btnDownload.innerText = `PDF ${currentNum}/${queue.length}: ${item.className}...`;

            const pdfBlob = await processSingleDownloadWithRetry(item.classId, item.className, item.sheetName, session, currentNum, queue.length);

            if (pdfBlob) {
                const filename = `${item.className}_${session}.pdf`;
                downloadBlob(pdfBlob, filename);
                console.log(`📥 PDF de ${item.className} descargado.`);
                successCount++;
                consecutiveErrors = 0;
                await new Promise(r => setTimeout(r, 2000));
            } else {
                console.error(`❌ No se pudo obtener PDF para "${item.className}". Omitido.`);
                updateStatusText(`⚠️ "${item.className}" omitido — sin PDF`);
                consecutiveErrors++;
            }

            // Pausa entre descargas + enfriamiento cada 5 (límite de velocidad ZipGrade)
            if (i < queue.length - 1 && !cancelDownloadRequested) {
                let pause = 3500;

                if (successCount > 0 && successCount % 5 === 0 && consecutiveErrors === 0) {
                    const coolingTime = 20000;
                    totalCoolingTime += coolingTime;
                    console.log(`⏳ Enfriando ${coolingTime/1000}s tras ${successCount} descargas (límite ZipGrade)...`);
                    updateStatusText(`⏳ Pausa de ${coolingTime/1000}s para evitar bloqueo del servidor...`);
                    await new Promise(r => setTimeout(r, coolingTime));
                }

                if (consecutiveErrors > 0) {
                    pause = Math.min(10000, pause + (consecutiveErrors * 3000));
                    console.warn(`⏱️ ${consecutiveErrors} error(es) — pausa extendida a ${pause/1000}s`);
                }
                console.log(`⏱️ Pausa de ${pause/1000}s...`);
                await new Promise(r => setTimeout(r, pause));
            }
        }

        hideProgressBar();

        if (btnStop) {
            btnStop.style.display = 'none';
        }

        if (successCount > 0 && !cancelDownloadRequested) {
            const totalTime = Math.round((Date.now() - startTime) / 1000);
            const minutes = Math.floor(totalTime / 60);
            const secs = totalTime % 60;
            const coolingSecs = Math.round(totalCoolingTime / 1000);
            const timeStr = minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
            const summary = coolingSecs > 0
                ? `✅ ${successCount} de ${queue.length} PDFs en ${timeStr} (${coolingSecs}s de espera por rate limit)`
                : `✅ ${successCount} de ${queue.length} PDFs en ${timeStr}`;

            setProgressBar(100, summary);
            updateStatusText(summary);
            console.log(`🎉 [ZipGrade] ${summary}`);
            if (bannerEl) {
                const msgEl = bannerEl.querySelector('strong') || bannerEl.querySelector('div span');
                if (msgEl) msgEl.textContent = summary;
                bannerEl.style.display = 'flex';
            }
        } else if (!cancelDownloadRequested) {
            console.error("❌ No se pudo obtener ningún PDF.");
            updateStatusText('❌ Error: No se pudo obtener ningún PDF.');
            alert('No se pudo obtener ningún PDF. Revisa tu conexión o las plantillas seleccionadas.');
        }

        btnDownload.innerText = '📄 Descargar PDFs';
        btnDownload.disabled = false;
    }

    // Reintentos automáticos con Backoff Adaptativo y recuperación de límite de velocidad
    // ZipGrade bloquea tras ~5 PDFs/ventana; la ventana dura ~60s — esperar suficiente antes de reintentar
    async function processSingleDownloadWithRetry(classId, className, sheetName, session, currentIdx = 1, totalIdx = 1, maxRetries = 4) {
        // Pausas de recuperación para RATE_LIMIT_HTML: 30s, 45s, 60s
        const rateLimitDelays = [30000, 45000, 60000];
        // Pausas para errores genéricos de red/timeout
        const networkDelays = [8000, 12000, 18000];
        const timeouts = [45000, 60000, 90000, 90000];

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            if (cancelDownloadRequested) return null;

            const timeoutForAttempt = timeouts[attempt - 1] || 90000;
            console.log(`🔄 Obteniendo ${className} (Intento ${attempt}/${maxRetries}, Timeout: ${timeoutForAttempt / 1000}s)...`);

            if (attempt > 1) {
                updateStatusText(`Reintentando ${currentIdx}/${totalIdx}: ${className} (Intento ${attempt}/${maxRetries})...`);
            }

            let result;
            try {
                result = await processSingleDownloadToZip(classId, className, sheetName, session, timeoutForAttempt);
            } catch (err) {
                // Solo SESSION y SHEET son irrecuperables
                if (err.code === 'PERMANENT_FAILURE_SESSION' || err.code === 'PERMANENT_FAILURE_SHEET') {
                    console.warn(`⏭️ Error irrecuperable en ${className}: ${err.code}. Omitiendo.`);
                    updateStatusText(`⏭️ ${className} omitido (${err.code})`);
                    return null;
                }
                // Error de red/timeout — reintentable
                console.warn(`⚠️ Error de red en intento ${attempt}/${maxRetries} para ${className}: ${err.message}`);
                result = null;
            }

            // Éxito: retornar blob válido
            if (result instanceof Blob) return result;

            // Resultado con código de error
            if (result && result.code) {
                if (result.code === 'PERMANENT_FAILURE_SESSION') {
                    console.warn(`⏭️ Sesión expirada para ${className}. Omitiendo.`);
                    return null;
                }

                // RATE_LIMIT_HTML: ZipGrade bloqueó la petición — esperar la ventana completa (~60s)
                const waitTime = rateLimitDelays[Math.min(attempt - 1, rateLimitDelays.length - 1)];
                console.warn(`⏳ Servidor bloqueado (${result.code}) en intento ${attempt}/${maxRetries} para ${className}. Esperando ${waitTime / 1000}s para que ZipGrade libere la ventana de velocidad...`);
                updateStatusText(`⏳ Espera ${waitTime / 1000}s — ZipGrade bloqueó temporalmente (${attempt}/${maxRetries}) para ${className}`);
                if (!cancelDownloadRequested) await new Promise(r => setTimeout(r, waitTime));
                continue;
            }

            // null — error genérico reintentable
            if (attempt < maxRetries && !cancelDownloadRequested) {
                const waitTime = networkDelays[Math.min(attempt - 1, networkDelays.length - 1)];
                console.warn(`⚠️ Sin PDF en intento ${attempt}/${maxRetries} para ${className}. Reintentando en ${waitTime / 1000}s...`);
                await new Promise(r => setTimeout(r, waitTime));
            }
        }

        console.error(`❌ Todos los intentos agotados para ${className}. Omitido.`);
        return null;
    }

    function extractCSRFToken(doc) {
        // Probar múltiples selectores comunes de CSRF token
        const selectores = [
            'input[name="csrf_token"]',
            'input[name="csrfmiddlewaretoken"]',
            'input[name="_token"]',
            'input[name="authenticity_token"]',
            'meta[name="csrf-token"]',
            'input[name="csrf"]'
        ];
        for (const sel of selectores) {
            const el = doc.querySelector(sel);
            if (el) {
                const val = el.getAttribute('content') || el.value;
                if (val) return val;
            }
        }
        return '';
    }

    async function processSingleDownloadToZip(classId, className, sheetName, session, timeoutMs = 45000) {
        if (cancelDownloadRequested) return null;

        const targetUrl = `https://www.zipgrade.com/classes/${classId}/answerSheetPacks/`;

        try {
            const res = await customRequest({
                method: "GET",
                url: targetUrl
            }, timeoutMs);

            if (res.status !== 200) return null;

            const doc = new DOMParser().parseFromString(res.responseText, "text/html");
            const csrfToken = extractCSRFToken(doc);
            const buttons = Array.from(doc.querySelectorAll('button[name="customSheet"]'));

            // Detectar si la sesión expiró (página de login)
            if (doc.querySelector('input[name="login"]') || doc.querySelector('form[action*="login"]') || !csrfToken) {
                console.warn(`⚠️ Sesión expirada o no autenticado al acceder a ${className}.`);
                if (!csrfToken) {
                    // Log para depuración: mostrar parte del HTML recibido
                    const preview = res.responseText?.substring(0, 300) || '(sin contenido)';
                    console.warn(`🔍 HTML recibido (inicio): ${preview}`);
                }
                const err = new Error(`PERMANENT_FAILURE_SESSION`);
                err.code = 'PERMANENT_FAILURE_SESSION';
                err.className = className;
                throw err;
            }

            const cleanTargetSheet = sheetName.trim().toLowerCase();

            // Estrategia de búsqueda flexible por capas:
            // Capa 1: Coincidencia de nombre + "1 per page" / "1 por página"
            let targetBtn = buttons.find(b => {
                const text = b.innerText.replace(/\s+/g, ' ').trim().toLowerCase();
                return text.includes(cleanTargetSheet) && (text.includes('1 per page') || text.includes('1 por página'));
            });

            // Capa 2: Coincidencia exacta del nombre de plantilla en el texto del botón
            if (!targetBtn) {
                targetBtn = buttons.find(b => {
                    const text = b.innerText.replace(/\s+/g, ' ').trim().toLowerCase();
                    return text.includes(cleanTargetSheet);
                });
            }

            // Capa 3: Coincidencia por valor o atributo
            if (!targetBtn) {
                targetBtn = buttons.find(b => {
                    const val = (b.value || '').toLowerCase();
                    return val.includes(cleanTargetSheet);
                });
            }

            if (targetBtn && csrfToken) {
                const form = targetBtn.closest('form');
                const extraFields = {};
                let formActionUrl = targetUrl;
                if (form && form.getAttribute('action')) {
                    formActionUrl = new URL(form.getAttribute('action'), targetUrl).href;
                }
                if (form) {
                    const inputs = form.querySelectorAll('input, select, textarea');
                    inputs.forEach(inp => {
                        if (inp.name && inp.name !== 'customSheet' && inp.value !== undefined && !inp.disabled) {
                            extraFields[inp.name] = inp.value;
                        }
                    });
                }

                let result = await fetchPDFBlob(formActionUrl, targetUrl, targetBtn.value, csrfToken, className, timeoutMs, extraFields, targetBtn.name || 'customSheet');

                // Si el primer intento devolvió HTML (RATE_LIMIT_HTML), no lanzar excepción:
                // devolver el objeto directamente para que processSingleDownloadWithRetry reintente
                if (result && result.code) {
                    console.warn(`⚠️ [${className}] Servidor devolvió HTML en lugar de PDF (código: ${result.code}). Se reintentará desde el nivel superior.`);
                    return result; // NO throw — dejar que el reintento superior maneje esto
                }
                return result;
            } else {
                console.warn(`⚠️ Plantilla "${sheetName}" no hallada en los botones de ${className}`);
                const err = new Error(`PERMANENT_FAILURE_SHEET`);
                err.code = 'PERMANENT_FAILURE_SHEET';
                err.className = className;
                throw err;
            }
        } catch (err) {
            if (err.code === 'PERMANENT_FAILURE_SESSION' || err.code === 'PERMANENT_FAILURE_SHEET') {
                throw err;
            }
            console.error(`❌ Error leyendo página de ${className}:`, err);
            return null;
        }
    }

    async function fetchPDFBlob(postUrl, refererUrl, customSheetValue, csrfToken, className, timeoutMs = 60000, extraFields = {}, btnName = 'customSheet') {
        if (cancelDownloadRequested) return null;

        const formData = new URLSearchParams();
        formData.append(btnName, customSheetValue);
        if (!formData.has('csrf_token') && csrfToken) {
            formData.append('csrf_token', csrfToken);
        }
        for (const [key, val] of Object.entries(extraFields)) {
            if (!formData.has(key)) formData.append(key, val);
        }
        if (!formData.has('quizName')) formData.append('quizName', '');
        if (!formData.has('sortOrder')) formData.append('sortOrder', 'studentId');

        const bodyStr = formData.toString();

        // Intentar con fetch (credentials: 'include' para cookies de sesión)
        const result = await attemptFetchPDF(postUrl, bodyStr, refererUrl, className, timeoutMs);
        if (result === 'RETRY_GM') {
            // Fallback: GM_xmlhttpRequest
            console.warn(`🔄 Reintentando con GM_xmlhttpRequest para ${className}...`);
            return await attemptGMXHRPDF(postUrl, bodyStr, refererUrl, className, timeoutMs);
        }
        return result;
    }

    async function attemptFetchPDF(postUrl, bodyStr, refererUrl, className, timeoutMs) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const resp = await fetch(postUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Referer": refererUrl,
                    "Origin": "https://www.zipgrade.com"
                },
                body: bodyStr,
                credentials: 'include',
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!resp.ok) {
                console.warn(`⚠️ fetch HTTP ${resp.status} para ${className}`);
                return null;
            }

            const blob = await resp.blob();
            return validatePDFBlob(blob, className, resp.status);
        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                console.warn(`⚠️ fetch timeout (${timeoutMs/1000}s) para ${className}`);
                return 'RETRY_GM';
            }
            console.warn(`⚠️ fetch error para ${className}: ${err.message}`);
            return 'RETRY_GM';
        }
    }

    async function attemptGMXHRPDF(postUrl, bodyStr, refererUrl, className, timeoutMs) {
        return new Promise(resolve => {
            if (typeof GM_xmlhttpRequest === 'undefined') {
                resolve(null);
                return;
            }

            let settled = false;
            const timer = setTimeout(() => {
                if (!settled) { settled = true; resolve(null); }
            }, timeoutMs);

            GM_xmlhttpRequest({
                method: "POST",
                url: postUrl,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Referer": refererUrl,
                    "Origin": "https://www.zipgrade.com"
                },
                data: bodyStr,
                anonymous: false,
                responseType: 'blob',
                onload: async (res) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);

                    let blob = res.response;
                    if (blob instanceof ArrayBuffer) {
                        blob = new Blob([blob], { type: 'application/pdf' });
                    }
                    if (!(blob instanceof Blob) || blob.size === 0) {
                        resolve(null);
                        return;
                    }
                    const validated = await validatePDFBlob(blob, className, res.status);
                    resolve(validated);
                },
                onerror: () => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    resolve(null);
                },
                ontimeout: () => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    resolve(null);
                }
            });
        });
    }

    async function validatePDFBlob(blob, className, statusCode) {
        if (!(blob instanceof Blob) || blob.size === 0) return null;
        if (blob.size <= 500) {
            console.warn(`⚠️ PDF muy pequeño (${blob.size}B) para ${className}`);
            return null;
        }
        try {
            const headerText = await blob.slice(0, 50).text();
            if (headerText.startsWith("%PDF")) return blob;

            if (headerText.includes("<!DOCTYPE") || headerText.includes("<html")) {
                const fullPreview = await blob.slice(0, 1200).text();
                const titleMatch = fullPreview.match(/<title>([^<]*)<\/title>/i);
                const title = titleMatch ? titleMatch[1].trim() : '';

                if (title.toLowerCase().includes('login') || fullPreview.includes('name="login"')) {
                    console.warn(`⚠️ Sesión expirada al validar PDF para ${className}`);
                    return { code: 'PERMANENT_FAILURE_SESSION' };
                }

                console.warn(`⚠️ El servidor devolvió HTML (Título: "${title}") en lugar de PDF para ${className}. Posible límite de velocidad.`);
                return { code: 'RATE_LIMIT_HTML' };
            }
        } catch (e) { }
        return blob;
    }

    // Auto-inicialización según URL
    if (window.location.pathname.includes('/classes/')) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initUI);
        } else {
            initUI();
        }
    } else if (window.location.pathname.includes('/students/')) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initStudentsPage);
        } else {
            initStudentsPage();
        }
    }
})();