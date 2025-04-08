var current_state = 'form';
var history_stack = ['form'];
var history_index = 0;
var form_data = {}; // Datos del formulario original
var generated_html = ''; // HTML generado originalmente por /generate
var pdf_url = '';
var word_url = '';
var editorInstance;

// *** NUEVO ***: Función para restaurar los datos del formulario desde sessionStorage
function restoreFormData() {
    const savedFormData = sessionStorage.getItem('lastFormData');
    if (savedFormData) {
        try {
            const formData = JSON.parse(savedFormData);
            form_data = formData; // Actualiza la variable global también si es necesario

            // Rellena los campos del formulario
            Object.keys(formData).forEach(key => {
                const element = document.getElementById(key);
                if (element) {
                    // Manejo especial para selects (necesita que las opciones estén cargadas)
                    if (element.tagName === 'SELECT') {
                        // Intentar establecer el valor. Si las opciones se cargan dinámicamente después,
                        // esto podría necesitar ajustes o ejecutarse más tarde.
                        // Por ahora, establecemos el valor y disparamos 'change' para
                        // potencialmente cargar selects dependientes si la lógica lo soporta.
                        setTimeout(() => { // Pequeño retraso para permitir la carga inicial
                            element.value = formData[key];
                            if (element.value === formData[key]) { // Check if value was set successfully
                                element.dispatchEvent(new Event('change')); // Trigger dependent dropdowns
                            } else {
                                console.warn(`Could not set value "${formData[key]}" for select#${key}. Options might not be loaded yet.`);
                            }
                        }, 100);
                    } else if (element.type === 'textarea' || element.type === 'text' || element.type === 'hidden' || element.type === 'date') {
                        element.value = formData[key];
                    }
                    // Añadir más tipos si es necesario (checkbox, radio, etc.)
                }
            });

            // Restaurar estado específico de la fecha si es necesario
            if (formData.fecha && document.getElementById('fechaManualInput') && document.getElementById('fechaAutoInput')) {
                const isAutoDate = (formatearFecha(new Date()) === formData.fecha); // Heuristic guess
                const tipoFechaSelect = document.getElementById('tipoFecha');
                if (!isAutoDate && document.getElementById('fechaManualSelector')) {
                    // Attempt to set manual date selector if possible (might be tricky without original YYYY-MM-DD)
                    // For now, just set the formatted input and switch to manual
                    document.getElementById('fechaManualInput').value = formData.fecha;
                    tipoFechaSelect.value = 'manual';
                } else {
                    tipoFechaSelect.value = 'auto';
                }
                toggleFechaManual(); // Ensure correct fields are shown/hidden and named
            }


            console.log("Form data restored from sessionStorage.");
        } catch (e) {
            console.error("Error parsing or restoring saved form data", e);
        }
    }
}


// Function to update the UI based on the current state
function updateUI() {
    // Keep the form section always visible
    document.getElementById('form-section').style.display = 'block';
    document.getElementById('editor-section').style.display = current_state === 'editor' ? 'block' : 'none';
    document.getElementById('preview-section').style.display = current_state === 'preview' ? 'block' : 'none';

    const navigationButtonsDiv = document.getElementById('navigation-buttons');
    if (navigationButtonsDiv) {
        navigationButtonsDiv.style.display = 'flex'; // Always display the navigation buttons
    }

    // Update navigation button states
    const backButton = document.getElementById('back-button');
    const forwardButton = document.getElementById('forward-button');
    if (backButton) backButton.disabled = history_index === 0;
    if (forwardButton) forwardButton.disabled = history_index === history_stack.length - 1;

    if (current_state === 'editor') {
        // *** MODIFICADO ***: Determinar qué contenido cargar en el editor
        let contentToLoad = generated_html; // Por defecto, el último generado
        const savedContent = sessionStorage.getItem('lastEditedContent');

        if (savedContent) {
            // Si hay contenido guardado en la sesión (p.ej. se usó "atrás" después de guardar), usar ese
            console.log("Loading content from sessionStorage for editor.");
            contentToLoad = savedContent;
        } else {
            // Si no, usar el contenido generado por la llamada a /generate
            console.log("Loading generated content for editor.");
            contentToLoad = generated_html;
        }

        if (!editorInstance) {
            console.log("Initializing CKEditor...");
            CKEDITOR.replace('editor', {
                height: '800px',
                width: '100%'
            });
            CKEDITOR.on('instanceReady', function (evt) {
                editorInstance = evt.editor;
                console.log("CKEditor instance ready. Setting data.");
                editorInstance.setData(contentToLoad); // *** MODIFICADO ***: Usar contentToLoad
            });
        } else {
            console.log("CKEditor instance exists. Setting data.");
            // Asegurarse que la instancia esté lista antes de intentar usarla
            if (editorInstance.status === 'ready') {
                editorInstance.setData(contentToLoad); // *** MODIFICADO ***: Usar contentToLoad
            } else {
                // Si no está lista, esperar al evento instanceReady (aunque esto es menos común para una instancia existente)
                editorInstance.once('instanceReady', function () {
                    console.log("CKEditor instance became ready later. Setting data.");
                    editorInstance.setData(contentToLoad);
                });
            }
        }
    } else if (current_state === 'preview') {
        document.getElementById('pdf-preview').src = pdf_url + '?preview=1';
        document.getElementById('pdf-download-link').href = pdf_url;
        document.getElementById('word-download-link').href = word_url;
    }
}

