var current_state = 'form';
var history_stack = ['form'];
var history_index = 0;
var form_data = {};
var generated_html = '';
var pdf_url = '';
var word_url = '';
var editorInstance;

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

    if (current_state === 'editor' && !editorInstance) {
        CKEDITOR.replace('editor', {
            height: '800px',
            width: '100%'
        });
        CKEDITOR.on('instanceReady', function (evt) {
            editorInstance = evt.editor;
            editorInstance.setData(generated_html);
        });
    } else if (current_state === 'editor' && editorInstance) {
        editorInstance.setData(generated_html);
    } else if (current_state === 'preview') {
        document.getElementById('pdf-preview').src = pdf_url + '?preview=1';
        document.getElementById('pdf-download-link').href = pdf_url;
        document.getElementById('word-download-link').href = word_url;
    }
}

// Function to validate the form
function validateForm() {
    let isValid = true;
    const requiredFields = document.querySelectorAll('#generate-form input:not([readonly]), #generate-form select');

    requiredFields.forEach(field => {
        const errorDivId = field.id + '-error';
        const errorDiv = document.getElementById(errorDivId);

        field.classList.remove('required-field');
        if (errorDiv) errorDiv.textContent = '';

        if (field.tagName === 'SELECT') {
            if (field.value === '') {
                field.classList.add('required-field');
                if (errorDiv) errorDiv.textContent = 'Por favor, seleccione una opción.';
                isValid = false;
            }
        } else if (field.type === 'text' && field.value.trim() === '') {
            field.classList.add('required-field');
            if (errorDiv) errorDiv.textContent = 'Este campo es requerido.';
            isValid = false;
        } else if (field.type === 'date' && field.value === '') {
            field.classList.add('required-field');
            if (errorDiv) errorDiv.textContent = 'Por favor, seleccione una fecha.';
            isValid = false;
        } else if (field.id === 'fechaManualInput' && document.getElementById('tipoFecha').value === 'manual' && field.value.trim() === '') {
            field.classList.add('required-field');
            if (errorDiv) errorDiv.textContent = 'Por favor, ingrese la fecha.';
            isValid = false;
        }
    });

    return isValid;
}

// Event listener for input changes to clear errors
document.querySelectorAll('#generate-form input:not([readonly]), #generate-form select').forEach(field => {
    field.addEventListener('input', function () {
        this.classList.remove('required-field');
        const errorDivId = this.id + '-error';
        const errorDiv = document.getElementById(errorDivId);
        if (errorDiv) errorDiv.textContent = '';
    });
    field.addEventListener('change', function () {
        this.classList.remove('required-field');
        const errorDivId = this.id + '-error';
        const errorDiv = document.getElementById(errorDivId);
        if (errorDiv) errorDiv.textContent = '';
        // For select elements, we might need to re-validate if a default empty option exists
        if (this.tagName === 'SELECT') {
            if (this.value === '') {
                this.classList.add('required-field');
                if (errorDiv) errorDiv.textContent = 'Por favor, seleccione una opción.';
            }
        }
    });
});

// Event listener for the initial form submission
document.getElementById('generate-form').addEventListener('submit', function (event) {
    event.preventDefault();
    if (validateForm()) {
        var formData = new FormData(this);

        fetch('/generate', {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert('Error: ' + data.error);
                } else {
                    form_data = data.form_data;
                    generated_html = data.contenido_generado;
                    current_state = 'editor';
                    history_stack.push(current_state);
                    history_index++;
                    updateUI();
                    // Añadimos el autoscroll al CKEditor
                    const editorSection = document.getElementById('editor-section');
                    if (editorSection) {
                        setTimeout(() => {
                            const rect = editorSection.getBoundingClientRect();
                            const scrollTop = window.scrollY || document.documentElement.scrollTop;
                            const desiredTop = scrollTop + rect.top - 100; // Aumentamos el offset para subirlo más

                            window.scrollTo({ top: desiredTop, behavior: 'smooth' });
                        }, 200); // Esperamos 200 milisegundos para asegurarnos de que el editor esté completamente cargado
                    }
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Ocurrió un error al generar el informe.');
            });
    }
});

// Event listener for the CKEditor form submission
document.getElementById('convert-form').addEventListener('submit', function (event) {
    event.preventDefault();
    var formData = new FormData();
    formData.append('contenido_html', CKEDITOR.instances.editor.getData());

    fetch('/convert_document', {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert('Error: ' + data.error);
            } else {
                pdf_url = data.pdf_download_url;
                word_url = data.word_download_url;
                current_state = 'preview';
                history_stack.push(current_state);
                history_index++;
                updateUI();
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Ocurrió un error al convertir el documento.');
        });
});

// Event listener for the back button
document.getElementById('back-button').addEventListener('click', function () {
    if (history_index > 0) {
        history_index--;
        current_state = history_stack[history_index];
        updateUI();
    }
});

// Event listener for the forward button
document.getElementById('forward-button').addEventListener('click', function () {
    if (history_index < history_stack.length - 1) {
        history_index++;
        current_state = history_stack[history_index];
        updateUI();
    }
});

// Variables y scripts para la manipulación de los selectores de Gerencias, Áreas, Trabajadores y fechas.
// (Keep the existing JavaScript for dropdowns and date handling)
var gerenciaA = document.getElementById('gerencia_a');
var areaA = document.getElementById('area_a');
var trabajadorA = document.getElementById('trabajador_a');
var campoOficinaA = document.getElementById('oficina_a');
var campoA = document.getElementById('a');

