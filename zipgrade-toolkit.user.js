// ==UserScript==
// @name         ZipGrade Toolkit
// @namespace    http://tampermonkey.net/
// @version      28.5
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
            #quizTable thead th,
            #quizTable thead td,
            #subjectTable thead th,
            #subjectTable thead td {
                text-align: center !important;
                vertical-align: middle !important;
            }
            #quizTable thead th h4,
            #quizTable thead td h4,
            #subjectTable thead th h4,
            #subjectTable thead td h4 {
                text-align: center !important;
            }
            #quizTable thead th.sorting,
            #quizTable thead th.sorting_asc,
            #quizTable thead th.sorting_desc,
            #quizTable thead th.sorting_asc_disabled,
            #quizTable thead th.sorting_desc_disabled {
                padding-right: 0 !important;
            }
            #quizTable thead th.sorting::after,
            #quizTable thead th.sorting_asc::after,
            #quizTable thead th.sorting_desc::after,
            #quizTable thead th.sorting_asc_disabled::after,
            #quizTable thead th.sorting_desc_disabled::after,
            #quizTable thead th.sorting::before,
            #quizTable thead th.sorting_asc::before,
            #quizTable thead th.sorting_desc::before,
            #quizTable thead th.sorting_asc_disabled::before,
            #quizTable thead th.sorting_desc_disabled::before {
                display: none !important;
            }
            #quizTable tbody th,
            #quizTable tbody td,
            #subjectTable tbody th,
            #subjectTable tbody td {
                text-align: center !important;
                vertical-align: middle !important;
            }
            #zg-quiz-master-check,
            #zg-master-check {
                appearance: none;
                -webkit-appearance: none;
                -moz-appearance: none;
                margin: 0;
                cursor: pointer;
                width: 16px;
                height: 16px;
                border: 1px solid #b6c2cf;
                border-radius: 3px;
                background: #ffffff;
                display: inline-block;
                vertical-align: middle;
                position: relative;
                outline: none;
                box-sizing: border-box;
            }
            #zg-quiz-master-check:hover,
            #zg-master-check:hover {
                border-color: #3c87c8;
            }
            #zg-quiz-master-check:checked,
            #zg-master-check:checked {
                background: #3c87c8;
                border-color: #3c87c8;
            }
            #zg-quiz-master-check:checked::after,
            #zg-master-check:checked::after {
                content: "";
                position: absolute;
                left: 5px;
                top: 2px;
                width: 4px;
                height: 8px;
                border: solid #ffffff;
                border-width: 0 2px 2px 0;
                transform: rotate(45deg);
                box-sizing: border-box;
            }
            #zg-quiz-master-check:indeterminate::after,
            #zg-master-check:indeterminate::after {
                content: "";
                position: absolute;
                left: 3px;
                top: 7px;
                width: 8px;
                height: 2px;
                background: #3c87c8;
                border: none;
                transform: none;
                box-sizing: border-box;
            }
            #quizTable tbody input[name="quizList"],
            #subjectTable tbody tr td:first-child input[type="checkbox"] {
                appearance: none;
                -webkit-appearance: none;
                -moz-appearance: none;
                margin: 0;
                cursor: pointer;
                width: 16px;
                height: 16px;
                border: 1px solid #b6c2cf;
                border-radius: 3px;
                background: #ffffff;
                display: inline-block;
                vertical-align: middle;
                position: relative;
                outline: none;
                box-sizing: border-box;
            }
            #quizTable tbody input[name="quizList"]:checked,
            #subjectTable tbody tr td:first-child input[type="checkbox"]:checked {
                background: #3c87c8;
                border-color: #3c87c8;
            }
            #quizTable tbody input[name="quizList"]:checked::after,
            #subjectTable tbody tr td:first-child input[type="checkbox"]:checked::after {
                content: "";
                position: absolute;
                left: 5px;
                top: 2px;
                width: 4px;
                height: 8px;
                border: solid #ffffff;
                border-width: 0 2px 2px 0;
                transform: rotate(45deg);
                box-sizing: border-box;
            }
            #quizTable tbody div.checker,
            #subjectTable tbody div.checker {
                display: inline-block;
                vertical-align: middle;
                width: 16px;
                height: 16px;
            }
            #quizTable tbody div.checker span,
            #subjectTable tbody div.checker span {
                display: inline-block;
                position: relative;
                width: 16px;
                height: 16px;
                background: #ffffff !important;
                border: 1px solid #b6c2cf !important;
                border-radius: 3px;
                box-sizing: border-box;
                text-align: center;
            }
            #quizTable tbody div.checker span.checked,
            #subjectTable tbody div.checker span.checked {
                background: #3c87c8 !important;
                border-color: #3c87c8 !important;
            }
            #quizTable tbody div.checker span.checked::after,
            #subjectTable tbody div.checker span.checked::after {
                content: "";
                position: absolute;
                left: 5px;
                top: 2px;
                width: 4px;
                height: 8px;
                border: solid #ffffff;
                border-width: 0 2px 2px 0;
                transform: rotate(45deg);
                box-sizing: border-box;
            }
        `;
        document.head.appendChild(style);
    }
    injectSharedStyles();

    const SCRIPT_VERSION = (typeof GM !== 'undefined' && GM.info?.script?.version) || (typeof GM_info !== 'undefined' && GM_info?.script?.version) || '27.6';
    let availableSheets = [];
    let cancelDownloadRequested = false;
    const STORAGE_KEY_MAPPINGS = 'zipgrade_toolkit_saved_mappings';
    let hasSortedQuizzesInitially = false;

    // TTL de caché para no refetchear en cada recarga de /quizzes/
    const ZG_STATUS_CACHE_TTL_MS = 5 * 60 * 1000;       // escaneados por quiz (páginas /all/ pesadas)
    const ZG_CLASSMAP_CACHE_TTL_MS = 10 * 60 * 1000;    // mapa clase -> nº de estudiantes
    const ZG_FORMATS_CACHE_TTL_MS = 60 * 60 * 1000;     // formatos de exportación por quiz (Descarga Rápida)

    function zgCacheGet(key, ttlMs) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const obj = JSON.parse(raw);
            if (obj && obj.ts && (Date.now() - obj.ts) < ttlMs) return obj.v;
            return null;
        } catch (e) {
            return null;
        }
    }

    function zgCacheSet(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify({ ts: Date.now(), v: value }));
        } catch (e) {
            /* ignore */
        }
    }

    // Caché en memoria del HTML de páginas pesadas (/all/ y /edit/): la columna Estado
    // ya descarga cada /all/ en segundo plano; al abrir los modales de copiar/editar se
    // reutiliza ese HTML en vez de descargarlo de nuevo (abre el modal al instante).
    // TTL amplio: reabrir un modal dentro de la misma sesión no vuelve a pedir la página.
    const ZG_RAW_PAGE_TTL_MS = 30 * 60 * 1000;
    const ZG_RAW_PAGE_MAX = 200;
    const zgRawPageCache = new Map();

    function zgRawPageGet(url) {
        const e = zgRawPageCache.get(url);
        if (e && (Date.now() - e.ts) < ZG_RAW_PAGE_TTL_MS) return e.html;
        return null;
    }

    function zgRawPageSet(url, html) {
        if (!url || html == null) return;
        zgRawPageCache.set(url, { html, ts: Date.now() });
        if (zgRawPageCache.size > ZG_RAW_PAGE_MAX) {
            const oldest = zgRawPageCache.keys().next().value;
            if (oldest) zgRawPageCache.delete(oldest);
        }
    }

    // Caché GLOBAL de la lista de clases (roster): es la misma para todos los quizzes y
    // rara vez cambia, así que se guarda 24 h en localStorage y los modales no la vuelven
    // a pedir (evita descargar la página /edit/ pesada por cada modal abierto).
    const ZG_CLASSES_CACHE_KEY = 'zg_classes_cache';
    const ZG_CLASSES_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

    function zgClassesGet() {
        try {
            const raw = localStorage.getItem(ZG_CLASSES_CACHE_KEY);
            if (!raw) return null;
            const o = JSON.parse(raw);
            if (o && o.ts && (Date.now() - o.ts) < ZG_CLASSES_CACHE_TTL_MS) return o.v;
            return null;
        } catch (e) {
            return null;
        }
    }

    function zgClassesSet(items) {
        if (!Array.isArray(items) || items.length === 0) return;
        try {
            localStorage.setItem(ZG_CLASSES_CACHE_KEY, JSON.stringify({ ts: Date.now(), v: items }));
        } catch (e) { /* ignore */ }
    }

    // Extrae la lista de clases de una página /edit/ (li > input[name="classList"] + label)
    function extractClassListFromEditDoc(doc) {
        const items = [];
        const classUl = doc.getElementById('classList');
        if (classUl) {
            classUl.querySelectorAll('li').forEach(li => {
                const input = li.querySelector('input[name="classList"]');
                const label = li.querySelector('label');
                if (input) {
                    items.push({
                        value: input.value,
                        checked: input.checked,
                        text: label ? label.innerText.trim() : input.value
                    });
                }
            });
        }
        return items;
    }

    let zgClassesFetchPromise = null;

    // Devuelve el roster de clases [{value, text}] para los modales.
    // Usa la caché global (24 h); si no existe, descarga la página /edit/ de UN quiz
    // (una sola vez, para todos) y guarda la caché. Si ya hay una descarga en curso,
    // se reutiliza la misma promesa (evita pedir /edit/ dos veces en paralelo).
    async function getQuizClassItems(quizAllBaseUrl) {
        const cached = zgClassesGet();
        if (cached) return cached;
        if (zgClassesFetchPromise) return zgClassesFetchPromise;

        zgClassesFetchPromise = fetchQuizClassRoster(quizAllBaseUrl);
        try {
            return await zgClassesFetchPromise;
        } finally {
            zgClassesFetchPromise = null;
        }
    }

    async function fetchQuizClassRoster(quizAllBaseUrl) {
        const quizIdMatch = quizAllBaseUrl.match(/\/quiz\/([^/]+)\//);
        if (!quizIdMatch) return [];
        const editUrl = `/quiz/${quizIdMatch[1]}/edit/`;

        let html = zgRawPageGet(editUrl);
        if (html === null) {
            const res = await customRequest({ method: 'GET', url: editUrl }, 45000);
            if (res.status !== 200) throw new Error('HTTP ' + res.status);
            html = res.responseText || '';
            zgRawPageSet(editUrl, html);
        }
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const items = extractClassListFromEditDoc(doc).map(item => ({ value: item.value, text: item.text }));
        zgClassesSet(items);
        return items;
    }

    // Precarga la lista de clases en segundo plano (si aún no está cacheada) para que
    // el primer modal de copiar/editar no espere a descargar la página /edit/.
    function warmQuizClassListCache(quizAllBaseUrl) {
        if (zgClassesGet()) return;
        getQuizClassItems(quizAllBaseUrl).catch(() => { /* silencioso: se reintenta al abrir un modal */ });
    }

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
            getNativeClassChecks().forEach(chk => setNativeCheckboxChecked(chk, false));
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
                    setNativeCheckboxChecked(getNativeClassCheckbox(s.closest('tr')), true);
                }
            });
            updateSelectedCounter();
        } catch (e) {
            console.warn("No se pudieron cargar selecciones guardadas", e);
        }
    }

    // Casillas NATIVAS de ZipGrade en la tabla de /classes/ (columna 0). Es la
    // ÚNICA fuente de selección desde que se unificaron los checkboxes del toolkit.
    function getNativeClassCheckbox(row) {
        if (!row) return null;
        return row.querySelector('td:first-child input[type="checkbox"], td input[type="checkbox"]');
    }

    function getNativeClassChecks() {
        return Array.from(document.querySelectorAll('#subjectTable tbody tr'))
            .filter(row => row.querySelector('.zg-row-sheet'))
            .map(getNativeClassCheckbox)
            .filter(Boolean);
    }

    function updateSelectedCounter() {
        const checks = getNativeClassChecks();
        const checkedCount = checks.filter(chk => chk.checked).length;
        const totalCount = checks.length;
        const counterEl = document.getElementById('zg-counter-badge');
        if (counterEl) {
            counterEl.innerText = `${checkedCount} de ${totalCount} marcados`;
            counterEl.classList.toggle('zg-badge-active', checkedCount > 0);
        }
        // Sincronizar el estado del master del toolkit según la selección nativa
        const masterChk = document.getElementById('zg-master-check');
        if (masterChk) {
            masterChk.checked = totalCount > 0 && checkedCount === totalCount;
            masterChk.indeterminate = checkedCount > 0 && checkedCount < totalCount;
            refreshUniformVisual(masterChk);
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

    // Peso de ordenación de la celda "Class" de un quiz.
    // Las clases individuales (1°, 2°, 6-1, ...) van primero por su peso de grado.
    // Los grupos/rangos (1° - 2°, 3° - 5°, ...) van SIEMPRE DESPUÉS de todas las
    // clases normales, ordenados por su grado inicial.
    function getQuizClassWeightFromText(text) {
        if (!text || text === '-') return 99999;
        const clean = text.trim();
        const grades = parseQuizClassGrades(clean);
        if (grades.length > 1) {
            return 50000 + grades[0] * 100;
        }
        const w = extractGradeWeight(clean);
        return w < 99999 ? w : 99999;
    }

    function getQuizClassWeight(row) {
        const cell = row.cells[2];
        if (!cell) return 99999;
        return getQuizClassWeightFromText(cell.innerText.trim());
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

    // Traduce las cabeceras de la tabla de quizzes a español (idempotente).
    // Solo cambia los nodos de texto para conservar la tipografía y estructura
    // original del <th> (spans, clases de ordenación de DataTables, etc.).
    function setHeaderTextPreservingStyle(th, newText) {
        const textNodes = [];
        const walker = document.createTreeWalker(th, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const t = (node.textContent || '').trim();
                return t ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
        });
        while (walker.nextNode()) textNodes.push(walker.currentNode);
        if (textNodes.length === 0) {
            th.textContent = newText;
            return;
        }
        textNodes[0].textContent = newText;
        for (let i = 1; i < textNodes.length; i++) {
            textNodes[i].parentNode.removeChild(textNodes[i]);
        }
    }

    // Fuerza el centrado de TODOS los encabezados de #quizTable directamente
    // como estilo inline, para evitar que DataTables los sobreescriba.
    function centerQuizTableHeaders() {
        const table = document.getElementById('quizTable');
        if (!table) return;
        const theadRow = table.querySelector('thead tr');
        if (!theadRow) return;
        Array.from(theadRow.querySelectorAll('th, td')).forEach(h => {
            h.style.textAlign = 'center';
            h.style.verticalAlign = 'middle';
            h.style.paddingRight = '0px';
            h.querySelectorAll('h1, h2, h3, h4, h5, h6, span, div, p, a').forEach(child => {
                child.style.textAlign = 'center';
            });
        });
    }

    function translateQuizHeaders() {
        const table = document.getElementById('quizTable');
        if (!table) return;
        const theadRow = table.querySelector('thead tr');
        if (!theadRow) return;

        const headerMap = {
            'quiz name': 'Nombre',
            'quizzes': 'Evaluaciones',
            'name': 'Nombre',
            'class': 'Clase',
            'questions': 'Preguntas',
            'date': 'Fecha',
            'folder': 'Carpeta'
        };

        Array.from(theadRow.querySelectorAll('th, td')).forEach(h => {
            const orig = h.dataset.zgOrigHeader;
            const text = (orig || h.innerText).trim();
            if (!text) return;
            if (!orig) h.dataset.zgOrigHeader = text;
            const key = text.toLowerCase();
            const target = headerMap[key];
            if (target && h.innerText.trim() !== target) setHeaderTextPreservingStyle(h, target);
        });

        // Forzar centrado inline en todos los encabezados después de traducir
        centerQuizTableHeaders();
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
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <button id="zg-btn-quiz-copy-selected" style="background:#f59e0b; color:#ffffff; border:none; padding:8px 18px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 4px rgba(245,158,11,0.25); transition:all 0.2s;">
                            <i class="fa fa-copy"></i> Copiar Seleccionados
                        </button>
                        <button id="zg-btn-quiz-download-selected" style="background:#2563eb; color:#ffffff; border:none; padding:8px 22px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 4px rgba(37,99,235,0.2); transition:all 0.2s;">
                            <i class="fa fa-download"></i> Descargar Resultados
                        </button>
                    </div>
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
                    <div style="display:flex; justify-content:flex-end;">
                        <button id="zg-quiz-btn-stop" style="background:#ef4444; color:#ffffff; border:none; padding:4px 14px; border-radius:6px; font-size:11px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
                            <i class="fa fa-stop"></i> Detener
                        </button>
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

        // Botones Seleccionar/Deseleccionar Todo (operan sobre las casillas NATIVAS de la tabla)
        const btnSelAll = document.getElementById('zg-quiz-btn-select-all');
        const btnDeselAll = document.getElementById('zg-quiz-btn-deselect-all');
        if (btnSelAll && !btnSelAll.dataset.zgBound) {
            btnSelAll.dataset.zgBound = 'true';
            btnSelAll.addEventListener('click', (e) => {
                e.preventDefault();
                setAllNativeQuizChecks(true);
                const masterChk = document.getElementById('zg-quiz-master-check');
                if (masterChk) masterChk.checked = true;
                const nativeMaster = document.querySelector('#selecctall');
                if (nativeMaster) setNativeCheckboxChecked(nativeMaster, true);
                updateQuizResultsCounter();
            });
        }
        if (btnDeselAll && !btnDeselAll.dataset.zgBound) {
            btnDeselAll.dataset.zgBound = 'true';
            btnDeselAll.addEventListener('click', (e) => {
                e.preventDefault();
                setAllNativeQuizChecks(false);
                const masterChk = document.getElementById('zg-quiz-master-check');
                if (masterChk) masterChk.checked = false;
                const nativeMaster = document.querySelector('#selecctall');
                if (nativeMaster) setNativeCheckboxChecked(nativeMaster, false);
                updateQuizResultsCounter();
            });
        }

        // Botón Copiar Seleccionados (lote)
        const copySelBtn = document.getElementById('zg-btn-quiz-copy-selected');
        if (copySelBtn && !copySelBtn.dataset.zgBound) {
            copySelBtn.dataset.zgBound = 'true';
            copySelBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await showBulkCopyQuizModal();
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
        const cached = zgCacheGet('zg_class_map', ZG_CLASSMAP_CACHE_TTL_MS);
        if (cached) {
            zgClassStudentCountCache = cached;
            return cached;
        }
        const map = {};
        let ok = false;
        try {
            const res = await customRequest({ method: 'GET', url: 'https://www.zipgrade.com/classes/' }, 30000);
            if (res.status === 200) {
                ok = true;
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
        if (ok) {
            zgClassStudentCountCache = map;
            zgCacheSet('zg_class_map', map);
        }
        return map;
    }

    function getQuizRowClassText(row) {
        // En DataTables de quizTable:
        // Columna 0: Checkbox (celda <td>, NO <th>)
        // Columna 1: Folder
        // Columna 2: Class
        // Buscar la celda de cabecera "Class"/"Clase" incluyendo <td> y <th> para que el
        // índice coincida con row.cells (que incluye la celda del checkbox).
        const table = row.closest('table');
        if (table) {
            const theadRow = table.querySelector('thead tr');
            if (theadRow) {
                const headers = Array.from(theadRow.querySelectorAll('th, td'));
                const classIdx = headers.findIndex(h => {
                    const txt = h.innerText.toLowerCase();
                    return txt.includes('class') || txt.includes('clase');
                });
                if (classIdx !== -1 && row.cells[classIdx]) {
                    return row.cells[classIdx].innerText.trim();
                }
            }
        }
        const cell = row.cells[2];
        if (!cell) return '';
        return cell.innerText.trim();
    }

    // Obtiene papers escaneados de la página /all/ del quiz (con caché para no refetchear).
    // bypassCache: recarga forzada (botón de refresco) ignorando la caché de estado.
    async function fetchQuizStatus(quizAllBaseUrl, bypassCache) {
        const quizId = (quizAllBaseUrl.match(/\/quiz\/([^/]+)\/all\//) || [])[1];
        const cacheKey = quizId ? 'zg_status_' + quizId : null;
        if (cacheKey && !bypassCache) {
            const cached = zgCacheGet(cacheKey, ZG_STATUS_CACHE_TTL_MS);
            if (cached !== null && cached !== undefined) return cached;
        }
        try {
            const res = await customRequest({ method: 'GET', url: quizAllBaseUrl }, 30000);
            if (res.status !== 200) return null;
            const html = res.responseText || '';
            zgRawPageSet(quizAllBaseUrl, html);
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const scanned = parseScannedCount(doc, quizId);
            const result = { scanned };
            if (cacheKey) zgCacheSet(cacheKey, result);
            return result;
        } catch (e) {
            return null;
        }
    }

    // Cuenta los papers escaneados en el HTML de la página /all/ del quiz.
    // Prioridad: fila "Number of Papers:" del resumen -> etiqueta dentro de un contenedor
    // -> DataTables info de #gradedPapers -> conteo de filas reales.
    // Se usa DOM (no regex sobre todo el HTML) para NO capturar el conteo de otras tablas
    // de la misma página (eso daba "1/17" cuando el quiz real tenía "0/17").
    function parseScannedCount(doc, quizId) {
        const labelRe = /^number\s+of\s+papers:?\s*$/i;

        // 1) Resumen del quiz: celda etiqueta "Number of Papers:" + celda valor siguiente
        const cells = Array.from(doc.querySelectorAll('td'));
        for (const td of cells) {
            if (!labelRe.test((td.textContent || '').trim())) continue;
            const next = td.nextElementSibling;
            if (!next) continue;
            const m = (next.textContent || '').match(/\d+/);
            if (m) {
                const val = parseInt(m[0], 10);
                console.debug('🔍 [ZipGrade] Estado ' + quizId + ' desde fila "Number of Papers": ' + val);
                return val;
            }
        }

        // 2) Respaldo: etiqueta y número en el mismo contenedor (si el HTML no usa fila + celda)
        const anyEls = Array.from(doc.querySelectorAll('td, th, div, p, span, h4, h5'));
        for (const el of anyEls) {
            if (!labelRe.test((el.textContent || '').trim())) continue;
            const parent = el.parentElement;
            if (!parent) continue;
            const m = (parent.textContent || '').match(/number\s+of\s+papers:?\s*([\d,]+)/i);
            if (m) {
                const val = parseInt(m[1].replace(/,/g, ''), 10);
                console.debug('🔍 [ZipGrade] Estado ' + quizId + ' desde contenedor: ' + val);
                return val;
            }
        }

        // 3) DataTables info de la tabla de papers escaneados (#gradedPapers)
        const table = doc.getElementById('gradedPapers');
        if (table) {
            const wrapper = table.closest('.dataTables_wrapper');
            const info = wrapper ? wrapper.querySelector('.dataTables_info') : null;
            if (info) {
                const m = (info.textContent || '').match(/of\s+([\d,]+)\s+entries?/i);
                if (m) {
                    const val = parseInt(m[1].replace(/,/g, ''), 10);
                    console.debug('🔍 [ZipGrade] Estado ' + quizId + ' desde dataTables_info: ' + val);
                    return val;
                }
            }
        }

        // 4) Último recurso: contar filas reales de #gradedPapers (0 si no hay tabla)
        if (table) {
            const rows = Array.from(table.querySelectorAll('tbody tr'))
                .filter(r => !/no data|no records|there are no/i.test(r.textContent || ''));
            console.debug('🔍 [ZipGrade] Estado ' + quizId + ' desde filas de #gradedPapers: ' + rows.length);
            return rows.length;
        }
        return 0;
    }

    // Obtiene el número total de estudiantes de la clase de un quiz según el mapa de /classes/
    function getQuizClassStudentCount(quizClassText, classMap) {
        if (!quizClassText || !classMap) return 0;
        const quizClassNorm = normalizeClassName(quizClassText);

        // 1. Coincidencia exacta de nombre en /classes/ (aunque la clase tenga 0 alumnos):
        //    si el quiz pertenece a esa clase exacta, ese es el total (no se trata como rango).
        for (const [clsName, count] of Object.entries(classMap)) {
            if (normalizeClassName(clsName) === quizClassNorm) {
                return count;
            }
        }

        // 2. Solo si no hay una clase exacta con ese nombre, intentar resolver como rango
        //    sumando los estudiantes de las clases individuales correspondientes.
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

    // Limpia la caché de estado de todos los quizzes (para forzar la recarga)
    function clearQuizStatusCache() {
        try {
            const toRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.indexOf('zg_status_') === 0) toRemove.push(k);
            }
            toRemove.forEach(k => localStorage.removeItem(k));
        } catch (e) { /* ignore */ }
        zgRawPageCache.clear();
    }

    // Refresca el estado (papers escaneados) de todos los quizzes de la tabla sin recargar la página.
    // Se encola detrás de cualquier carga de Estado en curso (initQuizStatusColumn ya está en cadena).
    async function refreshQuizStatuses() {
        const btn = document.querySelector('.zg-status-refresh-btn');
        if (btn && btn.dataset.zgRefreshing === '1') return;
        if (btn) {
            btn.dataset.zgRefreshing = '1';
            btn.disabled = true;
            btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';
        }
        try {
            clearQuizStatusCache();
            await initQuizStatusColumn(true);
            showZgToast('Estados actualizados', 'success');
        } catch (err) {
            console.error('❌ [ZipGrade] Error al refrescar los estados:', err);
            showZgToast('Error al refrescar los estados', 'error');
        } finally {
            if (btn) {
                delete btn.dataset.zgRefreshing;
                btn.disabled = false;
                btn.innerHTML = '<i class="fa fa-refresh"></i>';
            }
        }
    }

    // El botón ⟳ de "Estado" se maneja por delegación en document: funciona aunque
    // DataTables re-construya la cabecera y el <th>/botón original se reemplace.
    function setupQuizStatusRefreshButton() {
        if (window._zgStatusRefreshBtn) return;
        window._zgStatusRefreshBtn = true;
        document.addEventListener('click', (e) => {
            const btn = e.target && e.target.closest ? e.target.closest('.zg-status-refresh-btn') : null;
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            refreshQuizStatuses();
        });
    }

    // Promesa que resuelve cuando cargan los formatos de la columna "Descarga Rápida"
    // (peticiones ligeras); la columna Estado espera por ellas antes de descargar las
    // páginas /all/ pesadas para que los formatos llenen TODOS los quizzes a la vez.
    let zgFormatsLoadPromise = null;

    // Bandera global de cancelación para la descarga masiva de resultados.
    let zgQuizDownloadCancelRequested = false;

    // La sincronización de la selección nativa se registra una sola vez.
    let zgNativeSyncBound = false;

    // Idem para la tabla de /classes/ (subjectTable).
    let zgClassesNativeSyncBound = false;

    // La columna Estado se ejecuta en CADENA: si ya hay una carga en curso (p.ej. los
    // reintentos de 0/400/1000ms y los redibujos de DataTables), se encola en vez de
    // lanzar OTRO bucle concurrente. Antes se disparaban 2-3 bucles a la vez y se
    // descargaban las mismas páginas /all/ varias veces, por eso todo cargaba "uno a uno".
    let zgStatusRunChain = Promise.resolve();

    function initQuizStatusColumn(force) {
        const run = zgStatusRunChain.then(() => initQuizStatusColumnNow(force));
        zgStatusRunChain = run.catch(() => { });
        return run;
    }

    async function initQuizStatusColumnNow(force) {
        const table = document.getElementById('quizTable');
        if (!table) return;

        // TH "Estado" antes de "Descarga Rápida" (si existe Descarga Rápida), con botón de refresco
        const theadRow = table.querySelector('thead tr');
        if (theadRow && !theadRow.querySelector('.zg-status-th')) {
            const th = document.createElement('th');
            th.className = 'text-center zg-status-th sorting_disabled';
            th.style.cssText = 'vertical-align:middle; text-align:center; width:90px; color:#ffffff;';
            th.innerHTML = `
                <div style="display:inline-flex; align-items:center; gap:6px;">
                    <span style="font-family:'Open Sans', sans-serif; font-weight:300; font-size:17px; line-height:19px; color:#ffffff;">Estado</span>
                    <button type="button" class="zg-status-refresh-btn" title="Actualizar el estado de todos los quizzes" style="background:none; border:none; padding:0; margin:0; cursor:pointer; color:#cbd5e1; font-size:13px; line-height:1;">
                        <i class="fa fa-refresh"></i>
                    </button>
                </div>
            `;
            const resultsTh = theadRow.querySelector('.zg-quiz-th');
            if (resultsTh) {
                theadRow.insertBefore(th, resultsTh);
            } else {
                theadRow.appendChild(th);
            }
            // El click del botón se maneja por DELEGACIÓN en document (setupQuizStatusRefreshButton),
            // así sobrevive a cualquier redibujado de la cabecera por DataTables.
        }

        // Insertar la celda "Estado" de forma SÍNCRONA (antes de cualquier await)
        // para que la columna nunca quede desalineada respecto a "Descarga Rápida".
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
        }

        // Refresco forzado: marcar todas las filas como pendientes y volver a cargar
        if (force) {
            rows.forEach(r => {
                const t = r.querySelector('.zg-status-td');
                if (t) {
                    t.dataset.zgStatusDone = 'false';
                    t.innerHTML = '<i class="fa fa-spinner fa-spin" style="color:#94a3b8;"></i>';
                }
            });
        }

        // Filas que aún necesitan cargar su Estado
        const pending = rows.filter(r => {
            const t = r.querySelector('.zg-status-td');
            return t && t.dataset.zgStatusDone !== 'true';
        });
        if (pending.length === 0) return;

        // Prioridad: esperar a que carguen los formatos de "Descarga Rápida" (ligeros)
        // antes de ocupar la sesión con las páginas /all/ pesadas. Máx. 4 s de espera.
        if (zgFormatsLoadPromise) {
            await Promise.race([
                zgFormatsLoadPromise,
                new Promise(r => setTimeout(r, 4000))
            ]);
        }

        const classMap = await getClassStudentCountMap();
        for (const row of pending) {
            const statusTd = row.querySelector('.zg-status-td');
            if (!statusTd) continue;

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

            const status = await fetchQuizStatus(quizAllBaseUrl, !!force);
            const scanned = status ? status.scanned : 0;
            renderQuizStatusCell(statusTd, scanned, total);
            statusTd.dataset.zgStatusDone = 'true';
        }
    }

    // ==========================================
    // 6.2.2. COLUMNA "ACCIONES" EN /QUIZZES/ (COPIAR / EDITAR QUIZ EN MODAL)
    // ==========================================
    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function cloneSelectOptions(target, source) {
        if (!source) return;
        Array.from(source.options).forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.textContent;
            if (opt.selected) o.selected = true;
            target.appendChild(o);
        });
    }

    function disableQuizCustomColumnsSort() {
        if (typeof window.jQuery === 'undefined' || !window.jQuery.fn || !window.jQuery.fn.DataTable) return;
        const table = document.getElementById('quizTable');
        if (!table || !window.jQuery.fn.DataTable.isDataTable(table)) return;
        try {
            const dt = window.jQuery(table).DataTable();
            const settings = dt.settings()[0];
            if (settings && settings.aoColumns) {
                // Columnas personalizadas: Estado, Descarga Rápida, Acciones y Key
                // La cabecera empieza con un <td> (checkbox), así que contamos TODAS las
                // celdas (th + td) para que el índice coincida con aoColumns / row.cells.
                const customClasses = ['zg-status-th', 'zg-quiz-th', 'zg-actions-th', 'zg-key-th'];
                const theadRow = table.querySelector('thead tr');
                const headers = theadRow ? Array.from(theadRow.querySelectorAll('th, td')) : [];
                const customIdxs = [];
                headers.forEach((h, i) => {
                    if (customClasses.some(c => h.classList.contains(c))) customIdxs.push(i);
                });
                customIdxs.forEach(idx => {
                    const col = settings.aoColumns[idx];
                    if (col && col.bSortable !== false) {
                        col.bSortable = false;
                        col.bSearchable = false;
                        col.aDataSort = [idx];
                        col.orderData = [idx];
                    }
                });
                if (settings.aaSorting && customIdxs.length) {
                    const firstCustom = Math.min(...customIdxs);
                    settings.aaSorting = settings.aaSorting.filter(s => s[0] < firstCustom);
                }
            }
        } catch (e) {
            console.warn("No se pudo desactivar ordenación de las columnas personalizadas:", e);
        }
    }

    function initQuizActionsColumn() {
        const table = document.getElementById('quizTable');
        if (!table) return;

        // Cabecera "Acciones" al final de la tabla (después de "Descarga Rápida")
        const theadRow = table.querySelector('thead tr');
        if (theadRow && !theadRow.querySelector('.zg-actions-th')) {
            const th = document.createElement('th');
            th.className = 'text-center zg-actions-th sorting_disabled';
            th.style.cssText = 'vertical-align:middle; text-align:center; width:100px; color:#ffffff;';
            th.innerHTML = `<span style="font-family:'Open Sans', sans-serif; font-weight:300; font-size:17px; line-height:19px; color:#ffffff;">Acciones</span>`;
            theadRow.appendChild(th);
        }

        // Celdas por fila
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        rows.forEach(row => {
            if (row.querySelector('.zg-actions-td')) return;

            const td = document.createElement('td');
            td.className = 'zg-actions-td';
            td.style.cssText = 'vertical-align:middle; text-align:center; white-space:nowrap;';

            const link = row.querySelector('td a[href*="/quiz/"][href*="/all/"]');
            if (!link) {
                row.appendChild(td);
                return;
            }

            const quizAllBaseUrl = new URL(link.getAttribute('href'), window.location.origin).pathname;
            const quizIdMatch = quizAllBaseUrl.match(/\/quiz\/([^/]+)\//);
            const quizId = quizIdMatch ? quizIdMatch[1] : '';
            const quizName = link.innerText.trim();

            td.innerHTML = `
                <div style="display:inline-flex; gap:6px; align-items:center; justify-content:center;">
                    <button class="zg-btn-quiz-copy btn btn-default btn-xs" style="padding:3px 8px;" title="Copiar quiz (modal)">
                        <i class="fa fa-copy"></i>
                    </button>
                    <button class="zg-btn-quiz-edit btn btn-default btn-xs" style="padding:3px 8px;" title="Editar quiz (modal)">
                        <i class="fa fa-pencil"></i>
                    </button>
                </div>
            `;
            row.appendChild(td);

            td.querySelector('.zg-btn-quiz-copy').addEventListener('click', async (e) => {
                e.preventDefault();
                await showCopyQuizModal(quizAllBaseUrl, quizName);
            });

            td.querySelector('.zg-btn-quiz-edit').addEventListener('click', async (e) => {
                e.preventDefault();
                if (!quizId) {
                    alert('No se pudo identificar el quiz para editar.');
                    return;
                }
                await showEditQuizModal(quizId, quizName);
            });
        });

        disableQuizCustomColumnsSort();
    }

    function cleanFlashHtml(s) {
        return String(s || '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&#39;/g, "'")
            .replace(/&quot;/gi, '"')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(parseInt(d, 10)))
            .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCharCode(parseInt(h, 16)))
            .replace(/[ \t]+/g, ' ')
            .replace(/\n\s*\n+/g, '\n')
            .trim();
    }

    // Extrae el mensaje flash real de la respuesta del servidor.
    // El primer <li> de la página suele ser el menú de usuario, así que se busca
    // 1) el contenedor flash (div/ul con clase o id flash/message/alert/notice/error),
    // 2) el primer <li> que contenga <b> (los flash de ZipGrade usan <b>), prefiriendo
    //    los que mencionen import/SUCCESS/error.
    function extractZipgradeFlash(text) {
        if (!text) return '';
        const container = text.match(/<(?:div|ul|section)[^>]*\b(?:class|id)\s*=\s*["'][^"']*(?:flash|message|alert|notice|error)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|ul|section)>/i);
        if (container) {
            const c = cleanFlashHtml(container[1]);
            if (c) return c;
        }
        const lis = text.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
        let fallback = '';
        for (const li of lis) {
            if (!/<b>/i.test(li)) continue;
            const t = cleanFlashHtml(li);
            if (!t) continue;
            if (/import|SUCCESS|error/i.test(t)) return t;
            if (!fallback) fallback = t;
        }
        if (fallback) return fallback;
        const det = text.match(/following error:?\s*([^<\r\n]{2,})/i);
        return det ? cleanFlashHtml(det[0]) : '';
    }

    // Sube un CSV de key answers usando el endpoint oficial de importación de ZipGrade.
    // Formato CSV (filas del key primario):
    //   Key Version, Question Number, Response, Point Value [, Tags...]
    //   Ej: ,1,A,1  |  ,2,C,1  |  (header opcional que empiece por "Key")
    async function uploadAnswerKeyCsv(quizAllBaseUrl, file) {
        const quizIdMatch = quizAllBaseUrl.match(/\/quiz\/([^/]+)\//);
        const quizId = quizIdMatch ? quizIdMatch[1] : '';
        if (!quizId) throw new Error('No se pudo identificar el quiz.');
        const importUrl = `/quiz/${quizId}/edit/importExport/`;
        const importPostUrl = `${importUrl}import/`;

        const csrfResp = await fetch(importUrl, { credentials: 'same-origin' });
        if (!csrfResp.ok) throw new Error('No se pudo cargar la página de importación (HTTP ' + csrfResp.status + ').');
        const html = await csrfResp.text();
        const tokenTag = html.match(/<input[^>]*\bname=["']csrf_token["'][^>]*>/i);
        const csrf = tokenTag ? ((tokenTag[0].match(/value=["']([^"']*)["']/) || [])[1] || '') : '';

        const fd = new FormData();
        fd.append('file', file);
        fd.append('submit', '');
        if (csrf) fd.append('csrf_token', csrf);

        const resp = await fetch(importPostUrl, { method: 'POST', credentials: 'same-origin', body: fd });
        if (!resp.ok) throw new Error('El servidor respondió HTTP ' + resp.status + '.');
        const text = await resp.text();

        let msg = extractZipgradeFlash(text);
        if (msg) {
            // El flash puede traer solo el texto genérico ("... due to following error")
            // mientras el detalle real aparece después de los dos puntos en la respuesta.
            if (/^Unable to import CSV file due to following error:?\s*$/i.test(msg)) {
                const detailMatch = text.match(/following error:?\s*([^<\r\n]{2,})/i);
                const detail = detailMatch ? cleanFlashHtml(detailMatch[1]) : '';
                if (detail && !/^Unable to import/i.test(detail)) {
                    msg = 'Unable to import CSV file due to following error: ' + detail;
                }
            }
            return { ok: /SUCCESS/i.test(msg), message: msg };
        }
        return { ok: false, message: 'No se pudo confirmar el resultado de la importación.' };
    }

    function showZgToast(message, type) {
        const existing = document.getElementById('zg-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.id = 'zg-toast';
        const bg = type === 'success' ? '#16a34a' : type === 'error' ? '#dc2626' : '#2563eb';
        toast.style.cssText = `position:fixed;top:70px;right:20px;z-index:99999;max-width:400px;min-width:200px;padding:12px 16px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.3);font:13px/1.5 'Open Sans',sans-serif;color:#fff;background:${bg};white-space:pre-wrap;word-break:break-word;cursor:pointer;`;
        toast.textContent = message;
        toast.addEventListener('click', () => toast.remove());
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.transition = 'opacity .4s';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 400);
        }, 8000);
    }

    function cleanKeyFlashMsg(msg) {
        const clean = String(msg == null ? '' : msg).replace(/^(SUCCESS|ERROR|Error|FAILED|FAILURE)\s*:?\s*/i, '').trim();
        const known = {
            'All data from file imported as answer keys for this quiz': 'Claves importadas correctamente'
        };
        return known[clean] || clean;
    }

    // Extrae el JSON `var cQuiz = [...]` incrustado en el script del editor de key,
    // haciendo match balanceado de corchetes. Devuelve el texto JSON o null.
    function extractCQuiz(script) {
        const idx = script.indexOf('var cQuiz =');
        if (idx === -1) return null;
        let i = script.indexOf('[', idx);
        if (i === -1) return null;
        let depth = 0;
        let j = i;
        for (; j < script.length; j++) {
            if (script[j] === '[') depth++;
            else if (script[j] === ']') {
                depth--;
                if (depth === 0) break;
            }
        }
        if (depth !== 0) return null;
        return script.slice(i, j + 1);
    }

    // Detecta si la página del editor de key tiene respuestas cargadas,
    // parseando el JSON `cQuiz` (fuente de verdad del servidor).
    // Devuelve: true = key presente, false = sin key, null = no se pudo determinar.
    function detectQuizKeyInDoc(doc) {
        if (!doc || !doc.body) return null;
        const cQuizJson = Array.from(doc.querySelectorAll('script'))
            .map(s => s.textContent || '')
            .map(extractCQuiz)
            .find(t => t != null);
        if (!cQuizJson) return null;
        try {
            const keys = JSON.parse(cQuizJson);
            if (!Array.isArray(keys)) return null;
            return keys.some(k =>
                Array.isArray(k.keyQuestions) &&
                k.keyQuestions.some(q =>
                    q && Array.isArray(q.answers) &&
                    q.answers.some(a => a && typeof a.ans === 'string' && a.ans.trim() !== '')
                )
            );
        } catch (e) {
            return null;
        }
    }

    // Consulta el editor de key de un quiz para saber si tiene respuestas cargadas.
    async function fetchQuizKeyStatus(quizId, diagnose) {
        try {
            const resp = await fetch(`/quiz/${quizId}/edit/key/0/?subjectGuid=all`, { credentials: 'same-origin' });
            if (!resp.ok) {
                if (diagnose) console.info('🔍 [ZipGrade] DIAG key ' + quizId + ': HTTP ' + resp.status);
                return null;
            }
            const html = await resp.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            if (diagnose) {
                const cQuizJson = Array.from(doc.querySelectorAll('script'))
                    .map(s => s.textContent || '')
                    .map(extractCQuiz)
                    .find(t => t != null);
                let summary = 'cQuiz no encontrado';
                if (cQuizJson) {
                    try {
                        const keys = JSON.parse(cQuizJson);
                        const answered = keys.filter(k => (k.keyQuestions || []).some(q => (q.answers || []).some(a => a && (a.ans || '').trim() !== ''))).length;
                        summary = 'keys=' + keys.length + ', keysConRespuestas=' + answered +
                            ', preguntasConRespuesta=' + keys.reduce((n, k) => n + (k.keyQuestions || []).filter(q => (q.answers || []).some(a => a && (a.ans || '').trim() !== '')).length, 0);
                    } catch (pe) {
                        summary = 'cQuiz JSON parse error';
                    }
                }
                console.info('🔍 [ZipGrade] DIAG cQuiz ' + quizId + ': ' + summary);
            }
            return detectQuizKeyInDoc(doc);
        } catch (e) {
            if (diagnose) console.info('🔍 [ZipGrade] DIAG key ' + quizId + ' error:', e);
            console.warn('⚠️ [ZipGrade] No se pudo verificar la key del quiz ' + quizId + ':', e);
            return null;
        }
    }

    // Renderiza el badge de estado de la key en la celda.
    function renderKeyStatus(el, state) {
        if (state === true) {
            el.textContent = '✔ Key';
            el.style.color = '#10b981';
            el.title = 'Key cargada';
        } else if (state === false) {
            el.textContent = '✘ Sin key';
            el.style.color = '#ef4444';
            el.title = 'No hay key cargada';
        } else {
            el.textContent = '?';
            el.style.color = '#94a3b8';
            el.title = 'No se pudo verificar la key';
        }
    }

    // Columna "Key" en /quizzes/: subir las key answers (respuestas correctas) en CSV por quiz
    function initQuizKeyColumn() {
        const table = document.getElementById('quizTable');
        if (!table) return;
        const jobs = [];

        const theadRow = table.querySelector('thead tr');
        if (theadRow && !theadRow.querySelector('.zg-key-th')) {
            const th = document.createElement('th');
            th.className = 'text-center zg-key-th sorting_disabled';
            th.style.cssText = 'vertical-align:middle; text-align:center; width:90px; color:#ffffff;';
            th.innerHTML = `<span style="font-family:'Open Sans', sans-serif; font-weight:300; font-size:17px; line-height:19px; color:#ffffff;">Key</span>`;
            theadRow.appendChild(th);
        }

        const rows = Array.from(table.querySelectorAll('tbody tr'));
        rows.forEach(row => {
            if (row.querySelector('.zg-key-td')) return;

            const td = document.createElement('td');
            td.className = 'zg-key-td';
            td.style.cssText = 'vertical-align:middle; text-align:center; white-space:nowrap;';

            const link = row.querySelector('td a[href*="/quiz/"][href*="/all/"]');
            if (!link) {
                row.appendChild(td);
                return;
            }
            const quizAllBaseUrl = new URL(link.getAttribute('href'), window.location.origin).pathname;

            const quizIdMatch = quizAllBaseUrl.match(/\/quiz\/([^/]+)\//);
            const quizId = quizIdMatch ? quizIdMatch[1] : '';

            td.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <button class="zg-btn-quiz-key btn btn-default btn-xs" style="padding:3px 8px;" title="Subir key answers (CSV)">
                        <i class="fa fa-upload"></i> Key
                    </button>
                    <input type="file" class="zg-key-file" accept=".csv,text/csv" style="display:none;" />
                    <a class="zg-key-view" href="${quizId ? `/quiz/${quizId}/edit/key/0/?subjectGuid=all` : '#'}" target="_blank" rel="noopener" title="Ver key answers (nueva pestaña)" style="font-size:10px; color:#2563eb; text-decoration:underline; cursor:pointer; line-height:1.2;">Ver key ↪</a>
                    <span class="zg-key-status" style="font-size:10px; color:#64748b; line-height:1.2; max-width:130px; word-break:break-word; overflow-wrap:anywhere; text-align:center;"></span>
                </div>
            `;
            row.appendChild(td);

            const btn = td.querySelector('.zg-btn-quiz-key');
            const fileInput = td.querySelector('.zg-key-file');
            const statusEl = td.querySelector('.zg-key-status');
            statusEl.textContent = '↻';
            statusEl.title = 'Verificando key...';

            if (quizId) jobs.push({ statusEl, quizId });

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                fileInput.value = '';
                fileInput.click();
            });

            fileInput.addEventListener('change', async () => {
                const file = fileInput.files && fileInput.files[0];
                if (!file) return;
                btn.disabled = true;
                btn.style.opacity = '0.5';
                statusEl.textContent = 'Subiendo...';
                statusEl.style.color = '#2563eb';
                try {
                    const result = await uploadAnswerKeyCsv(quizAllBaseUrl, file);
                    if (result.ok) {
                        renderKeyStatus(statusEl, true);
                        showZgToast('✔ Claves importadas correctamente.', 'success');
                    } else {
                        const errMsg = cleanKeyFlashMsg(result.message);
                        statusEl.title = errMsg;
                        showZgToast('✘ ' + errMsg, 'error');
                    }
                } catch (err) {
                    const errMsg = err.message || 'Error desconocido';
                    statusEl.title = errMsg;
                    showZgToast('✘ ' + errMsg, 'error');
                } finally {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    fileInput.value = '';
                }
            });
        });

        // Verificar el estado de la key de cada quiz con un pool de peticiones limitado
        let jobIndex = 0;
        let zgKeyDiagnosed = false;
        const POOL = 4;
        async function keyWorker() {
            while (jobIndex < jobs.length) {
                const job = jobs[jobIndex++];
                const diagnose = !zgKeyDiagnosed;
                zgKeyDiagnosed = true;
                const state = await fetchQuizKeyStatus(job.quizId, diagnose);
                renderKeyStatus(job.statusEl, state);
            }
        }
        for (let i = 0; i < POOL && i < jobs.length; i++) keyWorker();

        disableQuizCustomColumnsSort();
    }

    // Carga el formulario de copia real de ZipGrade (campos + CSRF) para un quiz.
    // Reutiliza la página /all/ cacheada por la columna Estado si está disponible.
    // Devuelve { formAction, formFields, csrfToken, sourceDateIso, formClassValues }.
    async function loadQuizCopyForm(quizAllBaseUrl) {
        let html = zgRawPageGet(quizAllBaseUrl);
        if (html === null) {
            const res = await customRequest({ method: 'GET', url: quizAllBaseUrl }, 45000);
            if (res.status !== 200) throw new Error('HTTP ' + res.status);
            html = res.responseText || '';
            zgRawPageSet(quizAllBaseUrl, html);
        }
        const doc = new DOMParser().parseFromString(html, 'text/html');

        let formAction = null;
        const formFields = {};
        const formClassValues = [];
        let csrfToken = '';
        let sourceDateIso = null;

        // Reutilizar el formulario de copia real de ZipGrade (campos + CSRF)
        const form = doc.querySelector('form[action*="/quizzes/copyQuiz/"]');
        if (form) {
            formAction = form.getAttribute('action') || '/quizzes/copyQuiz/';
            form.querySelectorAll('input, select, textarea').forEach(inp => {
                if (!inp.name) return;
                if (inp.type === 'checkbox' || inp.type === 'radio') {
                    if (inp.name === 'classList') {
                        // Guardar todos los values de classList para referencia (el form de copia los lista todos)
                        formClassValues.push(inp.value);
                        return;
                    }
                    if (inp.checked) formFields[inp.name] = inp.value;
                    return;
                }
                formFields[inp.name] = inp.value;
            });
        }
        csrfToken = extractCSRFToken(doc);

        // Fecha del quiz origen para heredarla en la copia
        const tds = Array.from(doc.querySelectorAll('td'));
        for (let i = 0; i < tds.length; i++) {
            if (tds[i].innerText.trim() === 'Date:') {
                const valTd = tds[i].nextElementSibling;
                if (valTd) {
                    const parsed = parseEnglishDate(valTd.dataset.originalDate || valTd.innerText.trim());
                    if (parsed) sourceDateIso = parsed;
                }
                break;
            }
        }

        if (!formAction) throw new Error('No se encontró el formulario de copia de este quiz.');

        delete formFields['newQuizName'];
        delete formFields['classList'];
        if (csrfToken && !formFields['csrf_token']) formFields['csrf_token'] = csrfToken;

        return { formAction, formFields, csrfToken, sourceDateIso, formClassValues };
    }

    // Modal para copiar un quiz desde la tabla /quizzes/
    async function showCopyQuizModal(quizAllBaseUrl, quizName) {
        let formAction = null;
        const formFields = {};
        let csrfToken = '';
        let sourceDateIso = null;
        const classItems = [];
        const formClassValues = [];

        let suggestedName = (adjustQuizNameFormat(quizName.trim()) || quizName.trim()) + ' copy';
        // Quitar la palabra "Template" del inicio del nombre sugerido
        suggestedName = suggestedName.replace(/^\s*Template\s+/i, '').replace(/\s+/g, ' ').trim();

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:99999; display:flex; align-items:center; justify-content:center;';
        const modal = document.createElement('div');
        modal.style.cssText = 'background:#fff; border-radius:12px; padding:20px 24px; width:480px; max-width:94vw; box-shadow:0 20px 50px rgba(0,0,0,0.35); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
        modal.innerHTML = `
            <h4 style="margin:0 0 6px 0; font-size:15px; font-weight:700; color:#1e293b;"><i class="fa fa-copy"></i> Copiar quiz</h4>
            <p style="margin:0 0 14px 0; font-size:12px; color:#64748b;">Se crearán copias de "<strong style="color:#334155;">${escapeHtml(quizName)}</strong>".<br />En cada fila marca una o varias clases: se crea una copia por cada clase marcada, insertando el curso de la clase en el nombre (ej: "E.S.A. | 601 | P3 | S1").<br />Si no marcas ninguna clase, se crea una sola copia con el nombre tal cual.</p>
            <div style="display:flex; flex-direction:column; gap:12px;">
                <div>
                    <label style="display:block; font-weight:600; font-size:12px; color:#334155; margin:0 0 6px 0;">Copias a crear:</label>
                    <div id="zg-copy-slots" style="display:flex; flex-direction:column; gap:8px; max-height:300px; overflow-y:auto;"></div>
                </div>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
                <button id="zg-copy-cancel" class="btn btn-default btn-sm" style="border-radius:6px;">Cancelar</button>
                <button id="zg-copy-accept" class="btn btn-primary btn-sm" style="border-radius:6px;"><i class="fa fa-copy"></i> Copiar</button>
            </div>
        `;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const acceptBtn = modal.querySelector('#zg-copy-accept');
        const cancelBtn = modal.querySelector('#zg-copy-cancel');
        const slotsBox = modal.querySelector('#zg-copy-slots');

        // Crea una fila de copia: nombre + clases respectivas (marca varias, se crea una copia por clase)
        const createCopySlot = (nameValue, index, classesHtml) => {
            const slot = document.createElement('div');
            slot.className = 'zg-copy-slot';
            slot.style.cssText = 'display:flex; flex-direction:column; gap:6px; border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px; background:#f8fafc;';
            slot.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
                    <label style="font-weight:600; font-size:11px; color:#334155; margin:0;">Copia ${index + 1}</label>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label class="zg-copy-slot-auto-next-label" style="display:flex; align-items:center; gap:5px; font-size:11px; color:#7c3aed; font-weight:600; cursor:pointer; white-space:nowrap;" title="Marca automáticamente la clase siguiente a la del quiz">
                            <input type="checkbox" class="zg-copy-slot-auto-next" style="margin:0; accent-color:#7c3aed; cursor:pointer;" />
                            &#10024; Auto-siguiente
                        </label>
                        <button type="button" class="zg-copy-slot-remove btn btn-default btn-xs" style="padding:1px 7px; font-size:11px; border-radius:4px;" title="Quitar esta copia">✕</button>
                    </div>
                </div>
                <input type="text" class="zg-copy-slot-name" value="${escapeHtml(nameValue)}" placeholder="Nombre de la copia" style="width:100%; box-sizing:border-box; padding:5px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;" />
                <div class="zg-copy-slot-classes-box" style="max-height:120px; overflow-y:auto; border:1px solid #cbd5e1; border-radius:6px; background:#fff; padding:6px 10px;">
                    ${classesHtml}
                </div>
                <div class="zg-copy-slot-preview" style="display:none; background:#eef2ff; border:1px solid #c7d2fe; border-radius:6px; padding:8px 10px; font-size:11px; color:#3730a3; line-height:1.6;"></div>
            `;
            slot.querySelector('.zg-copy-slot-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') acceptBtn.click(); });
            slot.querySelector('.zg-copy-slot-remove').addEventListener('click', () => {
                slot.remove();
                renumberCopySlots();
            });
            const classesBox = slot.querySelector('.zg-copy-slot-classes-box');
            const nameInp = slot.querySelector('.zg-copy-slot-name');
            const previewEl = slot.querySelector('.zg-copy-slot-preview');

            // Previsualizar los títulos cuando hay varias clases marcadas:
            // se crea una copia individual por cada clase, con su nombre de clase en el título.
            const updateCopySlotPreview = () => {
                const checked = Array.from(classesBox.querySelectorAll('input.zg-copy-slot-class:checked'));
                if (checked.length <= 1) {
                    previewEl.style.display = 'none';
                    return;
                }
                const baseName = nameInp.value.trim();
                if (!baseName) {
                    previewEl.style.display = 'none';
                    return;
                }
                const names = checked.map(cb => {
                    const labelText = cb.parentElement ? cb.parentElement.textContent.trim() : cb.value;
                    return updateQuizNameGrade(baseName, labelText);
                });
                previewEl.style.display = 'block';
                previewEl.innerHTML = `
                    <div style="font-weight:700; margin-bottom:4px;">Se crearán ${names.length} copias individuales:</div>
                    ${names.map(n => `<div>• <span style="font-weight:600;">${escapeHtml(n)}</span></div>`).join('')}
                `;
            };

            // Al marcar UNA clase, poner el nombre de la clase tal cual dentro del nombre.
            // Si el cambio viene del auto-siguiente, no resetear ese checkbox.
            classesBox.addEventListener('change', () => {
                const autoNextChk = slot.querySelector('.zg-copy-slot-auto-next');
                if (!slot._suppressAutoNextReset && autoNextChk) autoNextChk.checked = false;
                const checked = Array.from(classesBox.querySelectorAll('input.zg-copy-slot-class:checked'));
                if (checked.length === 1) {
                    const labelText = checked[0].parentElement ? checked[0].parentElement.textContent.trim() : '';
                    if (labelText) nameInp.value = updateQuizNameGrade(nameInp.value, labelText);
                }
                updateCopySlotPreview();
            });
            nameInp.addEventListener('input', updateCopySlotPreview);
            return slot;
        };

        const renumberCopySlots = () => {
            Array.from(slotsBox.querySelectorAll('.zg-copy-slot')).forEach((slot, i) => {
                const lbl = slot.querySelector('label');
                if (lbl) lbl.textContent = `Copia ${i + 1}`;
            });
        };

        // Primera fila por defecto: el modal se muestra al instante con las clases "cargando"
        slotsBox.appendChild(createCopySlot(suggestedName, 0,
            '<div style="padding:8px; font-size:12px; color:#64748b;"><i class="fa fa-spinner fa-spin"></i> Cargando clases...</div>'
        ));

        // El botón Copiar queda bloqueado hasta que cargue la información del quiz
        acceptBtn.disabled = true;
        acceptBtn.style.opacity = '0.5';
        acceptBtn.title = 'Cargando información del quiz...';

        const cleanup = () => overlay.remove();
        cancelBtn.addEventListener('click', cleanup);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });
        const firstSlotName = slotsBox.querySelector('.zg-copy-slot-name');
        if (firstSlotName) { firstSlotName.focus(); firstSlotName.select(); }

        acceptBtn.addEventListener('click', async () => {
            if (!formAction) {
                alert('Aún se está cargando la información del quiz. Inténtalo en un momento.');
                return;
            }
            const slots = Array.from(slotsBox.querySelectorAll('.zg-copy-slot'));
            const copies = [];
            for (const slot of slots) {
                const nameVal = slot.querySelector('.zg-copy-slot-name').value.trim();
                if (!nameVal) continue;
                const checked = Array.from(slot.querySelectorAll('input.zg-copy-slot-class:checked'));
                if (checked.length === 0) {
                    copies.push({ name: nameVal, classes: [] });
                } else {
                    // Una copia individual por cada clase marcada
                    for (const cb of checked) {
                        const labelText = cb.parentElement ? cb.parentElement.textContent.trim() : cb.value;
                        copies.push({ name: updateQuizNameGrade(nameVal, labelText), classes: [cb.value] });
                    }
                }
            }

            if (copies.length === 0) {
                alert('Escribe el nombre de al menos una copia.');
                return;
            }

            acceptBtn.disabled = true;
            acceptBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Copiando...';

            // Crear las copias una a una, cada una con su nombre y su clase
            const created = [];
            for (const copy of copies) {
                try {
                    const params = new URLSearchParams();
                    Object.entries(formFields).forEach(([k, v]) => params.append(k, v));
                    params.append('newQuizName', copy.name);
                    copy.classes.forEach(c => params.append('classList', c));

                    const saveResp = await fetch(formAction, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: params.toString(),
                        credentials: 'include'
                    });

                    if (!saveResp.ok) {
                        console.warn('⚠️ [ZipGrade] No se pudo copiar "' + copy.name + '" (HTTP ' + saveResp.status + ').');
                        continue;
                    }

                    // Si ZipGrade redirige al detalle del nuevo quiz, capturar su id
                    const newQuizMatch = saveResp.url.match(/\/quiz\/([^/]+)\/all\//);
                    created.push({ quizId: newQuizMatch ? newQuizMatch[1] : null, copy });
                } catch (err) {
                    console.error('❌ [ZipGrade] Error al copiar quiz:', err);
                }
                // Pequeña pausa entre copias para no saturar el servidor
                if (copies.length > 1) await new Promise(r => setTimeout(r, 500));
            }

            if (created.length === 0) {
                alert('No se pudo copiar ningún quiz (revisa la consola).');
                acceptBtn.disabled = false;
                acceptBtn.innerHTML = '<i class="fa fa-copy"></i> Copiar';
                return;
            }

            // Heredar la fecha original y aplicar la clase de cada copia vía el endpoint de edición
            // (el endpoint de copia puede ignorar classList, por eso se re-aplican después).
            let applied = 0;
            for (const item of created) {
                if (!item.quizId) continue;
                const ok = await applyCopySettingsToQuiz(item.quizId, sourceDateIso || '', item.copy.classes);
                if (ok) applied++;
            }

            cleanup();
            const n = created.length;
            const verb = n === 1 ? 'Se creó' : 'Se crearon';
            const copiaWord = n === 1 ? 'copia' : 'copias';
            const allApplied = applied === n;
            const msg = allApplied
                ? `✅ ${verb} ${n} ${copiaWord}.`
                : `✅ ${verb} ${n} ${copiaWord} (${applied} con fecha/clase aplicadas).`;
            showZgToast(msg, 'success');
            setTimeout(() => window.location.reload(), 1500);
        });

        // Cargar el formulario de copia en segundo plano (el modal ya está abierto):
        // la columna Estado ya descarga las páginas /all/; se reutilizan y el modal no espera a la tabla.
        (async () => {
            try {
                const copyInfo = await loadQuizCopyForm(quizAllBaseUrl);
                formAction = copyInfo.formAction;
                Object.assign(formFields, copyInfo.formFields);
                csrfToken = copyInfo.csrfToken;
                sourceDateIso = copyInfo.sourceDateIso;
                copyInfo.formClassValues.forEach(v => formClassValues.push(v));

                // Lista de clases para el selector: usar la caché global (rara vez cambia).
                // Si no hay caché, descargarla UNA vez (vale para todos los quizzes) y guardarla.
                const roster = zgClassesGet();
                if (roster) {
                    roster.forEach(c => classItems.push({ value: c.value, checked: false, text: c.text }));
                } else {
                    try {
                        const items = await getQuizClassItems(quizAllBaseUrl);
                        items.forEach(c => classItems.push({ value: c.value, checked: false, text: c.text }));
                    } catch (e) {
                        console.warn('⚠️ [ZipGrade] No se pudo cargar la lista de clases; se usan las del formulario de copia.');
                        // Respaldo: clases que venían en el formulario de copia (sin label)
                        formClassValues.forEach(v => classItems.push({ value: v, checked: false, text: v }));
                    }
                }

                // Completar textos faltantes de las clases (si vinieron del formulario sin label)
                classItems.forEach(item => {
                    if (!item.text) item.text = item.value;
                });

                // Ordenar las clases académicamente (individuos, luego rangos, y Sandbox/Teachers al final).
                // Ninguna viene preseleccionada: al copiar una plantilla se asignan las clases indicadas.
                classItems.sort((a, b) => compareClassLabels(a.text, b.text));
                const classCheckboxHtml = classItems
                    .map(item => `<label style="display:flex; align-items:center; gap:6px; font-size:12px; color:#334155; padding:2px 0; cursor:pointer; margin:0;"><input type="checkbox" class="zg-copy-slot-class" value="${escapeHtml(item.value)}" style="margin:0; cursor:pointer;" /><span>${escapeHtml(item.text)}</span></label>`)
                    .join('');

                // Llenar la lista de clases de las filas del modal
                Array.from(slotsBox.querySelectorAll('.zg-copy-slot-classes-box')).forEach(box => {
                    box.innerHTML = classCheckboxHtml;
                });

                // Conectar el checkbox Auto-siguiente de cada slot
                Array.from(slotsBox.querySelectorAll('.zg-copy-slot')).forEach(slot => {
                    const autoNextChk = slot.querySelector('.zg-copy-slot-auto-next');
                    const box = slot.querySelector('.zg-copy-slot-classes-box');
                    const nameInp = slot.querySelector('.zg-copy-slot-name');
                    if (!autoNextChk || !box) return;
                    autoNextChk.addEventListener('change', () => {
                        const boxes = Array.from(box.querySelectorAll('input.zg-copy-slot-class'));
                        slot._suppressAutoNextReset = true;
                        boxes.forEach(cb => { cb.checked = false; });
                        if (autoNextChk.checked) {
                            const nextVal = getNextClassInRoster(quizName, classItems);
                            if (nextVal) {
                                const target = boxes.find(cb => cb.value === nextVal);
                                if (target) {
                                    target.checked = true;
                                    const labelText = target.parentElement ? target.parentElement.textContent.trim() : '';
                                    if (labelText && nameInp) nameInp.value = updateQuizNameGrade(nameInp.value, labelText);
                                }
                            }
                        } else {
                            // Al desmarcar, limpiar nombre a la base sin clase
                            if (nameInp) nameInp.value = suggestedName;
                        }
                        slot._suppressAutoNextReset = false;
                        // Disparar preview
                        box.dispatchEvent(new Event('change'));
                        slot._suppressAutoNextReset = false;
                    });
                });

                acceptBtn.disabled = false;
                acceptBtn.style.opacity = '';
                acceptBtn.title = '';
            } catch (err) {
                console.error('❌ [ZipGrade] Error cargando el quiz para copiarlo:', err);
                const box = slotsBox.querySelector('.zg-copy-slot-classes-box');
                if (box) box.innerHTML = '<div style="padding:8px; font-size:12px; color:#dc2626;">No se pudo cargar la información del quiz. Cierra y vuelve a intentarlo.</div>';
            }
        })();
    }

    // Devuelve los quizzes marcados con las casillas NATIVAS de la tabla
    // (columna 0: input[name="quizList"]). Es la ÚNICA fuente de selección
    // desde que se unificaron los checkboxes.
    function getSelectedQuizzes() {
        const result = [];
        // Detectar el índice de la columna "Class" en el encabezado de la tabla
        let classColIdx = -1;
        const headerCells = Array.from(document.querySelectorAll('#quizTable thead th, #quizTable thead td'));
        classColIdx = headerCells.findIndex(th => th.innerText.toLowerCase().includes('class'));
        document.querySelectorAll('#quizTable tbody input[name="quizList"]:checked').forEach(cb => {
            const row = cb.closest('tr');
            const link = row ? row.querySelector('td a[href*="/quiz/"][href*="/all/"]') : null;
            if (!link) return;
            const quizAllBaseUrl = new URL(link.getAttribute('href'), window.location.origin).pathname;
            // Capturar la clase actual del quiz desde la celda "Class" de la fila
            let currentClassText = '';
            if (classColIdx !== -1 && row.cells[classColIdx]) {
                currentClassText = row.cells[classColIdx].innerText.trim();
            }
            result.push({ quizAllBaseUrl, quizName: link.innerText.trim() || 'Quiz', currentClassText });
        });
        return result;
    }

    // Extrae el código numérico de clase de un texto (ej: "601" de "E.S.A. | 601 | P3", o "601" directamente).
    function extractClassCode(text) {
        const m = String(text || '').match(/\b(\d{3,4})\b/);
        return m ? m[1] : null;
    }

    // Dado el VALUE exacto de la clase actual (de formClassValues) y el roster ordenado,
    // devuelve el VALUE de la siguiente clase en el roster.
    // Fuente principal: código numérico extraído del NOMBRE del quiz (más confiable que texto de tabla).
    function getNextClassInRoster(quizName, roster) {
        if (!roster || roster.length === 0) return null;
        let currentIdx = -1;

        // Estrategia 1: extraer código numérico del nombre del quiz (ej: "601" de "E.S.A. | 601 | P3 | S1")
        // Esta es la fuente más confiable porque el nombre SiEMPRE contiene el código de clase.
        const codeFromName = extractClassCode(quizName);
        if (codeFromName) {
            currentIdx = roster.findIndex(c => extractClassCode(c.text) === codeFromName);
        }

        // Estrategia 2: coincidencia exacta de texto (tabla o texto directo)
        if (currentIdx === -1 && quizName) {
            const cleanText = quizName.trim().toLowerCase();
            currentIdx = roster.findIndex(c => c.text.trim().toLowerCase() === cleanText);
        }

        // Estrategia 3: contención parcial
        if (currentIdx === -1 && quizName) {
            const cleanText = quizName.trim().toLowerCase();
            currentIdx = roster.findIndex(c => {
                const rt = c.text.trim().toLowerCase();
                return rt && (cleanText.includes(rt) || rt.includes(cleanText));
            });
        }

        if (currentIdx === -1) {
            console.warn('[ZipGrade] Auto-siguiente: no se encontró la clase del quiz en el roster.', { quizName, codeFromName, rosterSample: roster.slice(0, 6).map(c => ({ text: c.text, code: extractClassCode(c.text) })) });
            return null;
        }
        const nextIdx = currentIdx + 1;
        if (nextIdx < roster.length) return roster[nextIdx].value;
        console.warn('[ZipGrade] Auto-siguiente: la clase "' + roster[currentIdx].text + '" ya es la última del roster.');
        return null;
    }


    // Modal para copiar VARIOS quizzes a la vez: igual al modal individual.
    // Por cada quiz hay checkboxes de clases; se crea una copia por cada clase marcada.
    // Incluye auto-selección de la siguiente clase si el quiz ya está asignado a una.
    async function showBulkCopyQuizModal() {
        const quizzes = getSelectedQuizzes();
        if (quizzes.length === 0) {
            alert('Marca al menos un quiz usando las casillas de la tabla (primera columna).');
            return;
        }

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:99999; display:flex; align-items:center; justify-content:center;';
        const modal = document.createElement('div');
        modal.style.cssText = 'background:#fff; border-radius:12px; padding:20px 24px; width:660px; max-width:96vw; max-height:92vh; display:flex; flex-direction:column; box-shadow:0 20px 50px rgba(0,0,0,0.35); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
        modal.innerHTML = `
            <h4 style="margin:0 0 6px 0; font-size:15px; font-weight:700; color:#1e293b; flex-shrink:0;"><i class="fa fa-copy"></i> Copiar quizzes seleccionados</h4>
            <p style="margin:0 0 10px 0; font-size:12px; color:#64748b; flex-shrink:0;">Por cada quiz, marca una o varias clases — se crea una copia aparte por cada clase marcada. El <strong style="color:#7c3aed;">checkbox ✨ Auto-siguiente</strong> pre-selecciona la clase siguiente a la que tenía el quiz.</p>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:8px; padding:7px 12px; flex-shrink:0; flex-wrap:wrap; gap:6px;">
                <label style="font-weight:600; font-size:12px; color:#334155; margin:0; white-space:nowrap;"><i class="fa fa-magic"></i> Aplicar clase a todos:</label>
                <select id="zg-bulk-copy-apply-all" disabled style="flex:1; min-width:140px; padding:4px 8px; font-size:12px; border-radius:6px; border:1px solid #cbd5e1; background:#fff;">
                    <option value="">Cargando clases...</option>
                </select>
                <button id="zg-bulk-auto-next-all" disabled class="btn btn-default btn-xs" style="white-space:nowrap; border-radius:6px; font-size:11px; color:#7c3aed; border-color:#c4b5fd; font-weight:600;">&#10024; Auto-sig. a todos</button>
            </div>
            <div id="zg-bulk-copy-rows" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:10px; min-height:0;"></div>
            <div id="zg-bulk-copy-progress" style="display:none; flex-direction:column; gap:4px; margin-top:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 14px; flex-shrink:0;">
                <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:600; color:#334155;">
                    <span id="zg-bulk-copy-progress-title">Copiando...</span>
                    <span id="zg-bulk-copy-progress-percent">0%</span>
                </div>
                <div style="width:100%; background:#cbd5e1; height:8px; border-radius:4px; overflow:hidden;">
                    <div id="zg-bulk-copy-progress-bar" style="width:0%; background:#7c3aed; height:100%; transition:width 0.3s ease;"></div>
                </div>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px; flex-shrink:0;">
                <button id="zg-bulk-copy-cancel" class="btn btn-default btn-sm" style="border-radius:6px;">Cancelar</button>
                <button id="zg-bulk-copy-accept" class="btn btn-primary btn-sm" disabled style="border-radius:6px; opacity:0.5;"><i class="fa fa-copy"></i> Copiar</button>
            </div>
        `;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const rowsBox = modal.querySelector('#zg-bulk-copy-rows');
        const acceptBtn = modal.querySelector('#zg-bulk-copy-accept');
        const cancelBtn = modal.querySelector('#zg-bulk-copy-cancel');
        const cleanup = () => overlay.remove();
        cancelBtn.addEventListener('click', cleanup);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });

        const computeCopyName = (quizName, className) => {
            const baseName = (adjustQuizNameFormat(quizName.trim()) || quizName.trim())
                .replace(/^\s*Template\s+/i, '')
                .replace(/\s+/g, ' ')
                .trim() + ' copy';
            return updateQuizNameGrade(baseName, className);
        };

        // Construye una tarjeta por quiz (igual al slot del modal individual)
        // currentClassValue: VALUE exacto de la clase actual del quiz (de su formClassValues[0])
        const buildQuizCard = (q, roster, currentClassValue) => {
            const card = document.createElement('div');
            card.className = 'zg-bulk-quiz-card';
            card.style.cssText = 'border:1px solid #e2e8f0; border-radius:10px; padding:10px 14px; background:#f8fafc;';

            const classCheckboxHtml = roster.map(item =>
                `<label style="display:flex; align-items:center; gap:6px; font-size:12px; color:#334155; padding:2px 0; cursor:pointer; margin:0;">
                    <input type="checkbox" class="zg-bulk-quiz-class" value="${escapeHtml(item.value)}" data-label="${escapeHtml(item.text)}" style="margin:0; cursor:pointer;" />
                    <span>${escapeHtml(item.text)}</span>
                </label>`
            ).join('');

            card.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px;">
                    <div style="font-size:12px; font-weight:700; color:#1e293b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;" title="${escapeHtml(q.quizName)}">${escapeHtml(q.quizName)}</div>
                    <label style="display:flex; align-items:center; gap:5px; font-size:11px; color:#7c3aed; font-weight:600; cursor:pointer; white-space:nowrap; flex-shrink:0;" title="Auto-selecciona la siguiente clase disponible basada en la clase actual del quiz">
                        <input type="checkbox" class="zg-bulk-auto-next" style="margin:0; accent-color:#7c3aed; cursor:pointer;" />
                        ✨ Auto-siguiente
                    </label>
                </div>
                <div class="zg-bulk-classes-box" style="max-height:130px; overflow-y:auto; border:1px solid #cbd5e1; border-radius:6px; background:#fff; padding:6px 10px;">
                    ${classCheckboxHtml || '<div style="font-size:12px;color:#94a3b8;">Sin clases disponibles</div>'}
                </div>
                <div class="zg-bulk-quiz-preview" style="display:none; background:#eef2ff; border:1px solid #c7d2fe; border-radius:6px; padding:8px 10px; font-size:11px; color:#3730a3; line-height:1.6; margin-top:6px;"></div>
            `;

            const classesBox = card.querySelector('.zg-bulk-classes-box');
            const previewEl = card.querySelector('.zg-bulk-quiz-preview');
            const autoNextChk = card.querySelector('.zg-bulk-auto-next');
            card.autoNextChk = autoNextChk;

            // Preview dinámico: muestra los nombres de copia que se generarán
            const updatePreview = () => {
                const checked = Array.from(classesBox.querySelectorAll('input.zg-bulk-quiz-class:checked'));
                if (checked.length === 0) {
                    previewEl.style.display = 'none';
                    return;
                }
                const names = checked.map(cb => {
                    const labelText = cb.dataset.label || cb.value;
                    return computeCopyName(q.quizName, labelText);
                });
                previewEl.style.display = 'block';
                if (names.length === 1) {
                    previewEl.innerHTML = `→ <strong>${escapeHtml(names[0])}</strong>`;
                } else {
                    previewEl.innerHTML = `<div style="font-weight:700; margin-bottom:4px;">Se crearán ${names.length} copias:</div>` +
                        names.map(n => `<div>• <strong>${escapeHtml(n)}</strong></div>`).join('');
                }
            };

            classesBox.addEventListener('change', () => {
                // Solo cancelar auto-next si fue cambio MANUAL (no programático)
                if (!card._suppressAutoNextReset) {
                    autoNextChk.checked = false;
                }
                updatePreview();
            });

            // Lógica del checkbox inteligente "Auto-siguiente"
            autoNextChk.addEventListener('change', () => {
                const boxes = Array.from(classesBox.querySelectorAll('input.zg-bulk-quiz-class'));
                card._suppressAutoNextReset = true;
                if (autoNextChk.checked) {
                    boxes.forEach(cb => { cb.checked = false; });
                    // Usar el nombre del quiz para encontrar la clase actual y pre-marcar la siguiente
                    const nextVal = getNextClassInRoster(q.quizName, roster);
                    if (nextVal) {
                        const target = boxes.find(cb => cb.value === nextVal);
                        if (target) target.checked = true;
                    }
                } else {
                    boxes.forEach(cb => { cb.checked = false; });
                }
                card._suppressAutoNextReset = false;
                updatePreview();
            });

            // Método público para que "Aplicar a todos" marque/desmarque una clase específica (toggle)
            card.applyClass = (value) => {
                const boxes = Array.from(classesBox.querySelectorAll('input.zg-bulk-quiz-class'));
                const alreadyChecked = boxes.some(cb => cb.value === value && cb.checked);
                card._suppressAutoNextReset = true;
                boxes.forEach(cb => {
                    cb.checked = !alreadyChecked; // toggle: if already checked, uncheck all; if not, check all
                });
                autoNextChk.checked = false;
                card._suppressAutoNextReset = false;
                updatePreview();
            };

            // Método público: activa el auto-siguiente para este card (toggle)
            card.applyAutoNext = () => {
                const nextVal = getNextClassInRoster(q.quizName, roster);
                if (!nextVal) return false;
                const boxes = Array.from(classesBox.querySelectorAll('input.zg-bulk-quiz-class'));
                card._suppressAutoNextReset = true;
                boxes.forEach(cb => { cb.checked = false; });
                // Marcar la clase siguiente
                const target = boxes.find(cb => cb.value === nextVal);
                if (target) {
                    target.checked = true;
                    // SCROLL a la clase seleccionada - hacer scroll dentro del card
                    // Usar el classesBox del closure (es el contenedor scrollable)
                    if (classesBox) {
                        classesBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
                // Encontrar y marcar el checkbox auto-siguiente dentro de este card
                if (card.autoNextChk) {
                    card.autoNextChk.checked = true;
                }
                card._suppressAutoNextReset = false;
                updatePreview();
                return true;
            };

            return card;
        };

        // Mostrar cards con spinner mientras carga el roster
        quizzes.forEach(q => {
            const placeholder = document.createElement('div');
            placeholder.style.cssText = 'border:1px solid #e2e8f0; border-radius:10px; padding:10px 14px; background:#f8fafc;';
            placeholder.innerHTML = `
                <div style="font-size:12px; font-weight:700; color:#1e293b; margin-bottom:6px;">${escapeHtml(q.quizName)}</div>
                <div style="font-size:12px; color:#64748b;"><i class="fa fa-spinner fa-spin"></i> Cargando clases...</div>
            `;
            rowsBox.appendChild(placeholder);
        });

        // Cargar el roster y reemplazar las tarjetas con checkboxes reales
        (async () => {
            let roster = [];
            try {
                roster = await getQuizClassItems(quizzes[0].quizAllBaseUrl);
            } catch (e) {
                roster = [];
            }
            roster.sort((a, b) => compareClassLabels(a.text, b.text));

            // Cargar formClassValues de cada quiz en paralelo para obtener el VALUE exacto de su clase actual
            const classValueMap = {};
            await Promise.allSettled(quizzes.map(async q => {
                try {
                    const info = await loadQuizCopyForm(q.quizAllBaseUrl);
                    if (info.formClassValues && info.formClassValues.length > 0) {
                        classValueMap[q.quizAllBaseUrl] = info.formClassValues[0];
                    }
                } catch (e) { /* silencioso: se usa texto de la tabla como fallback */ }
            }));

            // Reemplazar placeholders con tarjetas reales
            rowsBox.innerHTML = '';
            quizzes.forEach(q => {
                const currentClassValue = classValueMap[q.quizAllBaseUrl] || null;
                rowsBox.appendChild(buildQuizCard(q, roster, currentClassValue));
            });

            acceptBtn.disabled = false;
            acceptBtn.style.opacity = '';
            acceptBtn.title = '';

            // Actualizar label del botón con cuenta de copias totales (plural/singular correcto)
            const updateAcceptLabel = () => {
                const total = Array.from(rowsBox.querySelectorAll('input.zg-bulk-quiz-class:checked')).length;
                if (total === 0) {
                    acceptBtn.innerHTML = `<i class="fa fa-copy"></i> Copiar`;
                } else if (total === 1) {
                    acceptBtn.innerHTML = `<i class="fa fa-copy"></i> Copiar 1 quiz`;
                } else {
                    acceptBtn.innerHTML = `<i class="fa fa-copy"></i> Copiar ${total} quizzes`;
                }
            };
            rowsBox.addEventListener('change', updateAcceptLabel);
            updateAcceptLabel();

            // Botón "Auto-sig. a todos" - DESMARCA TODAS las clases
            const autoNextAllBtn = modal.querySelector('#zg-bulk-auto-next-all');
            autoNextAllBtn.disabled = false;
            autoNextAllBtn.addEventListener('click', () => {
                // DESMARCAR TODAS las casillas de clase en todos los quizzes
                Array.from(rowsBox.querySelectorAll('.zg-bulk-quiz-class')).forEach(cb => {
                    cb.checked = false;
                });
                // También desmarcar el checkbox auto-siguiente global
                const globalAutoNext = modal.querySelector('#zg-bulk-auto-next-all');
                if (globalAutoNext) globalAutoNext.checked = false;
                updateAcceptLabel();
            });

            // Poblar y activar el select "Aplicar a todos"
            const applyAllSel = modal.querySelector('#zg-bulk-copy-apply-all');
            const applyAllOptions = '<option value="">-- Elegir clase para todos --</option>' +
                roster.map(c => `<option value="${escapeHtml(c.value)}">${escapeHtml(c.text)}</option>`).join('');
            applyAllSel.innerHTML = applyAllOptions;
            applyAllSel.disabled = false;
            applyAllSel.addEventListener('change', () => {
                const val = applyAllSel.value;
                if (!val) return;
                Array.from(rowsBox.querySelectorAll('.zg-bulk-quiz-card')).forEach(card => {
                    if (card.applyClass) card.applyClass(val);
                });
                updateAcceptLabel();
                // Resetear el select a placeholder tras aplicar
                applyAllSel.value = '';
            });

        })();

        acceptBtn.addEventListener('click', async () => {
            // Recolectar pares (quiz, clase) a copiar
            const toCopy = [];
            Array.from(rowsBox.querySelectorAll('.zg-bulk-quiz-card')).forEach((card, i) => {
                const quiz = quizzes[i];
                const checked = Array.from(card.querySelectorAll('input.zg-bulk-quiz-class:checked'));
                checked.forEach(cb => {
                    toCopy.push({ quiz, value: cb.value, text: cb.dataset.label || cb.value });
                });
            });
            if (toCopy.length === 0) {
                alert('Marca al menos una clase en alguno de los quizzes para crear copias.');
                return;
            }

            acceptBtn.disabled = true;
            cancelBtn.disabled = true;
            acceptBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Copiando...';

            const progressBox = modal.querySelector('#zg-bulk-copy-progress');
            const progressTitle = modal.querySelector('#zg-bulk-copy-progress-title');
            const progressPercent = modal.querySelector('#zg-bulk-copy-progress-percent');
            const progressBar = modal.querySelector('#zg-bulk-copy-progress-bar');
            progressBox.style.display = 'flex';
            progressTitle.innerText = `Copiando 0/${toCopy.length}...`;
            progressPercent.innerText = '0%';
            progressBar.style.width = '0%';

            let created = 0;
            let applied = 0;
            const fails = [];
            for (let i = 0; i < toCopy.length; i++) {
                const { quiz, value, text } = toCopy[i];
                progressTitle.innerText = `Copiando ${i + 1}/${toCopy.length}: ${quiz.quizName}`;
                progressBar.style.width = `${Math.round((i / toCopy.length) * 100)}%`;
                progressPercent.innerText = `${Math.round((i / toCopy.length) * 100)}%`;
                try {
                    const copyName = computeCopyName(quiz.quizName, text);
                    const copyInfo = await loadQuizCopyForm(quiz.quizAllBaseUrl);
                    const params = new URLSearchParams();
                    Object.entries(copyInfo.formFields).forEach(([k, v]) => params.append(k, v));
                    params.append('newQuizName', copyName);
                    params.append('classList', value);

                    const saveResp = await fetch(copyInfo.formAction, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: params.toString(),
                        credentials: 'include'
                    });
                    if (!saveResp.ok) {
                        fails.push(`${quiz.quizName} → ${text} (HTTP ${saveResp.status})`);
                        continue;
                    }

                    const newQuizMatch = saveResp.url.match(/\/quiz\/([^/]+)\/all\//);
                    const newQuizId = newQuizMatch ? newQuizMatch[1] : null;
                    created++;
                    if (newQuizId) {
                        const ok = await applyCopySettingsToQuiz(newQuizId, copyInfo.sourceDateIso || '', [value]);
                        if (ok) applied++;
                    }
                } catch (err) {
                    fails.push(`${quiz.quizName} → ${text} (${err.message || 'error'})`);
                }
                if (toCopy.length > 1) await new Promise(r => setTimeout(r, 500));
            }
            progressBar.style.width = '100%';
            progressPercent.innerText = '100%';

            cleanup();
            const skippedQuizzes = quizzes.filter((q, i) => {
                const card = rowsBox.querySelectorAll('.zg-bulk-quiz-card')[i];
                return !card || card.querySelectorAll('input.zg-bulk-quiz-class:checked').length === 0;
            }).length;
            const msg = `Se crearon ${created} de ${toCopy.length} cop${toCopy.length === 1 ? 'ia' : 'ias'}` +
                (applied < created ? ` (${created - applied} sin fecha/clase aplicadas)` : '') +
                (skippedQuizzes > 0 ? ` | ${skippedQuizzes} quiz(zes) omitidos sin clases` : '');
            if (fails.length > 0) {
                showZgToast('✘ ' + msg + '\nFaltaron: ' + fails.join('; '), 'error');
            } else {
                showZgToast('✅ ' + msg, 'success');
            }
            setTimeout(() => window.location.reload(), 1500);
        });
    }

    // Modal para editar un quiz desde la tabla /quizzes/ (formulario completo)
    async function showEditQuizModal(quizId, quizName) {
        const editUrl = `/quiz/${quizId}/edit/`;

        let csrfToken = '';
        let quizNameVal = '';
        let answerSheetVal = '';
        let answerSheetSelect = null;
        let folderVal = '';
        let folderSelect = null;
        let quizDateVal = '';
        const classItems = [];

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:99999; display:flex; align-items:center; justify-content:center;';
        const modal = document.createElement('div');
        modal.style.cssText = 'background:#fff; border-radius:12px; padding:20px 24px; width:540px; max-width:94vw; box-shadow:0 20px 50px rgba(0,0,0,0.35); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
        modal.innerHTML = `
            <h4 style="margin:0 0 6px 0; font-size:15px; font-weight:700; color:#1e293b;"><i class="fa fa-pencil"></i> Editar quiz</h4>
            <p style="margin:0 0 14px 0; font-size:12px; color:#64748b;">Editando "<strong style="color:#334155;">${escapeHtml(quizName)}</strong>".</p>
            <div style="display:flex; flex-direction:column; gap:12px;">
                <div>
                    <label style="display:block; font-weight:600; font-size:12px; color:#334155; margin:0 0 4px 0;">Nombre del quiz</label>
                    <input id="zg-edit-name-input" type="text" class="form-control" value="${escapeHtml(quizName)}" style="width:100%; box-sizing:border-box;" />
                </div>
                <div style="display:flex; gap:12px;">
                    <div style="flex:1.4;">
                        <label style="display:block; font-weight:600; font-size:12px; color:#334155; margin:0 0 4px 0;">Plantilla (Answer Sheet)</label>
                        <select id="zg-edit-answer-sheet" class="form-control" style="width:100%; box-sizing:border-box;"></select>
                    </div>
                    <div style="flex:1;">
                        <label style="display:block; font-weight:600; font-size:12px; color:#334155; margin:0 0 4px 0;">Carpeta</label>
                        <select id="zg-edit-folder" class="form-control" style="width:100%; box-sizing:border-box;"></select>
                    </div>
                </div>
                <div>
                    <label style="display:block; font-weight:600; font-size:12px; color:#334155; margin:0 0 4px 0;">Fecha</label>
                    <div id="zg-edit-date-wrap" style="position:relative; width:100%; height:34px;">
                        <div style="display:flex; align-items:center; justify-content:space-between; background:#fff; pointer-events:none; position:absolute; top:0; left:0; width:100%; height:100%; z-index:1; box-sizing:border-box; border:1px solid #d1d5db; border-radius:6px; padding:0 12px; color:#334155; font-size:13px;">
                            <span id="zg-edit-date-text" style="color:#334155;">Sin fecha</span>
                            <i class="fa fa-calendar" style="color:#94a3b8; font-size:14px;"></i>
                        </div>
                        <input id="zg-edit-date" type="date" style="position:absolute; top:0; left:0; width:100%; height:100%; opacity:0; z-index:2; cursor:pointer; box-sizing:border-box; background:transparent; border:none;" />
                    </div>
                </div>
                <div>
                    <label style="display:block; font-weight:600; font-size:12px; color:#334155; margin:0 0 4px 0;">Clases</label>
                    <div id="zg-edit-classes" style="max-height:200px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px; display:flex; flex-direction:column; gap:8px; background:#f8fafc;"></div>
                </div>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
                <button id="zg-edit-cancel" class="btn btn-default btn-sm" style="border-radius:6px;">Cancelar</button>
                <button id="zg-edit-save" class="btn btn-primary btn-sm" style="border-radius:6px;"><i class="fa fa-save"></i> Guardar</button>
            </div>
        `;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const nameInput = modal.querySelector('#zg-edit-name-input');
        const asSelect = modal.querySelector('#zg-edit-answer-sheet');
        const folderSelEl = modal.querySelector('#zg-edit-folder');
        const dateInput = modal.querySelector('#zg-edit-date');
        const dateText = modal.querySelector('#zg-edit-date-text');
        const classesBox = modal.querySelector('#zg-edit-classes');
        const saveBtn = modal.querySelector('#zg-edit-save');

        // El modal se muestra al instante; la información se carga en segundo plano
        classesBox.innerHTML = '<div style="padding:8px; font-size:12px; color:#64748b;"><i class="fa fa-spinner fa-spin"></i> Cargando información...</div>';
        saveBtn.disabled = true;
        saveBtn.style.opacity = '0.5';
        saveBtn.title = 'Cargando información del quiz...';

        // Al seleccionar una clase, poner el nombre de la clase tal cual dentro del nombre
        // (ej: "601" -> "E.S.A. | 601 | P3 | S1"). NO se re-marcan otras clases del mismo grado.
        const applyEditClassGradeToName = () => {
            const checked = Array.from(classesBox.querySelectorAll('input[name="classList"]:checked'));
            const last = checked[checked.length - 1];
            if (last) {
                const labelText = last.parentElement ? last.parentElement.textContent.trim() : '';
                if (labelText) {
                    nameInput.value = updateQuizNameGrade(nameInput.value, labelText);
                }
            }
        };

        // Si el usuario edita el grado dentro del nombre (ej: cambia "3°" por "4°"),
        // marcar automáticamente la clase cuyo grado coincida.
        nameInput.addEventListener('change', () => {
            const g = extractGradeFromQuizName(nameInput.value);
            if (g) syncClassFromGrade(classesBox, g);
        });
        function updateDateDisplay() {
            const v = dateInput.value;
            if (dateText) dateText.textContent = v ? formatQuizDate(v) : 'Sin fecha';
        }
        updateDateDisplay();
        dateInput.addEventListener('input', updateDateDisplay);
        dateInput.addEventListener('change', updateDateDisplay);

        classesBox.addEventListener('change', (e) => {
            if (e.target && e.target.type === 'checkbox') {
                // Selección de UNA sola clase: marcar una desmarca las demás
                if (e.target.checked) {
                    Array.from(classesBox.querySelectorAll('input[name="classList"]'))
                        .forEach(cb => { if (cb !== e.target) cb.checked = false; });
                }
                applyEditClassGradeToName();
            }
        });

        // Checkbox Auto-siguiente para la edición individual
        const autoNextIndividualChk = document.createElement('input');
        autoNextIndividualChk.type = 'checkbox';
        autoNextIndividualChk.className = 'zg-edit-auto-next';
        autoNextIndividualChk.style.cssText = 'margin:0; accent-color:#7c3aed; cursor:pointer;';
        autoNextIndividualChk.title = "Marca automáticamente la clase siguiente a la que tiene el quiz";

        // Insertar el checkbox auto-siguiente después del label de "Clases"
        const classesLabel = modal.querySelector('label[for="zg-edit-classes"]') || modal.querySelector('label:contains("Clases")');
        if (classesLabel) {
            const classesRow = classesLabel.parentElement;
            if (classesRow) {
                const autoNextWrapper = document.createElement('div');
                autoNextWrapper.style.cssText = 'display:flex; align-items:center; gap:6px; margin-top:4px; font-size:11px; color:#7c3aed; font-weight:600;';
                // Usar un nombre de clase único para evitar conflictos: zg-edit-auto-next-individual
                autoNextWrapper.innerHTML = `<label style="display:flex; align-items:center; gap:5px; cursor:pointer;"><input type="checkbox" class="zg-edit-auto-next-individual" style="margin:0; accent-color:#7c3aed; cursor:pointer;" />✨ Auto-siguiente</label>`;
                classesRow.parentNode.insertBefore(autoNextWrapper, classesRow.nextSibling);
                
                // Manejar el checkbox Auto-siguiente inmediatamente después de crearlo
                const individualAutoNextChk = modal.querySelector('.zg-edit-auto-next-individual');
                if (individualAutoNextChk) {
                    individualAutoNextChk.addEventListener('change', () => {
                        // Usar las variables ya disponibles en este scope
                        if (!classesBox) return;
                        const boxes = Array.from(classesBox.querySelectorAll('input[name="classList"]'));
                        const quizNameInput = modal.querySelector('#zg-edit-name-input');
                        const quizName = quizNameInput ? quizNameInput.value : '';

                        if (individualAutoNextChk.checked) {
                            // Desmarcar todas las clases
                            boxes.forEach(cb => { cb.checked = false; });
                            // Buscar el código de clase en el nombre del quiz
                            const codeMatch = quizName.match(/\b(\d{3,4})\b/);
                            if (codeMatch) {
                                const currentCode = codeMatch[1];
                                // Buscar esta clase en los boxes y marcar la siguiente
                                const currentBox = boxes.find(cb => {
                                    const labelText = cb.parentElement ? cb.parentElement.textContent.trim() : cb.value;
                                    return labelText.includes(currentCode) || cb.value === currentCode;
                                });
                                if (currentBox) {
                                    const currentIdx = boxes.indexOf(currentBox);
                                    if (currentIdx >= 0 && currentIdx < boxes.length - 1) {
                                        boxes[currentIdx + 1].checked = true;
                                        // SCROLL a la clase seleccionada
                                        if (classesBox) {
                                            const target = currentBox.parentElement;
                                            if (target) {
                                                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            }
                                        }
                                    }
                                } else {
                                    // Si no hay código de clase en el nombre, marcar la primera clase
                                    if (boxes.length > 0) {
                                        boxes[0].checked = true;
                                        if (boxes[0]) {
                                            boxes[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }
                                    }
                                }
                            }
                        }
                    });
                }
            }
        }
        
        // Ejecutar el handler inmediatamente después de crear el checkbox
        // El handler ya está configurado en el paso anterior (líneas 3059-3105)
        const cancelBtn = modal.querySelector('#zg-edit-cancel');
        const cleanup = () => overlay.remove();
        cancelBtn.addEventListener('click', cleanup);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });

        // Manejar el checkbox Auto-siguiente en la edición individual
        autoNextIndividualChk = modal.querySelector('.zg-edit-auto-next');
        if (autoNextIndividualChk) {
            autoNextIndividualChk.addEventListener('change', () => {
                const boxes = Array.from(classesBox.querySelectorAll('input[name="classList"]'));
                const currentVal = null; // Se obtendrá del nombre del quiz

                if (autoNextIndividualChk.checked) {
                    // Desmarcar todas las clases
                    boxes.forEach(cb => { cb.checked = false; });
                    // Buscar la clase actual del quiz y marcar la siguiente
                    const quizNameInput = modal.querySelector('#zg-edit-name-input');
                    const quizName = quizNameInput ? quizNameInput.value : '';

                    // Usar la función getNextClassInRoster si está disponible, o buscar en el roster
                    // Por ahora, intentaremos extraer el código de clase del nombre
                    const codeMatch = quizName.match(/\b(\d{3,4})\b/);
                    if (codeMatch) {
                        const currentCode = codeMatch[1];
                        // Buscar esta clase en los boxes y marcar la siguiente
                        const currentBox = boxes.find(cb => {
                            const labelText = cb.parentElement ? cb.parentElement.textContent.trim() : cb.value;
                            return labelText.includes(currentCode) || cb.value === currentCode;
                        });
                        if (currentBox) {
                            const currentIdx = boxes.indexOf(currentBox);
                            if (currentIdx >= 0 && currentIdx < boxes.length - 1) {
                                boxes[currentIdx + 1].checked = true;
                                // SCROLL a la clase seleccionada
                                const container = classesBox.parentElement;
                                if (container) {
                                    const target = currentBox.parentElement;
                                    if (target) {
                                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }
                                }
                            }
                        }
                    } else {
                        // Si no hay código de clase en el nombre, marcar la primera clase
                        if (boxes.length > 0) {
                            boxes[0].checked = true;
                            // SCROLL a la primera clase
                            const firstBox = boxes[0];
                            if (firstBox) {
                                firstBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                        }
                    }
                }
                applyEditClassGradeToName();
            });
        }

        saveBtn.addEventListener('click', async () => {
            const nameVal = nameInput.value.trim();
            if (!nameVal) {
                alert('El nombre del quiz no puede estar vacío.');
                nameInput.focus();
                return;
            }

            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Guardando...';
            try {
                const params = new URLSearchParams();
                params.append('quizName', nameVal);
                params.append('answerSheet', asSelect.value || '');
                params.append('quizDate', dateInput.value || '');
                params.append('folder', folderSelEl.value || '');
                if (csrfToken) params.append('csrf_token', csrfToken);
                classesBox.querySelectorAll('input[name="classList"]:checked').forEach(cb => {
                    params.append('classList', cb.value);
                });

                const saveResp = await fetch(editUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                    credentials: 'include'
                });

                if (saveResp.ok) {
                    cleanup();
                    window.location.reload();
                } else {
                    alert('No se pudo guardar los cambios (HTTP ' + saveResp.status + ').');
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = '<i class="fa fa-save"></i> Guardar';
                }
            } catch (err) {
                console.error('❌ [ZipGrade] Error al guardar el quiz:', err);
                alert('Error al guardar el quiz: ' + err.message);
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fa fa-save"></i> Guardar';
            }
        });

        // Cargar el formulario de edición en segundo plano (el modal ya está abierto)
        (async () => {
            try {
                let html = zgRawPageGet(editUrl);
                if (html === null) {
                    const res = await customRequest({ method: 'GET', url: editUrl }, 45000);
                    if (res.status !== 200) throw new Error('HTTP ' + res.status);
                    html = res.responseText || '';
                    zgRawPageSet(editUrl, html);
                }
                const doc = new DOMParser().parseFromString(html, 'text/html');

                csrfToken = extractCSRFToken(doc);
                quizNameVal = doc.getElementById('quizName')?.value || '';
                answerSheetSelect = doc.getElementById('answerSheet') || doc.querySelector('select[name="answerSheet"]');
                answerSheetVal = answerSheetSelect?.value || '';
                folderSelect = doc.querySelector('select[name="folder"]');
                folderVal = folderSelect?.value || '';
                quizDateVal = doc.getElementById('quizDate')?.value || '';

                // Extraer las clases (con su estado marcado) y refrescar la caché global del roster
                extractClassListFromEditDoc(doc).forEach(item => classItems.push(item));
                zgClassesSet(classItems.map(item => ({ value: item.value, text: item.text })));

                if (quizNameVal) nameInput.value = quizNameVal;
                cloneSelectOptions(asSelect, answerSheetSelect);
                if (answerSheetVal) asSelect.value = answerSheetVal;
                cloneSelectOptions(folderSelEl, folderSelect);
                if (folderVal) folderSelEl.value = folderVal;
                if (quizDateVal) dateInput.value = quizDateVal;
                updateDateDisplay();

                // Ordenar las clases académicamente (individuos, luego rangos, y Sandbox/Teachers al final)
                classItems.sort((a, b) => compareClassLabels(a.text, b.text));
                const classesHtml = classItems
                    .map(item => `<label style="display:flex; align-items:center; gap:8px; font-weight:400; font-size:12px; color:#334155; cursor:pointer; margin:0;"><input type="checkbox" name="classList" value="${escapeHtml(item.value)}" ${item.checked ? 'checked' : ''} style="margin:0; cursor:pointer;" />${escapeHtml(item.text)}</label>`)
                    .join('');
                classesBox.innerHTML = classesHtml;

                saveBtn.disabled = false;
                saveBtn.style.opacity = '';
                saveBtn.title = '';
            } catch (err) {
                console.error('❌ [ZipGrade] Error cargando el quiz para editar:', err);
                alert('No se pudo cargar el formulario de edición del quiz.');
                cleanup();
            }
        })();
    }

    // ==========================================
    // 6.2.1. COLUMNA "RESULTADOS" EN /QUIZZES/ (DESCARGA INDIVIDUAL Y MASIVA)
    // ==========================================
    // Marca/desmarca una casilla NATIVA de ZipGrade y refresca su visual (uniform azul).
    function setNativeCheckboxChecked(cb, state) {
        if (!cb) return;
        if (cb.checked !== state) {
            cb.checked = state;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
        }
        refreshUniformVisual(cb);
    }

    // Fuerza a uniform (plugin de checkboxes de ZipGrade) a repintar el estado visual
    // cuando el toolkit marca/desmarca las casillas nativas programáticamente.
    // jQuery Uniform pinta el estado con la clase 'checked' en el wrapper (.checker);
    // se hace toggle directo como fallback para que el visual siga SIEMPRE al estado nativo.
    function refreshUniformVisual(cb) {
        if (!cb) return;
        const state = !!cb.checked;
        // jQuery Uniform en ZipGrade: el estado visual vive en el SPAN interno que envuelve
        // al input (<div class="checker"><span class="checked">...). Toggle directo para que
        // el sprite azul siga SIEMPRE al estado nativo.
        const innerSpan = cb.parentElement;
        if (innerSpan) {
            innerSpan.classList.toggle('checked', state);
        }
        const wrapper = cb.closest('.checker, .uniform-checker');
        if (wrapper && wrapper !== innerSpan) {
            wrapper.classList.toggle('checked', state);
        }
        if (typeof window.jQuery === 'undefined' || !window.jQuery.fn || !window.jQuery.fn.uniform) return;
        try {
            const $cb = window.jQuery(cb);
            if (typeof $cb.uniform === 'function') $cb.uniform('update');
            if (window.jQuery.uniform && typeof window.jQuery.uniform.update === 'function') {
                window.jQuery.uniform.update();
            }
        } catch (e) {
            // La casilla no está inicializada por uniform; no pasa nada.
        }
    }

    // Marca/desmarca las casillas NATIVAS de la tabla de quizzes y dispara 'change'
    // para que el plugin visual de ZipGrade actualice la apariencia.
    function setAllNativeQuizChecks(state) {
        document.querySelectorAll('#quizTable tbody input[name="quizList"]').forEach(cb => {
            setNativeCheckboxChecked(cb, state);
        });
    }

    function updateQuizResultsCounter() {
        const checked = document.querySelectorAll('#quizTable tbody input[name="quizList"]:checked').length;
        const total = document.querySelectorAll('#quizTable tbody input[name="quizList"]').length;
        const badge = document.getElementById('zg-quiz-counter-badge');
        if (badge) {
            badge.innerText = `${checked} de ${total} marcados`;
            badge.classList.toggle('zg-badge-active', checked > 0);
        }
        // Sincronizar el estado del master del toolkit según la selección nativa
        const masterChk = document.getElementById('zg-quiz-master-check');
        if (masterChk) {
            masterChk.checked = total > 0 && checked === total;
            masterChk.indeterminate = checked > 0 && checked < total;
            refreshUniformVisual(masterChk);
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
            th.style.cssText = 'vertical-align:middle; text-align:center; width:260px; color:#ffffff;';
            th.innerHTML = `
<div style="display:flex; flex-direction:column; align-items:center; gap:3px;">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <input type="checkbox" id="zg-quiz-master-check" title="Seleccionar/Deseleccionar todos" style="margin:0; cursor:pointer; width:16px; height:16px; accent-color:#3c87c8;" />
                        <span style="font-family:'Open Sans', sans-serif; font-weight:300; font-size:17px; line-height:19px; color:#ffffff;">Descarga Rápida</span>
                    </div>
                    <span id="zg-quiz-counter-badge" class="zg-counter-badge">0 de 0 marcados</span>
                </div>
            `;
            theadRow.appendChild(th);

            // Columna de Estado por quiz (icón de descarga)
            const statusTh = document.createElement('th');
            statusTh.className = 'text-center zg-status-th sorting_disabled';
            statusTh.style.cssText = 'vertical-align:middle; text-align:center; width:80px; color:#ffffff;';
            statusTh.innerHTML = '<span style="font-family:\'Open Sans\', sans-serif; font-weight:300; font-size:17px; line-height:19px; color:#ffffff;">Estado</span>';
            theadRow.appendChild(statusTh);

            // Mismo título (tooltip) en el master NATIVO de ZipGrade (#selecctall) y su wrapper uniform
            const nativeMasterInput = document.querySelector('#selecctall');
            if (nativeMasterInput) {
                nativeMasterInput.setAttribute('title', 'Seleccionar/Deseleccionar todos');
                const wrapper = nativeMasterInput.closest('.checker, .uniform-checker');
                if (wrapper) wrapper.setAttribute('title', 'Seleccionar/Deseleccionar todos');
            }

            th.querySelector('#zg-quiz-master-check').addEventListener('change', (e) => {
                setAllNativeQuizChecks(e.target.checked);
                // Sincronizar también el master NATIVO de ZipGrade (#selecctall)
                const nativeMaster = document.querySelector('#selecctall');
                if (nativeMaster) setNativeCheckboxChecked(nativeMaster, e.target.checked);
                updateQuizResultsCounter();
            });
        }

        // 2. Filas: añadir TD con botón individual + selector de formato
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        const loaders = [];
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

            // La casilla de selección es la NATIVA de ZipGrade (columna 0: input[name="quizList"])
            const nativeChk = row.querySelector('input[name="quizList"], input.quizCheckbox');

            const td = document.createElement('td');
            td.className = 'zg-quiz-td';
            td.style.cssText = 'vertical-align:middle; text-align:center;';
            const cellDiv = document.createElement('div');
            cellDiv.style.cssText = 'display:inline-flex; gap:6px; align-items:center; justify-content:center;';
            td.appendChild(cellDiv);

            // Selector de formato en la celda (siempre visible, estilo /classes/)
            const select = document.createElement('select');
            select.className = 'zg-quiz-format-select';
            select.style.cssText = 'padding:4px 6px; font-size:11px; border-radius:6px; border:1px solid #cbd5e1; width:165px; max-width:165px; background:#fff; cursor:pointer;';
            select.innerHTML = '<option value="">Cargando...</option>';
            select.disabled = true;
            select.addEventListener('change', () => {
                if (select.value !== '' && select.selectedOptions[0]?.dataset.valid === '1') {
                    // Elegir un formato marca el quiz como seleccionado (misma casilla nativa)
                    if (nativeChk && !nativeChk.checked) {
                        setNativeCheckboxChecked(nativeChk, true);
                    }
                }
                updateQuizResultsCounter();
            });
            cellDiv.appendChild(select);

            // Botón de descarga individual a la DERECHA del selector (mismo orden que /classes/)
            const dlBtn = document.createElement('button');
            dlBtn.className = 'zg-btn-quiz-download btn btn-default btn-xs';
            dlBtn.style.cssText = 'padding:3px 8px;';
            dlBtn.title = 'Descargar resultados de este quiz (formato personalizado)';
            dlBtn.innerHTML = '<i class="fa fa-cloud-download" style="color:#2563eb;"></i>';
            cellDiv.appendChild(dlBtn);

            row.appendChild(td);

            // NUEVA: Celda de estado de descarga para este quiz
            const statusTd = document.createElement('td');
            statusTd.className = 'zg-download-status-td';
            statusTd.style.cssText = 'vertical-align:middle; text-align:center;';
            statusTd.innerHTML = '<span style="font-size:12px; color:#64748b;;">—</span>'; // pending
            row.appendChild(statusTd);

            // Cargar formatos del quiz de una vez
            loaders.push((async () => {
                try {
                    const formats = await fetchCustomExportFormats(quizAllBaseUrl);
                    td.dataset.formats = JSON.stringify(formats.map(f => ({
                        name: f.name,
                        csv: f.csv,
                        xlsx: f.xlsx
                    })));

                    // Actualizar estado de descarga
                    if (statusTd) {
                        if (formats.length === 0) {
                            statusTd.innerHTML = '<span style="font-size:12px; color:#64748b;;">Sin formato</span>';
                        } else {
                            statusTd.innerHTML = '<span style="font-size:12px; color:#28a745;">✓ Listo</span>';
                        }
                    }

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
            })());

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
                            const filename = await downloadCustomExport(chosen, type, quizName);
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

        // La selección NATIVA (casillas de fila + master #selecctall de ZipGrade) mantiene
        // sincronizados el contador y el master del toolkit. Se escucha a nivel documento
        // para sobrevivir a los redibujos de DataTables.
        if (!zgNativeSyncBound) {
            zgNativeSyncBound = true;
            document.addEventListener('change', (e) => {
                if (!e.target || !e.target.matches) return;
                const isNative = e.target.matches('#quizTable tbody input[name="quizList"]') ||
                    e.target.matches('#uniform-selecctall input, #selecctall');
                if (isNative) {
                    setTimeout(() => updateQuizResultsCounter(), 0);
                }
            });
        }

        updateQuizResultsCounter();

        // Promesa global de carga de formatos: la columna Estado espera por ella antes de
        // descargar las páginas /all/ pesadas (así los selects llenan todos a la vez).
        if (loaders.length > 0 && !zgFormatsLoadPromise) {
            zgFormatsLoadPromise = Promise.allSettled(loaders);
        }

        // 3. Desactivar ordenación/búsqueda de DataTables en las columnas personalizadas
        // (Estado, Descarga Rápida y Acciones) — centralizado en disableQuizCustomColumnsSort().
        disableQuizCustomColumnsSort();

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

    // Localiza la celda de "Descarga Rápida" de una fila a partir de la URL del quiz.
    function getQuizTd(quizAllBaseUrl) {
        const link = document.querySelector(`#quizTable tbody a[href="${quizAllBaseUrl}"]`);
        const row = link ? link.closest('tr') : null;
        return row ? row.querySelector('.zg-quiz-td') : null;
    }

    // Espera interrumpible: permite detener la descarga masiva incluso durante las
    // pausas anti rate-limit. Devuelve false si el usuario pidió cancelar.
    async function sleepWithCancel(ms) {
        const step = 200;
        for (let t = 0; t < ms; t += step) {
            if (zgQuizDownloadCancelRequested) return false;
            await new Promise(r => setTimeout(r, Math.min(step, ms - t)));
        }
        return !zgQuizDownloadCancelRequested;
    }

    // Descarga masiva de resultados para los quizzes marcados en /quizzes/
    async function downloadSelectedQuizResults(bulkBtn) {
        const quizzes = getSelectedQuizzes();
        if (quizzes.length === 0) {
            alert('Marca al menos un quiz usando las casillas de la tabla (primera columna).');
            return;
        }

        const bannerEl = document.getElementById('zg-quiz-download-banner');
        if (bannerEl) bannerEl.style.display = 'none';

        // Botón "Detener": muestra el progreso y cancela el lote entre quizzes
        const stopBtn = document.getElementById('zg-quiz-btn-stop');
        if (stopBtn && !stopBtn.dataset.zgBound) {
            stopBtn.dataset.zgBound = 'true';
            stopBtn.addEventListener('click', () => {
                zgQuizDownloadCancelRequested = true;
                updateQuizStatusText('Deteniendo el lote tras el quiz en curso...');
            });
        }
        zgQuizDownloadCancelRequested = false;
        if (stopBtn) stopBtn.style.display = 'inline-flex';

        const originalHtml = bulkBtn.innerHTML;
        bulkBtn.disabled = true;
        const startTime = Date.now();

        let successCount = 0;
        let skipCount = 0;
        let stopped = false;
        for (let i = 0; i < quizzes.length; i++) {
            if (zgQuizDownloadCancelRequested) { stopped = true; break; }

            const quiz = quizzes[i];
            const quizUrl = quiz.quizAllBaseUrl;
            const quizName = quiz.quizName;
            const progressPercent = (i / quizzes.length) * 90;

            setQuizProgressBar(progressPercent, `Descargando ${i + 1}/${quizzes.length}: ${quizName}`);
            updateQuizStatusText(`Descargando ${i + 1}/${quizzes.length}: ${quizName}...`);
            bulkBtn.innerHTML = `<i class="fa fa-spinner fa-spin"></i> ${i + 1}/${quizzes.length}`;

            try {
                // Si la fila tiene un formato elegido en su selector, usarlo; si no, el primero
                const td = getQuizTd(quizUrl);
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
                const filename = await downloadCustomExport(fmt, type, quizName);
                console.log(`📥 [ZipGrade] ${i + 1}/${quizzes.length} descargado: ${filename}`);
                successCount++;
                if (!(await sleepWithCancel(2000))) { stopped = true; break; }
            } catch (err) {
                console.error(`❌ [ZipGrade] Error descargando "${quizName}":`, err);
                skipCount++;
            }
            // Pausa anti rate-limit entre quizzes (interrumpible)
            if (i < quizzes.length - 1 && !(await sleepWithCancel(3000))) {
                stopped = true;
                break;
            }
        }

        bulkBtn.innerHTML = originalHtml;
        bulkBtn.disabled = false;
        if (stopBtn) stopBtn.style.display = 'none';
        hideQuizProgressBar();

        const totalTime = Math.round((Date.now() - startTime) / 1000);
        const minutes = Math.floor(totalTime / 60);
        const secs = totalTime % 60;
        const timeStr = minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
        const base = stopped
            ? `Descarga detenida: ${successCount} de ${quizzes.length} descargados en ${timeStr}`
            : `${successCount} de ${quizzes.length} resultados descargados en ${timeStr}`;
        const summary = base + (skipCount > 0 ? ` (${skipCount} omitidos)` : '');
        console.log(`🎉 [ZipGrade] ${summary}`);
        updateQuizStatusText(summary);

        if (successCount > 0) {
            const bannerTitle = document.getElementById('zg-quiz-banner-title');
            const bannerSub = document.getElementById('zg-quiz-banner-subtitle');
            if (bannerTitle) bannerTitle.textContent = summary;
            if (bannerSub) {
                bannerSub.textContent = stopped
                    ? 'El lote se detuvo a petición tuya.'
                    : (skipCount > 0
                        ? `${skipCount} quiz(zes) se omitieron por no tener formato personalizado.`
                        : 'Los resultados se han descargado a tu carpeta de descargas.');
            }
            if (bannerEl) bannerEl.style.display = 'flex';
        } else if (!stopped) {
            alert('No se pudo descargar ningún resultado. Verifica que los quizzes tengan un Export Format personalizado.');
        }
    }

    function initQuizzesPage() {
        translateQuizHeaders();
        createQuizzesSortControls();
        sortQuizTable();
        initQuizzesResultsColumn();
        const statusLoadPromise = initQuizStatusColumn();
        initQuizKeyColumn();
        initQuizActionsColumn();
        setupQuizStatusRefreshButton();

        // Precargar la lista de clases (caché 24 h) una vez que terminen los estados de la tabla,
        // para que el primer modal de copiar/editar no tenga que descargar la página /edit/.
        const firstQuizLink = document.querySelector('#quizTable tbody tr a[href*="/quiz/"][href*="/all/"]');
        if (firstQuizLink && statusLoadPromise) {
            const firstQuizAllBaseUrl = new URL(firstQuizLink.getAttribute('href'), window.location.origin).pathname;
            statusLoadPromise.then(() => warmQuizClassListCache(firstQuizAllBaseUrl));
        }

        setTimeout(() => {
            translateQuizHeaders();
            createQuizzesSortControls();
            sortQuizTable();
            initQuizzesResultsColumn();
            initQuizStatusColumn();
            initQuizKeyColumn();
            initQuizActionsColumn();
        }, 400);
        setTimeout(() => {
            translateQuizHeaders();
            createQuizzesSortControls();
            sortQuizTable();
            initQuizzesResultsColumn();
            initQuizStatusColumn();
            initQuizKeyColumn();
            initQuizActionsColumn();
        }, 1000);

        // Re-insertar las columnas personalizadas si DataTables redibuja la tabla (ordenar, filtrar, paginar)
        const tbody = document.querySelector('#quizTable tbody');
        if (tbody && !window._zgQuizTableObserver) {
            let reinsertTimer = null;
            window._zgQuizTableObserver = new MutationObserver(() => {
                if (reinsertTimer) clearTimeout(reinsertTimer);
                reinsertTimer = setTimeout(() => {
                    translateQuizHeaders();
                    initQuizzesResultsColumn();
                    initQuizStatusColumn();
                    initQuizKeyColumn();
                    initQuizActionsColumn();
                    disableQuizCustomColumnsSort();
                }, 150);
            });
            window._zgQuizTableObserver.observe(tbody, { childList: true });
        }
    }

    // ==========================================
    // 6.3. ORDENAR CLASES ACADÉMICAMENTE EN CREACIÓN/EDICIÓN DE QUIZ
    // ==========================================
    // Identifica rangos de grados (ej: "1° - 2°", "10° - 11°")
    function isClassRange(text) {
        const degreeCount = (text.match(/[°ºª]/g) || []).length;
        if (degreeCount >= 2) return true;
        if (text.includes(' - ') && text.includes('°')) return true;
        return false;
    }

    // Comparador académico de etiquetas de clase:
    // individuos primero, luego rangos (ej: "1° - 2°"), y Sandbox/Teachers al final
    function compareClassLabels(textA, textB) {
        const a = (textA || '').trim();
        const b = (textB || '').trim();

        // 1. Sandbox y Teachers al final del todo
        const isNonAcadA = a.toLowerCase().includes('sandbox') || a.toLowerCase().includes('teacher');
        const isNonAcadB = b.toLowerCase().includes('sandbox') || b.toLowerCase().includes('teacher');
        if (isNonAcadA && !isNonAcadB) return 1;
        if (!isNonAcadA && isNonAcadB) return -1;
        if (isNonAcadA && isNonAcadB) {
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        }

        // 2. Rangos de grados (ej: "1° - 2°") agrupados después de clases individuales, pero antes de Sandbox/Teachers
        const isRangeA = isClassRange(a);
        const isRangeB = isClassRange(b);
        if (isRangeA && !isRangeB) return 1;
        if (!isRangeA && isRangeB) return -1;

        // 3. Ambos son rangos o ambos son individuales: ordenar por peso y luego por nombre
        const weightA = extractGradeWeight(a);
        const weightB = extractGradeWeight(b);
        if (weightA !== weightB) return weightA - weightB;

        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    }

    function sortQuizEditClasses() {
        const classListUl = document.getElementById('classList');
        if (!classListUl) return;

        const items = Array.from(classListUl.querySelectorAll('li'));
        if (items.length <= 1) return;

        items.sort((a, b) => {
            const labelA = a.querySelector('label');
            const labelB = b.querySelector('label');
            const textA = labelA ? labelA.innerText.trim() : '';
            const textB = labelB ? labelB.innerText.trim() : '';
            return compareClassLabels(textA, textB);
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

    // ¿Un segmento del nombre es un token de grado (individual "3°" o rango "3° - 5°"/"3° a 5°")?
    function isGradeToken(p) {
        if (!p) return false;
        if (/^(S\d+|P\d+)$/i.test(p)) return false;
        if (/^\d{1,2}\s*[º°ª]?[A-Za-z]?$/.test(p)) return true;
        return /^\d{1,2}\s*[º°ª]?[A-Za-z]?\s*(?:[-–]|a)\s*\d{1,2}\s*[º°ª]?[A-Za-z]?$/i.test(p);
    }

    // ¿Un segmento del nombre es un código de clase tipo "601" o "1002"?
    function isClassCodeToken(p) {
        if (!p) return false;
        const m = String(p).match(/^\d{3,4}$/);
        if (!m) return false;
        const v = parseInt(m[0], 10);
        return v >= 600 && v <= 1200;
    }

    // Índice del token que representa la clase dentro del nombre
    // (grado individual "3°", rango "6° - 9°" o código "601")
    function findQuizClassTokenIdx(parts) {
        const gradeIdx = parts.findIndex(isGradeToken);
        if (gradeIdx !== -1) return gradeIdx;
        return parts.findIndex(isClassCodeToken);
    }

    // Actualiza el grado (ej: "4°") dentro del nombre de un quiz con formato "... | 3° | P3 | S1".
    // Reemplaza el token de grado (individual o rango) donde esté; si no hay, lo agrega al final.
    // Al aplicar un grado nuevo también quita el sufijo " copy" (el nombre ya pasa a ser distinto)
    // y elimina duplicados del grado (ej: "... copy | 4°").
    function updateQuizNameGrade(nameVal, gradeVal) {
        if (!nameVal) return nameVal;
        const grade = String(gradeVal || '').trim();
        const parts = String(nameVal).split('|').map(p => p.trim());
        const classIdx = findQuizClassTokenIdx(parts);
        const hadClass = classIdx !== -1;
        const cleanParts = parts.filter((p, i) => i !== classIdx);
        if (hadClass) {
            cleanParts.splice(classIdx, 0, grade || parts[classIdx]);
        } else if (grade) {
            cleanParts.push(grade);
        }
        let result = cleanParts.join(' | ');
        if (grade) result = result.replace(/\s*copy(?:\s*\d+)?$/i, '');
        return result;
    }

    // Extrae el token de grado del nombre de un quiz ("Template E.S.A. | 3° | P3 | S1" -> "3°")
    function extractGradeFromQuizName(nameVal) {
        if (!nameVal) return '';
        const parts = String(nameVal).split('|').map(p => p.trim());
        const idx = parts.findIndex(isGradeToken);
        return idx !== -1 ? parts[idx] : '';
    }

    // Grado de una clase según su etiqueta (ej: "3°" -> "3°", "6-1" -> "6-1", "1° - 2°" -> "1° - 2°")
    function extractGradeFromClassLabel(text) {
        const clean = String(text || '').trim();
        if (!clean) return '';
        if (isGradeToken(clean)) return clean;
        const range = clean.match(/\d{1,2}\s*[º°ª]?\s*(?:[-–]|a)\s*\d{1,2}\s*[º°ª]?[A-Za-z]?/);
        if (range && !/^(S\d+|P\d+)$/i.test(range[0])) return range[0];
        const deg = clean.match(/\d{1,2}[º°ª]/);
        if (deg) return deg[0];
        // Códigos tipo "601" (grado 6, sección 01) o "1002" (grado 10, sección 02)
        const codeMatch = clean.match(/\b(\d{3,4})\b/);
        if (codeMatch) {
            const val = parseInt(codeMatch[1], 10);
            if (val >= 600 && val <= 1200) {
                const grade = Math.floor(val / 100);
                return grade + '°';
            }
        }
        const num = clean.match(/^\d{1,2}(?:-\d{1,2})?/);
        if (num) return num[0];
        return '';
    }

    // Marca en la lista de clases (checkbox) la PRIMERA clase cuyo grado coincida con gradeVal
    // y desmarca todas las demás (selección de UNA sola clase).
    function syncClassFromGrade(classesBox, gradeVal) {
        const g = String(gradeVal || '').trim();
        if (!g || !classesBox) return;
        const boxes = Array.from(classesBox.querySelectorAll('input[name="classList"]'));
        const match = boxes.find(cb => {
            const labelText = cb.parentElement ? cb.parentElement.textContent.trim() : '';
            return extractGradeFromClassLabel(labelText) === g;
        });
        if (match) {
            boxes.forEach(cb => { cb.checked = (cb === match); });
        }
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

    // Aplica la fecha heredada y las clases indicadas a un quiz recién copiado
    // usando el endpoint de edición (el endpoint de copia puede ignorar classList).
    // Devuelve true si la actualización se guardó correctamente.
    async function applyCopySettingsToQuiz(quizId, targetDate, targetClasses = null) {
        if (!quizId) return false;
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
            if (targetDate) params.append('quizDate', targetDate); // Asignar fecha heredada
            params.append('folder', folder);
            params.append('csrf_token', csrfToken);

            if (targetClasses && targetClasses.length) {
                // Usar las clases indicadas al copiar
                targetClasses.forEach(c => params.append('classList', c));
            } else {
                classInputs.forEach(inp => {
                    params.append('classList', inp.value);
                });
            }

            const saveResp = await fetch(editUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params.toString()
            });

            return saveResp.ok;
        } catch (e) {
            console.error("Error al actualizar el quiz copiado:", e);
            return false;
        }
    }

    async function updateQuizDateViaEdit(targetDate, targetClasses = null) {
        const quizIdMatch = window.location.pathname.match(/\/quiz\/([^/]+)/);
        if (!quizIdMatch) return;
        const quizId = quizIdMatch[1];
        const ok = await applyCopySettingsToQuiz(quizId, targetDate, targetClasses);
        if (ok) {
            console.log(`✅ [ZipGrade] Quiz actualizado exitosamente (fecha heredada: ${targetDate}, ${(targetClasses && targetClasses.length) ? targetClasses.length + ' clases asignadas' : 'clases sin cambio'}).`);
            window.location.reload();
        } else {
            console.warn("Fallo al actualizar el quiz copiado.");
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

    // Construye "Res - <nombre>" a partir del nombre del quiz (con el ° real), del <title>
    // de la página del quiz o del filename del servidor. Los separadores (|, _) se
    // convierten en " - " (guión); el ° se conserva porque Windows lo soporta.
    function buildResultsFilename(serverFilename, pageTitle, quizName, extension) {
        let base = '';
        if (quizName) {
            base = quizName;
        } else if (pageTitle && /^ZipGrade:\s*Quiz:\s*/i.test(pageTitle)) {
            base = pageTitle.replace(/^ZipGrade:\s*Quiz:\s*/i, '');
        } else if (serverFilename) {
            base = serverFilename.replace(/\.[^.]+$/, '');
        }
        base = truncateNameToSession(base);
        base = cleanResultsBaseName(base);
        return `Res - ${base}.${extension}`;
    }

    // Limpieza del nombre de archivo: separadores (|, _) -> " - ", caracteres
    // inválidos de Windows -> espacio, y se colapsan los guiones consecutivos.
    // El ° (U+00B0) se conserva tal cual: Windows lo soporta en nombres de archivo.
    function cleanResultsBaseName(name) {
        return String(name || '')
            .replace(/^(?:Resultados|Res)[_-]/i, '') // evitar "Res_Res..." / "Resultados_..."
            .replace(/[|_]+/g, ' - ')                // separadores -> guión
            .replace(/[\\/:*?"<>]+/g, ' ')           // inválidos de Windows -> espacio
            .replace(/\s*-\s*-+\s*/g, ' - ')         // colapsar guiones consecutivos
            .replace(/\s+/g, ' ')
            .replace(/^\s*-+\s*/g, '')               // sin guión inicial
            .replace(/\s*-+\s*$/g, '')               // sin guión final
            .trim();
    }

    // Obtiene los formatos de exportación personalizados del quiz actual
    async function fetchCustomExportFormats(quizAllBaseUrl, bypassCache) {
        const quizId = (quizAllBaseUrl.match(/\/quiz\/([^/]+)\/all\//) || [])[1];
        const cacheKey = quizId ? 'zg_formats_' + quizId : null;
        if (cacheKey && !bypassCache) {
            const cached = zgCacheGet(cacheKey, ZG_FORMATS_CACHE_TTL_MS);
            if (cached !== null && cached !== undefined) return cached;
        }
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
        if (cacheKey) zgCacheSet(cacheKey, formats);
        return formats;
    }

    // Descarga un formato personalizado y lo guarda con el nombre "Res - ..."
    async function downloadCustomExport(format, preferType, quizName) {
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
        const filename = buildResultsFilename(serverFilename, document.title, quizName, ext);
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
            // Al abrir el modal de copia nativo, desmarcar TODAS las clases para que
            // ninguna venga preseleccionada (el nuevo quiz no hereda las del origen).
            copyBtn.addEventListener('click', () => {
                const form = document.querySelector('form[action*="/quizzes/copyQuiz/"]');
                if (form) {
                    form.querySelectorAll('input[name="classList"]').forEach(inp => { inp.checked = false; });
                }
            });
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
            let targetClasses = null;
            try {
                targetClasses = JSON.parse(sessionStorage.getItem('zg_copy_source_classes') || 'null');
            } catch (e) {
                targetClasses = null;
            }
            sessionStorage.removeItem('zg_copy_pending');
            sessionStorage.removeItem('zg_copy_source_date');
            sessionStorage.removeItem('zg_copy_source_classes');

            if (targetDate || (targetClasses && targetClasses.length)) {
                updateQuizDateViaEdit(targetDate || '', targetClasses);
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
                            <input type="checkbox" id="zg-master-check" title="Seleccionar/Deseleccionar todos" style="margin:0; cursor:pointer; width:16px; height:16px; accent-color:#3c87c8;" />
                            <span style="font-family:'Open Sans', sans-serif; font-weight:300; font-size:17px; line-height:19px; color:#ffffff;">Descarga Rápida</span>
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

                        // La casilla de selección es la NATIVA de ZipGrade (columna 0)
                        const nativeChk = getNativeClassCheckbox(row);

                        // Evento cambio de plantilla
                        const rowSelect = td.querySelector('.zg-row-sheet');
                        rowSelect.addEventListener('change', () => {
                            if (rowSelect.value && nativeChk && !nativeChk.checked) {
                                setNativeCheckboxChecked(nativeChk, true);
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
                getNativeClassChecks().forEach(chk => setNativeCheckboxChecked(chk, state));
                const masterChk = document.getElementById('zg-master-check');
                if (masterChk) {
                    masterChk.checked = state;
                    refreshUniformVisual(masterChk);
                }
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

            // La selección NATIVA de ZipGrade (casillas de fila de #subjectTable) mantiene
            // sincronizados el contador y el master del toolkit.
            if (!zgClassesNativeSyncBound) {
                zgClassesNativeSyncBound = true;
                document.addEventListener('change', (e) => {
                    if (!e.target || !e.target.matches) return;
                    if (e.target.matches('#subjectTable input[type="checkbox"]')) {
                        setTimeout(() => updateSelectedCounter(), 0);
                    }
                });
            }

            document.getElementById('zg-btn-apply-checked').addEventListener('click', (e) => {
                e.preventDefault();
                const selectedSheet = document.getElementById('zg-bulk-apply-sheet').value;
                if (!selectedSheet) {
                    alert('Selecciona una hoja del menú para aplicar.');
                    return;
                }
                const checkedRows = getNativeClassChecks().filter(chk => chk.checked);
                if (checkedRows.length === 0) {
                    alert('Marca al menos una casilla en la tabla.');
                    return;
                }
                checkedRows.forEach(chk => {
                    const rowSelect = chk.closest('tr').querySelector('.zg-row-sheet');
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
                btnStop.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Deteniendo...';
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
                            setNativeCheckboxChecked(getNativeClassCheckbox(s.closest('tr')), true);
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
        const checkedBoxes = getNativeClassChecks().filter(chk => chk.checked);
        const queue = [];

        checkedBoxes.forEach(chk => {
            const select = chk.closest('tr').querySelector('.zg-row-sheet');
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
            btnStop.innerHTML = '<i class="fa fa-stop"></i> Detener';
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
})();// MARKER-TEST-123