// Function to validate the form
function validateForm() {
    let isValid = true;
    // Clear previous errors
    document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    document.querySelectorAll('#generate-form .required-field').forEach(el => el.classList.remove('required-field'));

    // Check required fields (ajustado para ser más preciso)
    const fieldsToCheck = [
        { id: 'nombre', name: 'Nombre' },
        { id: 'gerencia_a', name: 'Gerencia', isSelect: true },
        { id: 'area_a', name: 'Área', isSelect: true },
        { id: 'trabajador_a', name: 'Trabajador', isSelect: true },
        { id: 'gerencia_atencion', name: 'Gerencia', isSelect: true },
        { id: 'area_atencion', name: 'Área', isSelect: true },
        { id: 'trabajador_atencion', name: 'Trabajador', isSelect: true }
        // No validamos 'asunto' porque es readonly
        // Fecha se valida abajo
    ];

    fieldsToCheck.forEach(f => {
        const field = document.getElementById(f.id);
        const errorDiv = document.getElementById(f.id + '-error');
        if (!field || (f.isSelect && field.value === '') || (!f.isSelect && field.value.trim() === '')) {
            if (field) field.classList.add('required-field');
            if (errorDiv) errorDiv.textContent = `El campo ${f.name} es requerido.`;
            isValid = false;
        }
    });

    // Validar Fecha Manual si está seleccionada
    const tipoFecha = document.getElementById('tipoFecha').value;
    const fechaManualInput = document.getElementById('fechaManualInput');
    const fechaErrorDiv = document.getElementById('fechaManualInput-error');
    if (tipoFecha === 'manual') {
        if (fechaManualInput.value.trim() === '') {
            fechaManualInput.classList.add('required-field');
            if (fechaErrorDiv) fechaErrorDiv.textContent = 'Debe ingresar o seleccionar una fecha manual.';
            isValid = false;
        } else if (!fechaManualInput.value.match(/La Joya, \d{1,2} de (Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre) de \d{4}/)) {
            // Opcional: validar formato específico si es necesario
            fechaManualInput.classList.add('required-field');
            if (fechaErrorDiv) fechaErrorDiv.textContent = 'Formato de fecha inválido. Use "La Joya, DD de Mes de AAAA".';
            isValid = false;
        }
    }

    return isValid;
}

// Event listener for input changes to clear errors
document.querySelectorAll('#generate-form input:not([readonly]), #generate-form select, #generate-form textarea').forEach(field => {
    const eventType = (field.tagName === 'SELECT' || field.type === 'date') ? 'change' : 'input';
    field.addEventListener(eventType, function () {
        this.classList.remove('required-field');
        const errorDivId = this.id + '-error';
        const errorDiv = document.getElementById(errorDivId);
        if (errorDiv) errorDiv.textContent = '';
        // Re-validate select on change if needed (e.g., if user selects default "")
        if (this.tagName === 'SELECT' && this.value === '') {
            this.classList.add('required-field');
            if (errorDiv) errorDiv.textContent = 'Por favor, seleccione una opción.';
        }
    });
});