gerenciaA.addEventListener('change', function () {
    var gerencia = gerenciaA.value;
    areaA.innerHTML = '<option value="">Seleccione un área</option>';
    trabajadorA.innerHTML = '<option value="">Seleccione un trabajador</option>';
    if (estructura.Gerencias[gerencia] && estructura.Gerencias[gerencia].Subgerencias) {
        var areas = Object.keys(estructura.Gerencias[gerencia].Subgerencias);
        areas.forEach(function (area) {
            var option = document.createElement('option');
            option.value = area;
            option.text = area;
            areaA.appendChild(option);
        });
    }
    this.classList.remove('required-field');
    const errorDiv = document.getElementById(this.id + '-error');
    if (errorDiv) errorDiv.textContent = '';
});

areaA.addEventListener('change', function () {
    var gerencia = gerenciaA.value;
    var area = areaA.value;
    trabajadorA.innerHTML = '<option value="">Seleccione un trabajador</option>';
    if (estructura.Gerencias[gerencia] && estructura.Gerencias[gerencia].Subgerencias &&
        estructura.Gerencias[gerencia].Subgerencias[area]) {
        var trabajadores = estructura.Gerencias[gerencia].Subgerencias[area];
        trabajadores.forEach(function (trabajador) {
            var option = document.createElement('option');
            option.value = trabajador;
            option.text = trabajador;
            trabajadorA.appendChild(option);
        });
    }
    campoOficinaA.value = area;
    this.classList.remove('required-field');
    const errorDiv = document.getElementById(this.id + '-error');
    if (errorDiv) errorDiv.textContent = '';
});

trabajadorA.addEventListener('change', function () {
    campoA.value = trabajadorA.value;
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
    areaAtencion.innerHTML = '<option value="">Seleccione un área</option>';
    trabajadorAtencion.innerHTML = '<option value="">Seleccione un trabajador</option>';
    if (estructura.Gerencias[gerencia] && estructura.Gerencias[gerencia].Subgerencias) {
        var areas = Object.keys(estructura.Gerencias[gerencia].Subgerencias);
        areas.forEach(function (area) {
            var option = document.createElement('option');
            option.value = area;
            option.text = area;
            areaAtencion.appendChild(option);
        });
    }
    this.classList.remove('required-field');
    const errorDiv = document.getElementById(this.id + '-error');
    if (errorDiv) errorDiv.textContent = '';
});

areaAtencion.addEventListener('change', function () {
    var gerencia = gerenciaAtencion.value;
    var area = areaAtencion.value;
    trabajadorAtencion.innerHTML = '<option value="">Seleccione un trabajador</option>';
    if (estructura.Gerencias[gerencia] && estructura.Gerencias[gerencia].Subgerencias &&
        estructura.Gerencias[gerencia].Subgerencias[area]) {
        var trabajadores = estructura.Gerencias[gerencia].Subgerencias[area];
        trabajadores.forEach(function (trabajador) {
            var option = document.createElement('option');
            option.value = trabajador;
            option.text = trabajador;
            trabajadorAtencion.appendChild(option);
        });
    }
    campoSubgerenciaAtencion.value = area;
    this.classList.remove('required-field');
    const errorDiv = document.getElementById(this.id + '-error');
    if (errorDiv) errorDiv.textContent = '';
});

trabajadorAtencion.addEventListener('change', function () {
    campoAtencion.value = trabajadorAtencion.value;
    this.classList.remove('required-field');
    const errorDiv = document.getElementById(this.id + '-error');
    if (errorDiv) errorDiv.textContent = '';
});

// Funciones para manejo de fechas
const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
function formatearFecha(fecha) {
    const dia = fecha.getDate();
    const mes = meses[fecha.getMonth()];
    const anio = fecha.getFullYear();
    return `La Joya, ${dia} de ${mes} de ${anio}`;
}
function actualizarFechaAuto() {
    const hoy = new Date();
    const fechaFormateada = formatearFecha(hoy);
    document.getElementById('fechaFormateadaAuto').textContent = fechaFormateada;
    document.getElementById('fechaAutoInput').value = fechaFormateada;
}
function actualizarFechaManual() {
    const valorFecha = document.getElementById('fechaManualSelector').value;
    if (valorFecha) {
        const partes = valorFecha.split("-");
        const fechaSeleccionada = new Date(partes[0], partes[1] - 1, partes[2]);
        const fechaFormateada = formatearFecha(fechaSeleccionada);
        document.getElementById('fechaManualInput').value = fechaFormateada;
    }
    const manualInput = document.getElementById('fechaManualInput');
    manualInput.classList.remove('required-field');
    const errorDiv = document.getElementById(manualInput.id + '-error');
    if (errorDiv) errorDiv.textContent = '';
}
function toggleFechaManual() {
    const tipoFecha = document.getElementById('tipoFecha').value;
    if (tipoFecha === 'auto') {
        document.getElementById('fechaAutoDiv').classList.remove('hidden');
        document.getElementById('fechaManualDiv').classList.add('hidden');
        document.getElementById('fechaManualInput').name = '';
        document.getElementById('fechaAutoInput').name = 'fecha';
        // Clear error if switching to auto
        const manualInput = document.getElementById('fechaManualInput');
        manualInput.classList.remove('required-field');
        const errorDiv = document.getElementById(manualInput.id + '-error');
        if (errorDiv) errorDiv.textContent = '';
    } else {
        document.getElementById('fechaAutoDiv').classList.add('hidden');
        document.getElementById('fechaManualDiv').classList.remove('hidden');
        document.getElementById('fechaManualInput').name = 'fecha';
        document.getElementById('fechaAutoInput').name = '';
        // Trigger manual date update to format and potentially validate
        actualizarFechaManual();
    }
}
window.onload = function () {
    actualizarFechaAuto();
    const hoy = new Date();
    const formattedDate = hoy.toISOString().split('T')[0];
    document.getElementById('fechaManualSelector').value = formattedDate;
    actualizarFechaManual();
    updateUI(); // Initialize the UI
};