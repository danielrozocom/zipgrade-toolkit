// ==UserScript==
// @name         ZipGrade Toolkit
// @namespace    http://tampermonkey.net/
// @version      27.5
// @description  Empaqueta descargas en ZIP con selección de archivos nativa, gestión de timeouts, barra de progreso, descarga directa, recuperación automática de límites de velocidad y ordenación por grados y código en /classes/, /students/ y /quizzes/.
// @match        https://www.zipgrade.com/*
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

    // ==========================================
    // 1.1. ESTILOS COMPARTIDOS DEL TOOLKIT
    // ==========================================
    function injectSharedStyles() {
        if (document.getElementById('zg-shared-styles')) return;
        const style = document.createElement('style');
        style.id = 'zg-shared-styles';
        style.textContent = `
            .zg-counter-badge {
                font-size: 10px;
                padding: 2px 8px;
                border-radius: 10px;
                background: rgba(255,255,255,0.25);
                color: #ffffff;
                font-weight: 600;
                line-height: 1.4;
            }
            .zg-counter-badge.zg-badge-active {
                background: #2563eb;
                color: #ffffff;
            }
            .zg-counter-badge.zg-badge-on-light {
                background: #cbd5e1;
                color: #ffffff;
            }
            .zg-counter-badge.zg-badge-on-light.zg-badge-active {
                background: #2563eb;
                color: #ffffff;
            }
        `;
        document.head.appendChild(style);
    }
    injectSharedStyles();

    const SCRIPT_VERSION = (typeof GM !== 'undefined' && GM.info?.script?.version) || (typeof GM_info !== 'undefined' && GM_info?.script?.version) || '27.5';
    let availableSheets = [];
    let cancelDownloadRequested = false;
    const STORAGE_KEY_MAPPINGS = 'zipgrade_toolkit_saved_mappings';
    let hasSortedQuizzesInitially = false;

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
            counterEl.classList.toggle('zg-badge-active', checkedCount > 0);
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
    // 6.2. INICIALIZAR EN /QUIZZES/ (ORDENAR TABLA DE QUIZZES POR CURSO Y FECHA)
    // ==========================================
    function formatQuizDate(dateStr) {
        if (!dateStr) return dateStr;
        const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return dateStr;
        const [_, yearStr, monthStr, dayStr] = match;
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const day = parseInt(dayStr, 10);

        const dateObj = new Date(year, month - 1, day);
        if (isNaN(dateObj.getTime())) return dateStr;

        const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

        const dayName = daysOfWeek[dateObj.getDay()];
        const monthName = months[month - 1];

        return `${dayName} ${day}/${monthName}/${year}`;
    }

    function getQuizClassWeight(row) {
        const cell = row.cells[2];
        if (!cell) return 99999;
        const text = cell.innerText.trim();
        if (!text || text === '-') return 99999;
        return extractGradeWeight(text);
    }

    function getQuizDateValue(row) {
        const cell = row.cells[4];
        if (!cell) return 0;
        const dateStr = cell.dataset.originalDate || cell.innerText.trim();
        const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) {
            return parseInt(match[1] + match[2] + match[3], 10);
        }
        return 0;
    }

    function createQuizzesSortControls() {
        const tableWrapper = document.getElementById('quizTable_wrapper') || document.getElementById('quizTable');
        if (!tableWrapper) return;

        const savedMode = localStorage.getItem('zipgrade_toolkit_quiz_sort_mode') || 'date-class';

        // Card del toolkit (mismo estilo que en /classes/)
        let card = document.getElementById('zg-quiz-top-bar');
        if (!card) {
            card = document.createElement('div');
            card.id = 'zg-quiz-top-bar';
            card.style.cssText = `
                display: flex; flex-direction: column; gap: 12px;
                background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;
                padding: 16px 20px; margin: 0 auto 18px auto; width: 100%;
                box-shadow: 0 4px 12px rgba(0,0,0,0.06); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                box-sizing: border-box;
            `;
            card.innerHTML = `
                <!-- Fila 1: Título + Selección + Orden -->
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; border-bottom:1px solid #f1f5f9; padding-bottom:10px;">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <span style="font-weight:700; font-size:14px; color:#1e293b; display:flex; align-items:center; gap:6px;">
                            <i class="fa fa-cogs"></i> ZipGrade Toolkit <small style="font-size:11px; font-weight:normal; color:#64748b;">v${SCRIPT_VERSION}</small>
                        </span>
                        <button id="zg-quiz-btn-select-all" class="btn btn-default btn-xs" style="font-size:11px; font-weight:600; border-radius:4px;">
                            <i class="fa fa-check-square-o"></i> Seleccionar Todo
                        </button>
                        <button id="zg-quiz-btn-deselect-all" class="btn btn-default btn-xs" style="font-size:11px; font-weight:600; border-radius:4px;">
                            <i class="fa fa-square-o"></i> Deseleccionar Todo
                        </button>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-weight:600; color:#475569; font-size:13px;"><i class="fa fa-sort"></i> Modo de Orden:</span>
                        <div class="btn-group" style="margin:0;">
                            <button id="zg-sort-mode-date" type="button" class="btn btn-xs ${savedMode === 'date-class' ? 'btn-primary' : 'btn-default'}" style="font-weight:500;">
                                <i class="fa fa-calendar"></i> Fecha > Curso
                            </button>
                            <button id="zg-sort-mode-class" type="button" class="btn btn-xs ${savedMode === 'class-date' ? 'btn-primary' : 'btn-default'}" style="font-weight:500;">
                                <i class="fa fa-graduation-cap"></i> Curso > Fecha
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Fila 2: Acción principal + estado -->
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
                    <button id="zg-btn-quiz-download-selected" style="background:#2563eb; color:#ffffff; border:none; padding:8px 22px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 4px rgba(37,99,235,0.2); transition:all 0.2s;">
                        <i class="fa fa-download"></i> Descargar Resultados
                    </button>
                    <div id="zg-quiz-status-text" style="font-size:12px; color:#475569; font-weight:500;">
                        <i class="fa fa-info-circle"></i> Listo para procesar.
                    </div>
                </div>

                <!-- Fila 3: Barra de progreso -->
                <div id="zg-quiz-progress-container" style="display:none; flex-direction:column; gap:4px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 14px;">
                    <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:600; color:#334155;">
                        <span id="zg-quiz-progress-title">Procesando lote...</span>
                        <span id="zg-quiz-progress-percent">0%</span>
                    </div>
                    <div style="width:100%; background:#cbd5e1; height:8px; border-radius:4px; overflow:hidden;">
                        <div id="zg-quiz-progress-bar" style="width:0%; background:#2563eb; height:100%; transition:width 0.3s ease;"></div>
                    </div>
                </div>

                <!-- Fila 4: Banner de descarga completada -->
                <div id="zg-quiz-download-banner" style="display:none; background:#ecfdf5; border:1px solid #10b981; border-radius:8px; padding:10px 16px; align-items:center; gap:12px; color:#065f46;">
                    <i class="fa fa-check-circle" style="font-size:20px; color:#10b981; flex-shrink:0;"></i>
                    <div style="display:flex; flex-direction:column; gap:2px; text-align:left;">
                        <strong id="zg-quiz-banner-title" style="font-size:13px; font-weight:700; color:#065f46; margin:0; padding:0; display:block; text-align:left; line-height:1.3;">¡Descargas completadas!</strong>
                        <span id="zg-quiz-banner-subtitle" style="font-size:11px; color:#047857; margin:0; padding:0; display:block; text-align:left; line-height:1.3;">Los resultados se han descargado a tu carpeta de descargas.</span>
                    </div>
                </div>
            `;
        }
        // Insertar el card justo encima de la tabla (debajo del Search), como en /classes/
        const table = document.getElementById('quizTable');
        const anchor = table || tableWrapper;
        if (card.nextSibling !== anchor) {
            anchor.parentNode.insertBefore(card, anchor);
        }

        // Botones de orden
        const btnClass = document.getElementById('zg-sort-mode-class');
        const btnDate = document.getElementById('zg-sort-mode-date');
        if (btnClass && !btnClass.dataset.zgBound) {
            btnClass.dataset.zgBound = 'true';
            btnClass.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.setItem('zipgrade_toolkit_quiz_sort_mode', 'class-date');
                btnClass.classList.add('btn-primary');
                btnClass.classList.remove('btn-default');
                btnDate.classList.add('btn-default');
                btnDate.classList.remove('btn-primary');
                applyQuizzesSort();
            });
        }
        if (btnDate && !btnDate.dataset.zgBound) {
            btnDate.dataset.zgBound = 'true';
            btnDate.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.setItem('zipgrade_toolkit_quiz_sort_mode', 'date-class');
                btnDate.classList.add('btn-primary');
                btnDate.classList.remove('btn-default');
                btnClass.classList.add('btn-default');
                btnClass.classList.remove('btn-primary');
                applyQuizzesSort();
            });
        }

        // Botones Seleccionar/Deseleccionar Todo
        const btnSelAll = document.getElementById('zg-quiz-btn-select-all');
        const btnDeselAll = document.getElementById('zg-quiz-btn-deselect-all');
        if (btnSelAll && !btnSelAll.dataset.zgBound) {
            btnSelAll.dataset.zgBound = 'true';
            btnSelAll.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.zg-quiz-check').forEach(c => c.checked = true);
                const masterChk = document.getElementById('zg-quiz-master-check');
                if (masterChk) masterChk.checked = true;
                updateQuizResultsCounter();
            });
        }
        if (btnDeselAll && !btnDeselAll.dataset.zgBound) {
            btnDeselAll.dataset.zgBound = 'true';
            btnDeselAll.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.zg-quiz-check').forEach(c => c.checked = false);
                const masterChk = document.getElementById('zg-quiz-master-check');
                if (masterChk) masterChk.checked = false;
                updateQuizResultsCounter();
            });
        }

        // Botón Descargar Resultados (lote)
        const bulkBtn = document.getElementById('zg-btn-quiz-download-selected');
        if (bulkBtn && !bulkBtn.dataset.zgBound) {
            bulkBtn.dataset.zgBound = 'true';
            bulkBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await downloadSelectedQuizResults(bulkBtn);
            });
        }
    }

    function applyQuizzesSort() {
        const table = document.getElementById('quizTable');
        if (!table) return;

        const mode = localStorage.getItem('zipgrade_toolkit_quiz_sort_mode') || 'date-class';

        if (typeof window.jQuery !== 'undefined' && window.jQuery.fn && window.jQuery.fn.DataTable && window.jQuery.fn.DataTable.isDataTable(table)) {
            try {
                const dt = window.jQuery(table).DataTable();
                const settings = dt.settings()[0];

                if (settings && settings.aoColumns) {
                    if (mode === 'class-date') {
                        if (settings.aoColumns[2]) {
                            settings.aoColumns[2].aDataSort = [2, 4];
                            settings.aoColumns[2].orderData = [2, 4];
                        }
                        if (settings.aoColumns[4]) {
                            settings.aoColumns[4].aDataSort = [4, 2];
                            settings.aoColumns[4].orderData = [4, 2];
                        }
                        dt.order([[2, 'asc'], [4, 'asc']]);
                    } else {
                        if (settings.aoColumns[2]) {
                            settings.aoColumns[2].aDataSort = [2, 4];
                            settings.aoColumns[2].orderData = [2, 4];
                        }
                        if (settings.aoColumns[4]) {
                            settings.aoColumns[4].aDataSort = [4, 2];
                            settings.aoColumns[4].orderData = [4, 2];
                        }
                        dt.order([[4, 'asc'], [2, 'asc']]);
                    }
                }

                dt.rows().invalidate('dom');
                dt.draw(false);
                console.log(`✅ [ZipGrade] Reordenado por modo (DataTables): ${mode}`);
                return;
            } catch (e) {
                console.warn("No se pudo reordenar via DataTables, cayendo en fallback manual:", e);
            }
        }

        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        let rows = Array.from(tbody.querySelectorAll('tr'));
        if (rows.length === 0) return;

        rows.sort((a, b) => {
            if (mode === 'class-date') {
                const classA = getQuizClassWeight(a);
                const classB = getQuizClassWeight(b);
                if (classA !== classB) return classA - classB;

                const dateA = getQuizDateValue(a);
                const dateB = getQuizDateValue(b);
                return dateA - dateB;
            } else {
                const dateA = getQuizDateValue(a);
                const dateB = getQuizDateValue(b);
                if (dateA !== dateB) return dateA - dateB;

                const classA = getQuizClassWeight(a);
                const classB = getQuizClassWeight(b);
                return classA - classB;
            }
        });

        const fragment = document.createDocumentFragment();
        rows.forEach(row => fragment.appendChild(row));
        tbody.appendChild(fragment);
        console.log(`✅ [ZipGrade] Reordenado por modo (Manual): ${mode}`);
    }

    function sortQuizTable() {
        console.log("⚙️ [ZipGrade] Reorganizando la página /quizzes/ por fecha y curso...");
        ensureAllEntriesShown();

        const table = document.getElementById('quizTable');
        if (!table) return;

        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        let rows = Array.from(tbody.querySelectorAll('tr'));
        if (rows.length === 0) return;

        rows.forEach(row => {
            const classCell = row.cells[2];
            if (classCell) {
                const weight = getQuizClassWeight(row);
                classCell.setAttribute('data-order', weight);
                classCell.setAttribute('data-sort', weight);
            }

            const dateCell = row.cells[4];
            if (dateCell) {
                const originalDate = dateCell.innerText.trim();
                if (originalDate && !dateCell.dataset.originalDate) {
                    dateCell.dataset.originalDate = originalDate;
                    dateCell.innerText = formatQuizDate(originalDate);
                }
                const dateVal = getQuizDateValue(row);
                dateCell.setAttribute('data-order', dateVal);
                dateCell.setAttribute('data-sort', dateVal);
            }
        });

        const mode = localStorage.getItem('zipgrade_toolkit_quiz_sort_mode') || 'date-class';

        if (typeof window.jQuery !== 'undefined' && window.jQuery.fn && window.jQuery.fn.DataTable && window.jQuery.fn.DataTable.isDataTable(table)) {
            try {
                const dt = window.jQuery(table).DataTable();
                const settings = dt.settings()[0];
                if (settings && settings.aoColumns) {
                    if (settings.aoColumns[4]) {
                        settings.aoColumns[4].aDataSort = [4, 2];
                        settings.aoColumns[4].orderData = [4, 2];
                    }
                    if (settings.aoColumns[2]) {
                        settings.aoColumns[2].aDataSort = [2, 4];
                        settings.aoColumns[2].orderData = [2, 4];
                    }
                }

                dt.rows().invalidate('dom');

                if (!hasSortedQuizzesInitially) {
                    if (mode === 'class-date') {
                        dt.order([[2, 'asc'], [4, 'asc']]);
                    } else {
                        dt.order([[4, 'asc'], [2, 'asc']]);
                    }
                    hasSortedQuizzesInitially = true;
                }
                dt.draw(false);
                console.log("✅ [ZipGrade] DataTables re-sincronizado con ordenación secundaria de Quizzes.");
                return;
            } catch (e) {
                console.warn("Error en DataTables, cayendo en fallback manual:", e);
            }
        }

        rows.sort((a, b) => {
            if (mode === 'class-date') {
                const classA = getQuizClassWeight(a);
                const classB = getQuizClassWeight(b);
                if (classA !== classB) return classA - classB;

                const dateA = getQuizDateValue(a);
                const dateB = getQuizDateValue(b);
                return dateA - dateB;
            } else {
                const dateA = getQuizDateValue(a);
                const dateB = getQuizDateValue(b);
                if (dateA !== dateB) return dateA - dateB;

                const classA = getQuizClassWeight(a);
                const classB = getQuizClassWeight(b);
                return classA - classB;
            }
        });

        const fragment = document.createDocumentFragment();
        rows.forEach(row => fragment.appendChild(row));
        tbody.appendChild(fragment);
    }

    // ==========================================
    // 6.2.0. COLUMNA "ESTADO" EN /QUIZZES/ (ESCANEADOS/TOTAL + %)
    // ==========================================
    // Cache del mapa clase -> total de estudiantes (de /classes/)
    let zgClassStudentCountCache = null;

    async function getClassStudentCountMap() {
        if (zgClassStudentCountCache) return zgClassStudentCountCache;
        const map = {};
        try {
            const res = await customRequest({ method: 'GET', url: 'https://www.zipgrade.com/classes/' }, 30000);
            if (res.status === 200) {
                const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
                const rows = Array.from(doc.querySelectorAll('#subjectTable tbody tr'));
                rows.forEach(row => {
                    const nameEl = row.querySelector('td:nth-child(2) h4') || row.querySelector('td:nth-child(2) a') || row.querySelector('td:nth-child(2)');
                    const countEl = row.querySelector('td:nth-child(4) h4') || row.querySelector('td:nth-child(4)');
                    if (nameEl && countEl) {
                        const name = nameEl.innerText.trim();
                        const count = parseInt(countEl.innerText.trim(), 10);
                        if (name && !isNaN(count)) map[name] = count;
                    }
                });
            }
        } catch (e) {
            console.warn('⚠️ [ZipGrade] No se pudo obtener el mapa de estudiantes por clase:', e);
        }
        zgClassStudentCountCache = map;
        return map;
    }

    function getQuizRowClassText(row) {
        // En DataTables de quizTable:
        // Columna 0: Checkbox
        // Columna 1: Folder
        // Columna 2: Class
        // Buscar el TH "Class" para obtener el índice exacto de columna por si cambia
        const table = row.closest('table');
        if (table) {
            const ths = Array.from(table.querySelectorAll('thead th'));
            const classIdx = ths.findIndex(th => th.innerText.toLowerCase().includes('class'));
            if (classIdx !== -1 && row.cells[classIdx]) {
                return row.cells[classIdx].innerText.trim();
            }
        }
        const cell = row.cells[2];
        if (!cell) return '';
        return cell.innerText.trim();
    }

    // Obtiene papers escaneados de la página /all/ del quiz
    async function fetchQuizStatus(quizAllBaseUrl) {
        try {
            const res = await customRequest({ method: 'GET', url: quizAllBaseUrl }, 30000);
            if (res.status !== 200) return null;
            const html = res.responseText || '';

            // Papers escaneados: fila "Number of Papers:" (regex directa sobre el HTML)
            let scanned = null;
            const papersM = html.replace(/\s+/g, ' ').match(/Number of Papers:?<\/b><\/td>\s*<td[^>]*>\s*(\d+)/i);
            if (papersM) scanned = parseInt(papersM[1], 10);

            // Respaldo de escaneados: filas de la tabla gradedPapers
            if (scanned === null || isNaN(scanned)) {
                const doc = new DOMParser().parseFromString(html, 'text/html');
                const gpRows = doc.querySelectorAll('#gradedPapers tbody tr');
                scanned = gpRows ? gpRows.length : 0;
            }
            return { scanned };
        } catch (e) {
            return null;
        }
    }

    // Obtiene el número total de estudiantes de la clase de un quiz según el mapa de /classes/
    function getQuizClassStudentCount(quizClassText, classMap) {
        if (!quizClassText || !classMap) return 0;
        const quizClassNorm = normalizeClassName(quizClassText);

        // 1. Coincidencia exacta de nombre en /classes/ (solo si tiene más de 0 estudiantes)
        for (const [clsName, count] of Object.entries(classMap)) {
            if (normalizeClassName(clsName) === quizClassNorm && count > 0) {
                return count;
            }
        }

        // 2. Si es una clase rango (o una clase vacía de ordenación con 0 estudiantes),
        // calcular el total sumando los estudiantes de las clases individuales correspondientes.
        const grades = parseQuizClassGrades(quizClassText);
        const isRange = grades.length > 1;

        let total = 0;
        if (isRange) {
            for (const [clsName, count] of Object.entries(classMap)) {
                // Ignorar otras clases de tipo rango organizativo (que también tienen 0)
                if (parseQuizClassGrades(clsName).length > 1) continue;
                const w = extractGradeWeight(clsName);
                if (w < 99999 && grades.includes(Math.floor(w / 100))) {
                    total += count;
                }
            }
        } else if (grades.length === 1) {
            for (const [clsName, count] of Object.entries(classMap)) {
                if (parseQuizClassGrades(clsName).length > 1) continue;
                if (normalizeClassName(clsName) === quizClassNorm) {
                    total += count;
                }
            }
        }
        return total;
    }

    // Normaliza un nombre de clase para compararlo (quita °, º, espacios extra, unifica guiones)
    function normalizeClassName(text) {
        if (!text) return '';
        return text
            .replace(/[º°ª]/g, '')
            .replace(/[–—]/g, '-')
            .replace(/\s*-\s*/g, '-')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    // Extrae el rango de grados de un texto de clase de quiz.
    // Rango: "10° - 11°" -> [10,11] (lleva ° o "N - M" con espacios).
    // Individual: "10-1", "6-1", "601" -> [grado] (el segundo número es sección, NO rango).
    function parseQuizClassGrades(text) {
        if (!text) return [];
        const clean = text.replace(/\s+/g, ' ').trim();

        // Rango explícito: "10° - 11°", "10°-11°", "10 - 11" (con espacios alrededor del guion)
        const rangeM = clean.match(/(\d{1,2})\s*[º°ª]?\s*[-–]\s*(\d{1,2})\s*[º°ª]/);
        if (rangeM) {
            const a = parseInt(rangeM[1], 10), b = parseInt(rangeM[2], 10);
            const grades = [];
            for (let g = Math.min(a, b); g <= Math.max(a, b); g++) grades.push(g);
            return grades;
        }
        // Rango sin ° pero con espacios: "10 - 11"
        const rangeM2 = clean.match(/(\d{1,2})\s+[-–]\s+(\d{1,2})\b/);
        if (rangeM2) {
            const a = parseInt(rangeM2[1], 10), b = parseInt(rangeM2[2], 10);
            const grades = [];
            for (let g = Math.min(a, b); g <= Math.max(a, b); g++) grades.push(g);
            return grades;
        }
        // Individual: "10-1" (grado 10), "6-1" (grado 6), "601" (grado 6)
        const w = extractGradeWeight(clean);
        if (w < 99999) return [Math.floor(w / 100)];
        return [];
    }

    // Renderiza el badge visual de Estado en la celda
    function renderQuizStatusCell(cell, scanned, total) {
        let pct = 0;
        if (total > 0) pct = Math.round((scanned / total) * 100);
        let color = '#ef4444'; // rojo por defecto si total es 0 o % bajo
        if (total > 0) {
            if (pct >= 100) color = '#10b981';      // verde completo
            else if (pct >= 50) color = '#f59e0b';  // ámbar medio
            else color = '#ef4444';                 // rojo bajo
        } else if (scanned > 0) {
            // Si no hay total conocido pero sí escaneados
            color = '#10b981';
        }

        cell.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; gap:2px; line-height:1.2;">
                <span style="font-weight:700; font-size:12px; color:#1e293b;">${scanned}/${total}</span>
                <span style="font-size:10px; font-weight:700; padding:1px 7px; border-radius:8px; background:${color}; color:#ffffff;">${pct}%</span>
            </div>
        `;
    }

    async function initQuizStatusColumn() {
        const table = document.getElementById('quizTable');
        if (!table) return;

        // TH "Estado" antes de "Descarga Rápida" (si existe Descarga Rápida)
        const theadRow = table.querySelector('thead tr');
        if (theadRow && !theadRow.querySelector('.zg-status-th')) {
            const th = document.createElement('th');
            th.className = 'text-center zg-status-th sorting_disabled';
            th.style.cssText = 'vertical-align:middle; width:90px; color:#ffffff;';
            th.innerHTML = `<span style="font-weight:700; font-size:12px; color:#ffffff;">Estado</span>`;
            const resultsTh = theadRow.querySelector('.zg-quiz-th');
            if (resultsTh) {
                theadRow.insertBefore(th, resultsTh);
            } else {
                theadRow.appendChild(th);
            }
        }

        const classMap = await getClassStudentCountMap();
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        for (const row of rows) {
            let statusTd = row.querySelector('.zg-status-td');
            if (!statusTd) {
                const resultsTd = row.querySelector('.zg-quiz-td');
                statusTd = document.createElement('td');
                statusTd.className = 'zg-status-td';
                statusTd.style.cssText = 'vertical-align:middle; text-align:center;';
                statusTd.innerHTML = '<i class="fa fa-spinner fa-spin" style="color:#94a3b8;"></i>';

                if (resultsTd) {
                    row.insertBefore(statusTd, resultsTd);
                } else {
                    row.appendChild(statusTd);
                }
            }

            if (statusTd.dataset.zgStatusDone === 'true') continue;

            const link = row.querySelector('td a[href*="/quiz/"][href*="/all/"]');
            if (!link) {
                statusTd.innerHTML = '<span style="color:#cbd5e1;">-</span>';
                statusTd.dataset.zgStatusDone = 'true';
                continue;
            }
            const quizAllBaseUrl = new URL(link.getAttribute('href'), window.location.origin).pathname;

            // Nombre de la clase leído de la celda "Class" del quizTable
            const classText = getQuizRowClassText(row);

            // Total de estudiantes para la clase del quiz
            const total = getQuizClassStudentCount(classText, classMap);

            const status = await fetchQuizStatus(quizAllBaseUrl);
            const scanned = status ? status.scanned : 0;
            renderQuizStatusCell(statusTd, scanned, total);
            statusTd.dataset.zgStatusDone = 'true';
        }
    }

    // ==========================================
    // 6.2.1. COLUMNA "RESULTADOS" EN /QUIZZES/ (DESCARGA INDIVIDUAL Y MASIVA)
    // ==========================================
    function updateQuizResultsCounter() {
        const checked = document.querySelectorAll('.zg-quiz-check:checked').length;
        const total = document.querySelectorAll('.zg-quiz-check').length;
        const badge = document.getElementById('zg-quiz-counter-badge');
        if (badge) {
            badge.innerText = `${checked} de ${total} marcados`;
            badge.classList.toggle('zg-badge-active', checked > 0);
        }
    }

    function initQuizzesResultsColumn() {
        const table = document.getElementById('quizTable');
        if (!table) return;

        // Expandir el ancho disponible (como en /classes/ y /students/)
        const mainCol = table.closest('.col-md-8') || table.closest('.col-md-9') || table.closest('.col-md-12');
        if (mainCol) {
            mainCol.style.width = '100%';
            mainCol.style.marginLeft = '0';
        }
        // Quitar el ancho fijo inline de la tabla para que use todo el contenedor
        table.style.width = '100%';

        // 1. Cabecera: añadir TH al final (mismo estilo que /classes/, no ordenable)
        const theadRow = table.querySelector('thead tr');
        if (theadRow && !theadRow.querySelector('.zg-quiz-th')) {
            const th = document.createElement('th');
            th.className = 'text-center zg-quiz-th sorting_disabled';
            th.style.cssText = 'vertical-align:middle; width:260px; color:#ffffff;';
            th.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; gap:3px;">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <input type="checkbox" id="zg-quiz-master-check" title="Seleccionar/Deseleccionar todos" style="margin:0; cursor:pointer; width:16px; height:16px;" />
                        <span style="font-weight:700; font-size:12px; color:#ffffff;">Descarga Rápida</span>
                    </div>
                    <span id="zg-quiz-counter-badge" class="zg-counter-badge">0 de 0 marcados</span>
                </div>
            `;
            theadRow.appendChild(th);

            th.querySelector('#zg-quiz-master-check').addEventListener('change', (e) => {
                document.querySelectorAll('.zg-quiz-check').forEach(c => c.checked = e.target.checked);
                updateQuizResultsCounter();
            });
        }

        // 2. Filas: añadir TD con checkbox + botón individual
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        rows.forEach(row => {
            if (row.querySelector('.zg-quiz-td')) return;
            const link = row.querySelector('td a[href*="/quiz/"][href*="/all/"]');
            if (!link) {
                const emptyTd = document.createElement('td');
                emptyTd.className = 'zg-quiz-td';
                row.appendChild(emptyTd);
                return;
            }
            const href = link.getAttribute('href');
            const quizName = link.innerText.trim();
            const quizAllBaseUrl = new URL(href, window.location.origin).pathname;

            const td = document.createElement('td');
            td.className = 'zg-quiz-td';
            td.style.cssText = 'vertical-align:middle; text-align:center;';
            td.innerHTML = `
                <div style="display:inline-flex; gap:6px; align-items:center; justify-content:center;">
                    <input type="checkbox" class="zg-quiz-check" data-quiz-url="${quizAllBaseUrl}" data-quiz-name="${quizName.replace(/"/g, '&quot;')}" style="margin:0; cursor:pointer; width:15px; height:15px;" />
                    <button class="zg-btn-quiz-download btn btn-default btn-xs" style="padding:3px 8px;" title="Descargar resultados de este quiz (formato personalizado)">
                        <i class="fa fa-cloud-download" style="color:#2563eb;"></i>
                    </button>
                </div>
            `;
            row.appendChild(td);

            const chk = td.querySelector('.zg-quiz-check');
            chk.addEventListener('change', updateQuizResultsCounter);

            // Selector de formato en la celda (siempre visible, estilo /classes/)
            const select = document.createElement('select');
            select.className = 'zg-quiz-format-select';
            select.style.cssText = 'padding:4px 6px; font-size:11px; border-radius:6px; border:1px solid #cbd5e1; width:165px; max-width:165px; background:#fff; cursor:pointer;';
            select.innerHTML = '<option value="">Cargando...</option>';
            select.disabled = true;
            select.addEventListener('change', () => {
                if (select.value !== '' && select.selectedOptions[0]?.dataset.valid === '1') {
                    chk.checked = true;
                }
                updateQuizResultsCounter();
            });
            chk.after(select);

            // Cargar formatos del quiz de una vez
            (async () => {
                try {
                    const formats = await fetchCustomExportFormats(quizAllBaseUrl);
                    td.dataset.formats = JSON.stringify(formats.map(f => ({
                        name: f.name,
                        csv: f.csv,
                        xlsx: f.xlsx
                    })));

                    if (formats.length === 0) {
                        select.innerHTML = '<option value="">Sin formato</option>';
                        select.disabled = true;
                    } else if (formats.length === 1) {
                        // Un solo formato: preseleccionado y bloqueado
                        select.innerHTML = `<option value="0" data-valid="1" selected>${formats[0].name}</option>`;
                        select.disabled = true;
                        select.style.background = '#f1f5f9';
                        select.style.color = '#64748b';
                        select.style.cursor = 'not-allowed';
                    } else {
                        // Varios formatos: selector habilitado
                        select.innerHTML = '<option value="">-- Seleccionar --</option>' +
                            formats.map((f, i) => `<option value="${i}" data-valid="1">${f.name}</option>`).join('');
                        select.disabled = false;
                    }
                } catch (err) {
                    console.warn(`⚠️ [ZipGrade] No se pudieron cargar formatos de "${quizName}":`, err);
                    select.innerHTML = '<option value="">Error</option>';
                    select.disabled = true;
                }
            })();

            const rowBtn = td.querySelector('.zg-btn-quiz-download');
            rowBtn.addEventListener('click', async (e) => {
                e.preventDefault();

                // Usar el formato elegido en el selector de la fila si es válido
                if (td.dataset.formats && select.value !== '') {
                    const formats = JSON.parse(td.dataset.formats);
                    const chosen = formats[parseInt(select.value, 10)];
                    if (chosen) {
                        const originalHtml = rowBtn.innerHTML;
                        rowBtn.disabled = true;
                        rowBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';
                        try {
                            const type = chosen.xlsx ? 'XLSX' : 'CSV';
                            const filename = await downloadCustomExport(chosen, type);
                            console.log(`📥 [ZipGrade] Resultados descargados como: ${filename}`);
                        } catch (err) {
                            console.error('❌ [ZipGrade] Error en descarga de resultados:', err);
                            alert(`No se pudo descargar los resultados: ${err.message}`);
                        } finally {
                            rowBtn.disabled = false;
                            rowBtn.innerHTML = originalHtml;
                        }
                        return;
                    }
                }

                // Sin formato elegido: si el quiz no tiene o aún carga, avisar
                if (td.dataset.formats && JSON.parse(td.dataset.formats).length === 0) {
                    alert(`"${quizName}" no tiene un formato personalizado creado.`);
                    return;
                }
                await handleResultsDownloadClick(rowBtn, quizAllBaseUrl, true);
            });
        });

        updateQuizResultsCounter();

        // 3. Desactivar ordenación/búsqueda de DataTables en las columnas personalizadas (Estado + Descarga Rápida)
        if (typeof window.jQuery !== 'undefined' && window.jQuery.fn && window.jQuery.fn.DataTable && window.jQuery.fn.DataTable.isDataTable(table)) {
            try {
                const dt = window.jQuery(table).DataTable();
                const settings = dt.settings()[0];
                if (settings && settings.aoColumns) {
                    const totalCols = settings.aoColumns.length;
                    // Las dos últimas columnas son las personalizadas: Estado (penúltima) y Descarga Rápida (última)
                    [totalCols - 2, totalCols - 1].forEach(idx => {
                        const col = settings.aoColumns[idx];
                        if (col && col.bSortable !== false) {
                            col.bSortable = false;
                            col.bSearchable = false;
                            col.aDataSort = [idx];
                            col.orderData = [idx];
                        }
                    });
                    if (settings.aaSorting) {
                        settings.aaSorting = settings.aaSorting.filter(s => s[0] < totalCols - 2);
                    }
                }
            } catch (e) {
                console.warn("No se pudo desactivar ordenación de las columnas personalizadas:", e);
            }
        }

    }

    // Helpers de UI del card de /quizzes/
    function updateQuizStatusText(msg) {
        const el = document.getElementById('zg-quiz-status-text');
        if (el) el.innerText = msg;
    }

    function setQuizProgressBar(percent, title = "Procesando...") {
        const container = document.getElementById('zg-quiz-progress-container');
        const titleEl = document.getElementById('zg-quiz-progress-title');
        const percentEl = document.getElementById('zg-quiz-progress-percent');
        const barEl = document.getElementById('zg-quiz-progress-bar');
        if (container && titleEl && percentEl && barEl) {
            container.style.display = 'flex';
            titleEl.innerText = title;
            percentEl.innerText = `${Math.round(percent)}%`;
            barEl.style.width = `${Math.min(100, Math.max(0, percent))}%`;
        }
    }

    function hideQuizProgressBar() {
        const container = document.getElementById('zg-quiz-progress-container');
        if (container) container.style.display = 'none';
    }

    // Descarga masiva de resultados para los quizzes marcados en /quizzes/
    async function downloadSelectedQuizResults(bulkBtn) {
        const checked = Array.from(document.querySelectorAll('.zg-quiz-check:checked'));
        if (checked.length === 0) {
            alert('Marca al menos un quiz en la columna "Descarga Rápida".');
            return;
        }

        const bannerEl = document.getElementById('zg-quiz-download-banner');
        if (bannerEl) bannerEl.style.display = 'none';

        const originalHtml = bulkBtn.innerHTML;
        bulkBtn.disabled = true;
        const startTime = Date.now();

        let successCount = 0;
        let skipCount = 0;
        for (let i = 0; i < checked.length; i++) {
            const chk = checked[i];
            const quizUrl = chk.dataset.quizUrl;
            const quizName = chk.dataset.quizName;
            const progressPercent = (i / checked.length) * 90;

            setQuizProgressBar(progressPercent, `Descargando ${i + 1}/${checked.length}: ${quizName}`);
            updateQuizStatusText(`Descargando ${i + 1}/${checked.length}: ${quizName}...`);
            bulkBtn.innerHTML = `<i class="fa fa-spinner fa-spin"></i> ${i + 1}/${checked.length}`;

            try {
                // Si la fila tiene un formato elegido en su selector, usarlo; si no, el primero
                const td = chk.closest('.zg-quiz-td');
                const rowSelect = td ? td.querySelector('.zg-quiz-format-select') : null;
                let fmt = null;

                if (rowSelect && td.dataset.formats && rowSelect.value !== '') {
                    const cached = JSON.parse(td.dataset.formats);
                    fmt = cached[parseInt(rowSelect.value, 10)];
                }

                if (!fmt) {
                    const formats = await fetchCustomExportFormats(quizUrl);
                    if (formats.length === 0) {
                        console.warn(`⚠️ [ZipGrade] "${quizName}" no tiene formatos personalizados. Omitido.`);
                        skipCount++;
                        continue;
                    }
                    fmt = formats[0];
                }

                const type = fmt.xlsx ? 'XLSX' : 'CSV';
                const filename = await downloadCustomExport(fmt, type);
                console.log(`📥 [ZipGrade] ${i + 1}/${checked.length} descargado: ${filename}`);
                successCount++;
                await new Promise(r => setTimeout(r, 2000));
            } catch (err) {
                console.error(`❌ [ZipGrade] Error descargando "${quizName}":`, err);
                skipCount++;
            }
            // Pausa anti rate-limit entre quizzes
            if (i < checked.length - 1) {
                await new Promise(r => setTimeout(r, 3000));
            }
        }

        bulkBtn.innerHTML = originalHtml;
        bulkBtn.disabled = false;
        hideQuizProgressBar();

        const totalTime = Math.round((Date.now() - startTime) / 1000);
        const minutes = Math.floor(totalTime / 60);
        const secs = totalTime % 60;
        const timeStr = minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
        const summary = `${successCount} de ${checked.length} resultados descargados en ${timeStr}` + (skipCount > 0 ? ` (${skipCount} omitidos)` : '');
        console.log(`🎉 [ZipGrade] ${summary}`);
        updateQuizStatusText(summary);

        if (successCount > 0) {
            const bannerTitle = document.getElementById('zg-quiz-banner-title');
            const bannerSub = document.getElementById('zg-quiz-banner-subtitle');
            if (bannerTitle) bannerTitle.textContent = summary;
            if (bannerSub) {
                bannerSub.textContent = skipCount > 0
                    ? `${skipCount} quiz(zes) se omitieron por no tener formato personalizado.`
                    : 'Los resultados se han descargado a tu carpeta de descargas.';
            }
            if (bannerEl) bannerEl.style.display = 'flex';
        } else {
            alert('No se pudo descargar ningún resultado. Verifica que los quizzes tengan un Export Format personalizado.');
        }
    }

    function initQuizzesPage() {
        createQuizzesSortControls();
        sortQuizTable();
        initQuizzesResultsColumn();
        initQuizStatusColumn();
        setTimeout(() => {
            createQuizzesSortControls();
            sortQuizTable();
            initQuizzesResultsColumn();
            initQuizStatusColumn();
        }, 400);
        setTimeout(() => {
            createQuizzesSortControls();
            sortQuizTable();
            initQuizzesResultsColumn();
            initQuizStatusColumn();
        }, 1000);

        // Re-insertar las columnas personalizadas si DataTables redibuja la tabla (ordenar, filtrar, paginar)
        const tbody = document.querySelector('#quizTable tbody');
        if (tbody && !window._zgQuizTableObserver) {
            let reinsertTimer = null;
            window._zgQuizTableObserver = new MutationObserver(() => {
                if (reinsertTimer) clearTimeout(reinsertTimer);
                reinsertTimer = setTimeout(() => {
                    initQuizzesResultsColumn();
                    initQuizStatusColumn();
                }, 150);
            });
            window._zgQuizTableObserver.observe(tbody, { childList: true });
        }
    }

    // ==========================================
    // 6.3. ORDENAR CLASES ACADÉMICAMENTE EN CREACIÓN/EDICIÓN DE QUIZ
    // ==========================================
    function sortQuizEditClasses() {
        const classListUl = document.getElementById('classList');
        if (!classListUl) return;

        const items = Array.from(classListUl.querySelectorAll('li'));
        if (items.length <= 1) return;

        // Función para identificar rangos (ej: "1° - 2°", "10° - 11°")
        function isClassRange(text) {
            const degreeCount = (text.match(/[°ºª]/g) || []).length;
            if (degreeCount >= 2) return true;
            if (text.includes(' - ') && text.includes('°')) return true;
            return false;
        }

        items.sort((a, b) => {
            const labelA = a.querySelector('label');
            const labelB = b.querySelector('label');
            const textA = labelA ? labelA.innerText.trim() : '';
            const textB = labelB ? labelB.innerText.trim() : '';

            // 1. Sandbox y Teachers al final del todo
            const isNonAcadA = textA.toLowerCase().includes('sandbox') || textA.toLowerCase().includes('teacher');
            const isNonAcadB = textB.toLowerCase().includes('sandbox') || textB.toLowerCase().includes('teacher');
            if (isNonAcadA && !isNonAcadB) return 1;
            if (!isNonAcadA && isNonAcadB) return -1;
            if (isNonAcadA && isNonAcadB) {
                return textA.localeCompare(textB, undefined, { numeric: true, sensitivity: 'base' });
            }

            // 2. Rangos de grados (ej: "1° - 2°") agrupados después de clases individuales, pero antes de Sandbox/Teachers
            const isRangeA = isClassRange(textA);
            const isRangeB = isClassRange(textB);
            if (isRangeA && !isRangeB) return 1;
            if (!isRangeA && isRangeB) return -1;

            // 3. Ambos son rangos o ambos son individuales: ordenar por peso y luego por nombre
            const weightA = extractGradeWeight(textA);
            const weightB = extractGradeWeight(textB);
            if (weightA !== weightB) return weightA - weightB;

            return textA.localeCompare(textB, undefined, { numeric: true, sensitivity: 'base' });
        });

        // Re-apend en el orden correcto
        items.forEach(li => classListUl.appendChild(li));
        console.log(`✅ [ZipGrade] ${items.length} clases ordenadas académicamente (con rangos agrupados al final).`);
    }

    // ==========================================
    // 6.4. FORMATEAR SELECTOR DE FECHA EN CREACIÓN/EDICIÓN DE QUIZ
    // ==========================================
    function initQuizEditPage() {
        // Ordenar la lista de checkboxes de cursos
        sortQuizEditClasses();

        // Corregir formato antiguo de nombre de quiz si aplica
        const quizNameInput = document.getElementById('quizName');
        if (quizNameInput) {
            quizNameInput.value = adjustQuizNameFormat(quizNameInput.value);
        }

        const quizDateInput = document.getElementById('quizDate');
        if (!quizDateInput || document.getElementById('zg-quiz-date-display-text')) return;

        console.log("⚙️ [ZipGrade] Inicializando formateador de fecha en la página de edición de Quiz...");

        // 1. Crear contenedor
        const wrapper = document.createElement('div');
        wrapper.id = 'zg-quiz-date-wrapper';
        wrapper.style.cssText = 'position: relative; width: 100%; height: 34px;';

        // 2. Crear elemento de visualización
        const displayEl = document.createElement('div');
        displayEl.className = 'form-control';
        displayEl.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: #fff;
            pointer-events: none;
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1;
            box-sizing: border-box;
        `;

        const textSpan = document.createElement('span');
        textSpan.id = 'zg-quiz-date-display-text';
        displayEl.appendChild(textSpan);

        const icon = document.createElement('i');
        icon.className = 'fa fa-calendar';
        icon.style.cssText = 'color: #94a3b8; font-size: 14px;';
        displayEl.appendChild(icon);

        // 3. Colocar en el DOM
        quizDateInput.parentNode.insertBefore(wrapper, quizDateInput);
        wrapper.appendChild(displayEl);
        wrapper.appendChild(quizDateInput);

        // 4. Estilar el input original para que sea transparente y esté encima
        quizDateInput.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            opacity: 0;
            z-index: 2;
            cursor: pointer;
            box-sizing: border-box;
            background: transparent;
            border: none;
        `;

        // 5. Función de actualización de texto
        function updateDisplay() {
            const rawVal = quizDateInput.value;
            if (rawVal) {
                textSpan.innerText = formatQuizDate(rawVal);
            } else {
                textSpan.innerText = '';
            }
        }

        // 6. Escuchar cambios
        quizDateInput.addEventListener('input', updateDisplay);
        quizDateInput.addEventListener('change', updateDisplay);

        // Actualizar el valor inicial
        updateDisplay();
    }

    // Helper para formatear nombres de quiz antiguos al nuevo formato "Template E.S.A. | Class | Period | Session"
    function adjustQuizNameFormat(nameVal) {
        if (!nameVal) return nameVal;

        let cleanVal = nameVal.trim();
        let suffix = '';
        if (cleanVal.toLowerCase().endsWith(' copy')) {
            cleanVal = cleanVal.substring(0, cleanVal.length - 5).trim();
            suffix = ' copy';
        }

        const parts = cleanVal.split('|').map(p => p.trim());
        if (parts.length >= 4 && parts[0] === 'Template E.S.A.') {
            const sessVal = parts[1];
            // Si el segundo elemento tiene formato de sesión (ej: S1, S2, S10), es el formato viejo
            if (/^S\d+$/i.test(sessVal)) {
                const prefix = parts[0];
                const session = parts[1];
                const period = parts[2];
                const classVal = parts[3];
                return `${prefix} | ${classVal} | ${period} | ${session}${suffix}`;
            }
        }
        return nameVal;
    }

    // Helper para convertir "September 15, 2026" o "Miércoles 16/SEP/2026" a "2026-09-15"
    function parseEnglishDate(dateStr) {
        if (!dateStr) return null;
        const months = {
            january: '01', february: '02', march: '03', april: '04',
            may: '05', june: '06', july: '07', august: '08',
            september: '09', october: '10', november: '11', december: '12'
        };
        const spanishMonths = {
            ene: '01', feb: '02', mar: '03', abr: '04',
            may: '05', jun: '06', jul: '07', ago: '08',
            sep: '09', oct: '10', nov: '11', dic: '12'
        };

        const clean = dateStr.trim();

        // 1. Formato inglés: "September 16, 2026"
        const matchEng = clean.match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/);
        if (matchEng) {
            const mName = matchEng[1].toLowerCase();
            const day = matchEng[2].padStart(2, '0');
            const year = matchEng[3];
            const month = months[mName];
            if (month) return `${year}-${month}-${day}`;
        }

        // 2. Formato español ya formateado por el toolkit: "Miércoles 16/SEP/2026" o "16/SEP/2026"
        const matchEsp = clean.match(/(\d{1,2})\/([A-Za-z]{3})\/(\d{4})/);
        if (matchEsp) {
            const day = matchEsp[1].padStart(2, '0');
            const mName = matchEsp[2].toLowerCase();
            const year = matchEsp[3];
            const month = spanishMonths[mName];
            if (month) return `${year}-${month}-${day}`;
        }

        // 3. Formato ISO ya existente: "2026-09-16"
        if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

        return null;
    }

    async function updateQuizDateViaEdit(targetDate) {
        console.log(`⏳ [ZipGrade] Heredando la fecha original del quiz: ${targetDate}...`);
        const quizIdMatch = window.location.pathname.match(/\/quiz\/([^/]+)/);
        if (!quizIdMatch) return;
        const quizId = quizIdMatch[1];
        const editUrl = `/quiz/${quizId}/edit/`;

        try {
            const resp = await fetch(editUrl);
            if (!resp.ok) throw new Error("HTTP " + resp.status);
            const html = await resp.text();

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const quizName = doc.getElementById('quizName')?.value || '';
            const adjustedQuizName = adjustQuizNameFormat(quizName);
            const answerSheet = doc.getElementById('answerSheet')?.value || doc.querySelector('select[name="answerSheet"]')?.value || '';
            const folder = doc.querySelector('select[name="folder"]')?.value || '';
            const csrfToken = doc.querySelector('input[name="csrf_token"]')?.value || '';
            const classInputs = Array.from(doc.querySelectorAll('input[name="classList"]:checked'));

            const params = new URLSearchParams();
            params.append('quizName', adjustedQuizName);
            params.append('answerSheet', answerSheet);
            params.append('quizDate', targetDate); // Asignar fecha heredada
            params.append('folder', folder);
            params.append('csrf_token', csrfToken);

            classInputs.forEach(inp => {
                params.append('classList', inp.value);
            });

            const saveResp = await fetch(editUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params.toString()
            });

            if (saveResp.ok) {
                console.log(`✅ [ZipGrade] Fecha heredada exitosamente y quiz actualizado: ${targetDate}`);
                window.location.reload();
            } else {
                console.warn("Fallo al actualizar la fecha heredada.");
            }
        } catch (e) {
            console.error("Error al heredar fecha de quiz:", e);
        }
    }

    // ==========================================
    // 6.5. DESCARGA DE RESULTADOS PERSONALIZADA EN /QUIZ/.../ALL/
    // ==========================================
    // Trunca un nombre de quiz/archivo hasta la sesión (S1, S2, ...) inclusive.
    // Ej: "Template E.S.A. _ 10_ - 11_ _ P3 _ S2-all-Quiz Format Masive-2026-08-10 23_39_24"
    //     -> "Template E.S.A. _ 10_ - 11_ _ P3 _ S2"
    function truncateNameToSession(name) {
        if (!name) return name;
        const m = name.match(/^(.*?\bS\d+\b)/i);
        if (m) return m[1].replace(/[\s_\-|]+$/g, '').trim();
        return name.trim();
    }

    // Construye "Resultados_<nombre truncado hasta sesión>" a partir del filename del servidor
    // o, como respaldo, del <title> de la página del quiz.
    function buildResultsFilename(serverFilename, pageTitle, extension) {
        let base = '';
        if (serverFilename) {
            base = serverFilename.replace(/\.[^.]+$/, '');
        } else if (pageTitle) {
            base = pageTitle.replace(/^ZipGrade:\s*Quiz:\s*/i, '').replace(/\|/g, '_');
        }
        base = truncateNameToSession(base);
        // Sanitizar caracteres no válidos en nombres de archivo de Windows
        base = base.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
        return `Resultados_${base}.${extension}`;
    }

    // Obtiene los formatos de exportación personalizados del quiz actual
    async function fetchCustomExportFormats(quizAllBaseUrl) {
        const listUrl = `${quizAllBaseUrl}exportFormat/list/`;
        const res = await customRequest({ method: 'GET', url: listUrl }, 45000);
        if (res.status !== 200) throw new Error(`HTTP ${res.status} al obtener formatos de exportación`);

        const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
        const formats = [];
        // Enlaces tipo: /quiz/<id>/all/exportFormat/<formatId>/export/CSV/ o /export/XLSX/
        const links = Array.from(doc.querySelectorAll('a[href*="/exportFormat/"][href*="/export/"]'));
        links.forEach(a => {
            const href = a.getAttribute('href');
            const m = href.match(/\/exportFormat\/([^/]+)\/export\/(CSV|XLSX)\//i);
            if (!m) return;
            const formatId = m[1];
            const type = m[2].toUpperCase();
            // Nombre del formato: primera celda de la fila del enlace
            const row = a.closest('tr');
            let formatName = formatId;
            if (row) {
                const firstCell = row.querySelector('td');
                if (firstCell && firstCell.innerText.trim()) {
                    formatName = firstCell.innerText.trim();
                }
            }
            let fmt = formats.find(f => f.id === formatId);
            if (!fmt) {
                fmt = { id: formatId, name: formatName, csv: null, xlsx: null };
                formats.push(fmt);
            }
            if (type === 'CSV') fmt.csv = new URL(href, window.location.origin).href;
            if (type === 'XLSX') fmt.xlsx = new URL(href, window.location.origin).href;
        });
        return formats;
    }

    // Descarga un formato personalizado y lo guarda con el nombre "Resultados_..."
    async function downloadCustomExport(format, preferType) {
        const url = (preferType === 'CSV' ? (format.csv || format.xlsx) : (format.xlsx || format.csv));
        if (!url) throw new Error('Este formato no tiene enlace de descarga disponible.');
        const ext = url.toUpperCase().includes('/XLSX/') ? 'xlsx' : 'csv';

        const res = await customRequest({ method: 'GET', url: url, responseType: 'blob' }, 90000);
        if (res.status !== 200 || !(res.response instanceof Blob) || res.response.size === 0) {
            throw new Error(`El servidor no devolvió un archivo válido (HTTP ${res.status}).`);
        }

        // Nombre que propone el servidor
        let serverFilename = '';
        const cd = (res.headers || '').match(/content-disposition:[^\n]*filename\*?=(?:UTF-8'')?"?([^";\n]+)/i);
        if (cd) {
            try { serverFilename = decodeURIComponent(cd[1].trim()); } catch (e) { serverFilename = cd[1].trim(); }
        }
        const filename = buildResultsFilename(serverFilename, document.title, ext);
        downloadBlob(res.response, filename);
        return filename;
    }

    // Modal simple para elegir formato/tipo cuando hay más de uno
    function showExportFormatChooser(formats) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:99999; display:flex; align-items:center; justify-content:center;';
            const modal = document.createElement('div');
            modal.style.cssText = 'background:#fff; border-radius:12px; padding:20px 24px; width:420px; max-width:92vw; box-shadow:0 20px 50px rgba(0,0,0,0.35); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
            modal.innerHTML = `
                <h4 style="margin:0 0 4px 0; font-size:15px; font-weight:700; color:#1e293b;"><i class="fa fa-floppy-o"></i> Descarga personalizada de resultados</h4>
                <p style="margin:0 0 14px 0; font-size:12px; color:#64748b;">Se encontraron ${formats.length} descargas personalizadas. Elige cuál exportar:</p>
                <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:14px;">
                    <select id="zg-export-format-select" style="width:100%; padding:8px 10px; font-size:13px; border:1px solid #cbd5e1; border-radius:8px; background:#fff;">
                        ${formats.map((f, i) => `<option value="${i}">${f.name}</option>`).join('')}
                    </select>
                    <div style="display:flex; gap:14px; align-items:center; font-size:12px; color:#334155;">
                        <span style="font-weight:600;">Tipo:</span>
                        <label style="margin:0; font-weight:500;"><input type="radio" name="zg-export-type" value="XLSX" checked> Excel (XLSX)</label>
                        <label style="margin:0; font-weight:500;"><input type="radio" name="zg-export-type" value="CSV"> CSV</label>
                    </div>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:8px;">
                    <button id="zg-export-cancel" class="btn btn-default btn-sm" style="border-radius:6px;">Cancelar</button>
                    <button id="zg-export-accept" class="btn btn-primary btn-sm" style="border-radius:6px;"><i class="fa fa-download"></i> Descargar</button>
                </div>
            `;
            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            const cleanup = (val) => { overlay.remove(); resolve(val); };
            modal.querySelector('#zg-export-cancel').addEventListener('click', () => cleanup(null));
            overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(null); });
            modal.querySelector('#zg-export-accept').addEventListener('click', () => {
                const idx = parseInt(modal.querySelector('#zg-export-format-select').value, 10);
                const type = modal.querySelector('input[name="zg-export-type"]:checked')?.value || 'XLSX';
                cleanup({ format: formats[idx], type });
            });
        });
    }

    // Descarga resultados para un quiz dado su URL base "/quiz/<id>/all/"
    // skipChooser: si es true, siempre usa el primer formato sin mostrar el selector
    async function handleResultsDownloadClick(btn, quizAllBaseUrl = null, skipChooser = false) {
        if (!quizAllBaseUrl) {
            const quizIdMatch = window.location.pathname.match(/\/quiz\/([^/]+)\/all\//);
            if (!quizIdMatch) return;
            quizAllBaseUrl = `/quiz/${quizIdMatch[1]}/all/`;
        }

        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Resultados';

        try {
            console.log('🔍 [ZipGrade] Buscando descargas personalizadas del quiz...');
            const formats = await fetchCustomExportFormats(quizAllBaseUrl);

            if (formats.length === 0) {
                alert('Este quiz no tiene descargas personalizadas (Export Formats) creadas.\nCrea una desde "Custom Export Wizard..." primero.');
                return;
            }

            let chosen;
            if (formats.length === 1 || skipChooser) {
                // Solo existe una descarga personalizada (o modo masivo): se escoge por defecto
                chosen = { format: formats[0], type: formats[0].xlsx ? 'XLSX' : 'CSV' };
                console.log(`✅ [ZipGrade] Descarga personalizada seleccionada: "${formats[0].name}" (${chosen.type})`);
            } else {
                chosen = await showExportFormatChooser(formats);
                if (!chosen) return; // cancelado
            }

            console.log(`⬇️ [ZipGrade] Descargando resultados con formato "${chosen.format.name}" (${chosen.type})...`);
            const filename = await downloadCustomExport(chosen.format, chosen.type);
            console.log(`📥 [ZipGrade] Resultados descargados como: ${filename}`);
        } catch (err) {
            console.error('❌ [ZipGrade] Error en descarga de resultados:', err);
            alert(`No se pudo descargar los resultados: ${err.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }

    // Formatea la fila "Date:" de la tabla de detalles del quiz a "Miércoles 16/SEP/2026"
    function formatQuizDetailDate() {
        const tds = Array.from(document.querySelectorAll('td'));
        for (let i = 0; i < tds.length; i++) {
            if (tds[i].innerText.trim() === 'Date:') {
                const valTd = tds[i].nextElementSibling;
                if (!valTd || valTd.dataset.zgDateFormatted) return;
                const englishDate = valTd.innerText.trim();
                const isoDate = parseEnglishDate(englishDate);
                if (isoDate) {
                    valTd.dataset.originalDate = isoDate;
                    valTd.innerText = formatQuizDate(isoDate);
                    valTd.dataset.zgDateFormatted = 'true';
                    console.log(`✅ [ZipGrade] Fecha del quiz formateada: ${englishDate} -> ${valTd.innerText}`);
                }
                return;
            }
        }
    }

    function initQuizDetailPage() {
        // Formatear fecha del detalle del quiz (September 16, 2026 -> Miércoles 16/SEP/2026)
        formatQuizDetailDate();

        // Pre-formatear el campo del nombre del nuevo quiz en el modal de copia
        const newQuizNameInput = document.getElementById('newQuizName');
        if (newQuizNameInput) {
            newQuizNameInput.value = adjustQuizNameFormat(newQuizNameInput.value);
        }

        // 1. Guardar la fecha del quiz origen al abrir/interactuar con el modal de copia o enviar el formulario
        const copyForm = document.querySelector('form[action*="/quizzes/copyQuiz/"]');
        function captureSourceQuizDate() {
            const tds = Array.from(document.querySelectorAll('td'));
            let dateText = '';
            for (let i = 0; i < tds.length; i++) {
                if (tds[i].innerText.includes('Date:')) {
                    const valTd = tds[i].nextElementSibling;
                    if (valTd) {
                        dateText = valTd.dataset.originalDate || valTd.innerText.trim();
                    }
                    break;
                }
            }
            if (dateText) {
                const parsedDate = parseEnglishDate(dateText);
                if (parsedDate) {
                    sessionStorage.setItem('zg_copy_pending', 'true');
                    sessionStorage.setItem('zg_copy_source_date', parsedDate);
                    console.log("💾 [ZipGrade] Guardada fecha de origen para copia:", parsedDate);
                }
            }
        }

        const copyBtn = document.querySelector('button[data-target="#myModelCopy"]');
        if (copyBtn) {
            copyBtn.addEventListener('click', captureSourceQuizDate);
        }

        if (copyForm) {
            const submitBtn = copyForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.addEventListener('click', captureSourceQuizDate);
            }
            copyForm.addEventListener('submit', captureSourceQuizDate);
        }

        // 2. Si venimos de una acción de copia pendiente en este nuevo quiz, procesar
        if (sessionStorage.getItem('zg_copy_pending') === 'true') {
            const targetDate = sessionStorage.getItem('zg_copy_source_date');
            sessionStorage.removeItem('zg_copy_pending');
            sessionStorage.removeItem('zg_copy_source_date');

            if (targetDate) {
                updateQuizDateViaEdit(targetDate);
            }
        }
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
                        <span id="zg-counter-badge" class="zg-counter-badge">
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
                                <i class="fa fa-cogs"></i> ZipGrade Toolkit <small style="font-size:11px; font-weight:normal; color:#64748b;">v${SCRIPT_VERSION}</small>
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
                    <div id="zg-download-banner" style="display:none; background:#ecfdf5; border:1px solid #10b981; border-radius:8px; padding:10px 16px; align-items:center; gap:12px; color:#065f46;">
                        <i class="fa fa-check-circle" style="font-size:20px; color:#10b981; flex-shrink:0;"></i>
                        <div style="display:flex; flex-direction:column; gap:2px; text-align:left;">
                            <strong id="zg-banner-title" style="font-size:13px; font-weight:700; color:#065f46; margin:0; padding:0; display:block; text-align:left; line-height:1.3;">¡Descargas completadas!</strong>
                            <span id="zg-banner-subtitle" style="font-size:11px; color:#047857; margin:0; padding:0; display:block; text-align:left; line-height:1.3;">Los PDFs se han descargado individualmente a tu carpeta de descargas.</span>
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
                    console.log(`⏳ Enfriando ${coolingTime / 1000}s tras ${successCount} descargas (límite ZipGrade)...`);
                    updateStatusText(`⏳ Pausa de ${coolingTime / 1000}s para evitar bloqueo del servidor...`);
                    await new Promise(r => setTimeout(r, coolingTime));
                }

                if (consecutiveErrors > 0) {
                    pause = Math.min(10000, pause + (consecutiveErrors * 3000));
                    console.warn(`⏱️ ${consecutiveErrors} error(es) — pausa extendida a ${pause / 1000}s`);
                }
                console.log(`⏱️ Pausa de ${pause / 1000}s...`);
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
            const titleText = `${successCount} de ${queue.length} PDFs descargados en ${timeStr}`;
            const summary = coolingSecs > 0
                ? `${titleText} (${coolingSecs}s de espera por límite de velocidad)`
                : titleText;

            setProgressBar(100, summary);
            updateStatusText(summary);
            console.log(`🎉 [ZipGrade] ${summary}`);

            const bannerTitle = document.getElementById('zg-banner-title');
            const bannerSub = document.getElementById('zg-banner-subtitle');
            if (bannerTitle) bannerTitle.textContent = titleText;
            if (bannerSub) {
                bannerSub.textContent = coolingSecs > 0
                    ? `Procesado exitosamente con ${coolingSecs}s de pausa de enfriamiento anti-bloqueo.`
                    : `Los PDFs se han descargado individualmente a tu carpeta de descargas.`;
            }
            if (bannerEl) bannerEl.style.display = 'flex';
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
        formData.set('sortOrder', 'studentId');

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
                console.warn(`⚠️ fetch timeout (${timeoutMs / 1000}s) para ${className}`);
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
    } else if (window.location.pathname.includes('/quizzes')) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initQuizzesPage);
        } else {
            initQuizzesPage();
        }
    } else if (window.location.pathname.includes('/newQuiz/edit/') || (window.location.pathname.includes('/quiz/') && window.location.pathname.includes('/edit/'))) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initQuizEditPage);
        } else {
            initQuizEditPage();
        }
    } else if (window.location.pathname.includes('/quiz/') && window.location.pathname.includes('/all/')) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initQuizDetailPage);
        } else {
            initQuizDetailPage();
        }
    }
})();