// Event listener for the initial form submission
document.getElementById('generate-form').addEventListener('submit', function (event) {
    event.preventDefault();
    if (validateForm()) {
        var formDataInstance = new FormData(this);

        // Asegurarse de que el campo de fecha correcto esté siendo enviado
        const tipoFecha = document.getElementById('tipoFecha').value;
        if (tipoFecha === 'auto') {
            formDataInstance.set('fecha', document.getElementById('fechaAutoInput').value);
        } else {
            formDataInstance.set('fecha', document.getElementById('fechaManualInput').value);
        }

        // Mostrar algún indicador de carga (opcional)
        const generateButton = document.getElementById('generate-button');
        generateButton.disabled = true;
        generateButton.textContent = 'Generando...';


        fetch('/generate', {
            method: 'POST',
            body: formDataInstance // Usar la instancia FormData directamente
        })
            .then(response => {
                if (!response.ok) {
                    // Intentar obtener el error del cuerpo si es JSON
                    return response.json().then(err => { throw new Error(err.error || `Error HTTP ${response.status}`) });
                }
                return response.json();
            })
            .then(data => {
                // *** NUEVO ***: Limpiar el contenido editado anterior y guardar datos del formulario actual
                console.log("Clearing lastEditedContent from sessionStorage.");
                sessionStorage.removeItem('lastEditedContent');
                console.log("Saving current form data to sessionStorage.");
                sessionStorage.setItem('lastFormData', JSON.stringify(data.form_data));

                form_data = data.form_data;
                generated_html = data.contenido_generado; // Actualizar el HTML generado global
                current_state = 'editor';

                // Actualizar historial solo si el estado nuevo es diferente al último
                if (history_stack[history_index] !== current_state) {
                    // Si estamos en medio del historial, truncar el futuro
                    if (history_index < history_stack.length - 1) {
                        history_stack = history_stack.slice(0, history_index + 1);
                    }
                    history_stack.push(current_state);
                    history_index++;
                } else {
                    // Si el estado es el mismo (p.ej., re-generar desde el editor), no añadir al historial
                    // pero sí actualizar la UI
                }


                updateUI();
                // Añadimos el autoscroll al CKEditor
                const editorSection = document.getElementById('editor-section');
                if (editorSection) {
                    setTimeout(() => {
                        const rect = editorSection.getBoundingClientRect();
                        const scrollTop = window.scrollY || document.documentElement.scrollTop;
                        // Calcular el centro de la sección del editor relativo al viewport
                        const editorCenterViewport = rect.top + rect.height / 2;
                        // Calcular la posición de scroll para centrar el editor en la pantalla
                        const desiredScrollTop = scrollTop + editorCenterViewport - window.innerHeight / 2;


                        window.scrollTo({ top: Math.max(0, desiredScrollTop), behavior: 'smooth' }); // Ensure not scrolling < 0
                    }, 300); // Aumentado el tiempo por si CKEditor tarda en renderizar
                }
            })
            .catch(error => {
                console.error('Error en /generate:', error);
                alert('Ocurrió un error al generar el informe: ' + error.message);
            })
            .finally(() => {
                // Reactivar botón de generar
                generateButton.disabled = false;
                generateButton.textContent = 'Generar Informe';
            });
    } else {
        console.log("Form validation failed.");
        // Opcional: Scroll al primer error
        const firstError = document.querySelector('.required-field');
        if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
});

// Event listener for the CKEditor form submission
document.getElementById('convert-form').addEventListener('submit', function (event) {
    event.preventDefault();

    // *** MODIFICADO ***: Asegurarse que editorInstance existe y está lista
    if (!editorInstance || editorInstance.status !== 'ready') {
        alert('El editor no está listo. Por favor espere.');
        return;
    }

    // *** MODIFICADO ***: Obtener contenido y guardarlo ANTES de enviar
    const editedHtml = editorInstance.getData();
    console.log("Saving edited content to sessionStorage before converting.");
    sessionStorage.setItem('lastEditedContent', editedHtml);

    var formData = new FormData();
    // *** MODIFICADO ***: Usar la variable 'editedHtml' que ya obtuvimos
    formData.append('contenido_html', editedHtml);

    // Mostrar algún indicador de carga (opcional)
    const convertButton = this.querySelector('button[type="submit"]');
    convertButton.disabled = true;
    convertButton.textContent = 'Convirtiendo...';

    fetch('/convert_document', {
        method: 'POST',
        body: formData
    })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error || `Error HTTP ${response.status}`) });
            }
            return response.json();
        })
        .then(data => {
            pdf_url = data.pdf_download_url;
            word_url = data.word_download_url;
            current_state = 'preview';

            // Actualizar historial
            if (history_stack[history_index] !== current_state) {
                if (history_index < history_stack.length - 1) {
                    history_stack = history_stack.slice(0, history_index + 1);
                }
                history_stack.push(current_state);
                history_index++;
            }

            updateUI();
            // Scroll a la preview
            document.getElementById('preview-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
        })
        .catch(error => {
            console.error('Error en /convert_document:', error);
            alert('Ocurrió un error al convertir el documento: ' + error.message);
        })
        .finally(() => {
            // Reactivar botón
            convertButton.disabled = false;
            convertButton.textContent = 'Guardar y Convertir a PDF/Word';
        });
});

// Event listener for the back button
document.getElementById('back-button').addEventListener('click', function () {
    if (history_index > 0) {
        history_index--;
        current_state = history_stack[history_index];
        console.log("Navigating back. New state:", current_state, "History index:", history_index);
        updateUI();
    }
});

// Event listener for the forward button
document.getElementById('forward-button').addEventListener('click', function () {
    if (history_index < history_stack.length - 1) {
        history_index++;
        current_state = history_stack[history_index];
        console.log("Navigating forward. New state:", current_state, "History index:", history_index);
        updateUI();
    }
});

// ----------------------------------------------------------
// --- Código existente para selects y fecha (SIN CAMBIOS) ---
// ----------------------------------------------------------
var gerenciaA = document.getElementById('gerencia_a');
var areaA = document.getElementById('area_a');
var trabajadorA = document.getElementById('trabajador_a');
var campoOficinaA = document.getElementById('oficina_a');
var campoA = document.getElementById('a');

gerenciaA.addEventListener('change', function () {
    var gerencia = gerenciaA.value;
    areaA.innerHTML = '<option value="">Seleccione un área</option>'; // Reset area
    trabajadorA.innerHTML = '<option value="">Seleccione un trabajador</option>'; // Reset trabajador
    campoOficinaA.value = ''; // Clear hidden field
    campoA.value = ''; // Clear hidden field

    if (gerencia && estructura.Gerencias[gerencia] && estructura.Gerencias[gerencia].Subgerencias) {
        var areas = Object.keys(estructura.Gerencias[gerencia].Subgerencias).sort(); // Sort areas alphabetically
        areas.forEach(function (area) {
            var option = document.createElement('option');
            option.value = area;
            option.text = area;
            areaA.appendChild(option);
        });
    }
    // Clear error on change
    this.classList.remove('required-field');
    const errorDiv = document.getElementById(this.id + '-error');
    if (errorDiv) errorDiv.textContent = '';
    // Clear errors of dependent fields as well
    areaA.classList.remove('required-field');
    document.getElementById(areaA.id + '-error').textContent = '';
    trabajadorA.classList.remove('required-field');
    document.getElementById(trabajadorA.id + '-error').textContent = '';
});

areaA.addEventListener('change', function () {
    var gerencia = gerenciaA.value;
    var area = areaA.value;
    trabajadorA.innerHTML = '<option value="">Seleccione un trabajador</option>'; // Reset trabajador
    campoA.value = ''; // Clear hidden field

    if (gerencia && area && estructura.Gerencias[gerencia] && estructura.Gerencias[gerencia].Subgerencias &&
        estructura.Gerencias[gerencia].Subgerencias[area]) {
        var trabajadores = estructura.Gerencias[gerencia].Subgerencias[area].sort(); // Sort workers alphabetically
        trabajadores.forEach(function (trabajador) {
            var option = document.createElement('option');
            option.value = trabajador;
            option.text = trabajador;
            trabajadorA.appendChild(option);
        });
    }
    campoOficinaA.value = area; // Set hidden field

    // Clear error on change
    this.classList.remove('required-field');
    const errorDiv = document.getElementById(this.id + '-error');
    if (errorDiv) errorDiv.textContent = '';
    // Clear errors of dependent fields as well
    trabajadorA.classList.remove('required-field');
    document.getElementById(trabajadorA.id + '-error').textContent = '';
});

trabajadorA.addEventListener('change', function () {
    campoA.value = trabajadorA.value; // Set hidden field
    // Clear error on change
    this.classList.remove('required-field');
    const errorDiv = document.getElementById(this.id + '-error');
    if (errorDiv) errorDiv.textContent = '';
});

// BLOQUE "ATENCIÓN:"
var gerenciaAtencion = document.getElementById('gerencia_atencion');
var areaAtencion = document.getElementById('area_atencion');
var trabajadorAtencion = document.getElementById('trabajador_atencion');
var campoSubgerenciaAtencion = document.getElementById('subgerencia_atencion');
var campoAtencion = document.getElementById('atencion');

gerenciaAtencion.addEventListener('change', function () {
    var gerencia = gerenciaAtencion.value;
    areaAtencion.innerHTML = '<option value="">Seleccione un área</option>'; // Reset area
    trabajadorAtencion.innerHTML = '<option value="">Seleccione un trabajador</option>'; // Reset trabajador
    campoSubgerenciaAtencion.value = ''; // Clear hidden field
    campoAtencion.value = ''; // Clear hidden field

    if (gerencia && estructura.Gerencias[gerencia] && estructura.Gerencias[gerencia].Subgerencias) {
        var areas = Object.keys(estructura.Gerencias[gerencia].Subgerencias).sort(); // Sort areas
        areas.forEach(function (area) {
            var option = document.createElement('option');
            option.value = area;
            option.text = area;
            areaAtencion.appendChild(option);
        });
    }
    // Clear error on change
    this.classList.remove('required-field');
    const errorDiv = document.getElementById(this.id + '-error');
    if (errorDiv) errorDiv.textContent = '';
    // Clear errors of dependent fields as well
    areaAtencion.classList.remove('required-field');
    document.getElementById(areaAtencion.id + '-error').textContent = '';
    trabajadorAtencion.classList.remove('required-field');
    document.getElementById(trabajadorAtencion.id + '-error').textContent = '';
});

areaAtencion.addEventListener('change', function () {
    var gerencia = gerenciaAtencion.value;
    var area = areaAtencion.value;
    trabajadorAtencion.innerHTML = '<option value="">Seleccione un trabajador</option>'; // Reset trabajador
    campoAtencion.value = ''; // Clear hidden field

    if (gerencia && area && estructura.Gerencias[gerencia] && estructura.Gerencias[gerencia].Subgerencias &&
        estructura.Gerencias[gerencia].Subgerencias[area]) {
        var trabajadores = estructura.Gerencias[gerencia].Subgerencias[area].sort(); // Sort workers
        trabajadores.forEach(function (trabajador) {
            var option = document.createElement('option');
            option.value = trabajador;
            option.text = trabajador;
            trabajadorAtencion.appendChild(option);
        });
    }
    campoSubgerenciaAtencion.value = area; // Set hidden field
    // Clear error on change
    this.classList.remove('required-field');
    const errorDiv = document.getElementById(this.id + '-error');
    if (errorDiv) errorDiv.textContent = '';
    // Clear errors of dependent fields as well
    trabajadorAtencion.classList.remove('required-field');
    document.getElementById(trabajadorAtencion.id + '-error').textContent = '';
});

trabajadorAtencion.addEventListener('change', function () {
    campoAtencion.value = trabajadorAtencion.value; // Set hidden field
    // Clear error on change
    this.classList.remove('required-field');
    const errorDiv = document.getElementById(this.id + '-error');
    if (errorDiv) errorDiv.textContent = '';
});

// --- Funciones para manejo de fechas ---
const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
function formatearFecha(fecha) {
    // Validar que fecha sea un objeto Date válido
    if (!(fecha instanceof Date) || isNaN(fecha)) {
        // Intentar parsear si es string YYYY-MM-DD (común de input date)
        if (typeof fecha === 'string' && fecha.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const parts = fecha.split('-');
            fecha = new Date(parts[0], parts[1] - 1, parts[2]); // Mes es 0-indexado
            if (isNaN(fecha)) return "Fecha inválida"; // Falló el parseo
        } else {
            return "Fecha inválida"; // No se pudo determinar la fecha
        }
    }
    const dia = fecha.getDate();
    const mesIndex = fecha.getMonth(); // 0-11
    const mes = meses[mesIndex];
    const anio = fecha.getFullYear();
    return `La Joya, ${dia} de ${mes} de ${anio}`;
}
function actualizarFechaAuto() {
    const hoy = new Date();
    const fechaFormateada = formatearFecha(hoy);
    const spanFechaAuto = document.getElementById('fechaFormateadaAuto');
    const inputFechaAuto = document.getElementById('fechaAutoInput');
    if (spanFechaAuto) spanFechaAuto.textContent = fechaFormateada;
    if (inputFechaAuto) inputFechaAuto.value = fechaFormateada;
}
function actualizarFechaManual() {
    const selectorFechaManual = document.getElementById('fechaManualSelector');
    const inputFechaManual = document.getElementById('fechaManualInput');
    const errorDiv = document.getElementById(inputFechaManual.id + '-error');

    if (selectorFechaManual && inputFechaManual) {
        const valorFecha = selectorFechaManual.value; // YYYY-MM-DD
        if (valorFecha) {
            const fechaFormateada = formatearFecha(valorFecha);
            inputFechaManual.value = fechaFormateada;
            // Clear error if date is validly selected and formatted
            if (fechaFormateada !== "Fecha inválida") {
                inputFechaManual.classList.remove('required-field');
                if (errorDiv) errorDiv.textContent = '';
            }
        } else {
            // Si el selector está vacío, limpiar el input formateado
            inputFechaManual.value = '';
        }
    }
}

function toggleFechaManual() {
    const tipoFechaSelect = document.getElementById('tipoFecha');
    const fechaAutoDiv = document.getElementById('fechaAutoDiv');
    const fechaManualDiv = document.getElementById('fechaManualDiv');
    const fechaManualInput = document.getElementById('fechaManualInput');
    const fechaAutoInput = document.getElementById('fechaAutoInput');
    const fechaManualSelector = document.getElementById('fechaManualSelector');
    const errorDiv = document.getElementById('fechaManualInput-error');


    if (!tipoFechaSelect || !fechaAutoDiv || !fechaManualDiv || !fechaManualInput || !fechaAutoInput) {
        console.error("Uno o más elementos de fecha no encontrados.");
        return;
    }

    const tipoFecha = tipoFechaSelect.value;

    if (tipoFecha === 'auto') {
        fechaAutoDiv.classList.remove('hidden');
        fechaManualDiv.classList.add('hidden');
        fechaManualInput.name = ''; // No enviar este campo
        fechaAutoInput.name = 'fecha'; // Enviar este campo
        // Limpiar error manual al cambiar a auto
        fechaManualInput.classList.remove('required-field');
        if (errorDiv) errorDiv.textContent = '';
        // Asegurar que la fecha auto esté actualizada
        actualizarFechaAuto();
    } else { // tipoFecha === 'manual'
        fechaAutoDiv.classList.add('hidden');
        fechaManualDiv.classList.remove('hidden');
        fechaManualInput.name = 'fecha'; // Enviar este campo
        fechaAutoInput.name = ''; // No enviar este campo
        // Actualizar (y potencialmente validar) la fecha manual al cambiar a manual
        actualizarFechaManual();
    }
}

// Inicialización al cargar la página
window.onload = function () {
    console.log("Window loaded. Initializing...");
    // Configurar fecha automática inicial
    actualizarFechaAuto();
    // Establecer valor inicial del selector de fecha manual a hoy
    const hoy = new Date();
    const formattedDate = hoy.toISOString().split('T')[0]; // YYYY-MM-DD
    const fechaManualSelector = document.getElementById('fechaManualSelector');
    if (fechaManualSelector) fechaManualSelector.value = formattedDate;
    // Actualizar el input formateado manual inicial
    actualizarFechaManual();

    // *** NUEVO ***: Intentar restaurar datos del formulario al cargar
    restoreFormData();

    // Configurar el estado inicial de los divs de fecha basado en el select
    toggleFechaManual();

    // Inicializar la UI basada en el estado actual (debería ser 'form' inicialmente)
    updateUI();
    console.log("Initialization complete. Current state:", current_state);
};