from flask import Flask, render_template, request, send_file, redirect, url_for
from io import BytesIO
from datetime import datetime
import subprocess
import tempfile
import os

app = Flask(__name__)
app.secret_key = 'tu_clave_secreta'

# Ruta principal: subir documento y convertirlo a LaTeX usando pandoc (mejor conversión)
@app.route('/', methods=['GET', 'POST'])
def upload_file():
    if request.method == 'POST':
        uploaded_file = request.files.get('file')
        if uploaded_file and uploaded_file.filename != '':
            # Guardar el archivo temporalmente
            ext = os.path.splitext(uploaded_file.filename)[1]
            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
                temp_file.write(uploaded_file.read())
                temp_filepath = temp_file.name
            
            # Convertir el archivo a LaTeX usando pandoc con opciones adicionales:
            # -s : Standalone (documento completo)
            # --wrap=preserve : No re-formatear líneas (preservar saltos)
            # --columns=9999 : Evitar que se introduzcan saltos de línea automáticos
            try:
                latex_output = subprocess.check_output(
                    ["pandoc", temp_filepath, "-t", "latex", "-s", "--wrap=preserve", "--columns=9999"],
                    encoding="utf-8"
                )
            except subprocess.CalledProcessError as e:
                os.remove(temp_filepath)
                return "Error en la conversión a LaTeX: " + str(e), 500
            
            os.remove(temp_filepath)
            return render_template('edit_latex.html', latex_text=latex_output)
    return render_template('upload.html')

# Ruta para generar el documento final en LaTeX mediante la IA y mostrar preview editable
@app.route('/generate', methods=['POST'])
def generate_document():
    replacement_names = request.form.get('names')
    custom_body = request.form.get('body')
    latex_text = request.form.get('latex_text')
    system_date = datetime.now().strftime("%d/%m/%Y")
    
    prompt = f"""
Por favor, actualiza el siguiente documento LaTeX.

% Nombres a reemplazar: {replacement_names}
% Fecha: {system_date}
% Instrucciones adicionales: {custom_body}

Documento original:
{latex_text}

Responde solo con el documento en LaTeX actualizado.
"""
    # Llamada a la IA (se asume que ollama devuelve LaTeX)
    command = ["ollama", "run", "gemma3:4b"]
    result = subprocess.run(
        command,
        input=prompt,
        text=True,
        capture_output=True,
        encoding='utf-8'
    )
    response_latex = result.stdout.strip()
    
    return render_template('preview_latex.html', response_latex=response_latex)

# Ruta para convertir a PDF el documento LaTeX final
@app.route('/convert_pdf', methods=['POST'])
def convert_pdf():
    response_latex = request.form.get('response_latex')
    if not response_latex:
        return "No se recibió el contenido LaTeX.", 400
    
    # Guardar LaTeX en archivo temporal
    with tempfile.NamedTemporaryFile(delete=False, suffix=".tex", mode="w", encoding="utf-8") as tex_file:
        tex_file.write(response_latex)
        tex_filepath = tex_file.name
    
    pdf_filepath = tex_filepath.replace(".tex", ".pdf")
    # Convertir a PDF usando pandoc con pdflatex (o xelatex, según disponibilidad)
    pandoc_command = ["pandoc", tex_filepath, "-o", pdf_filepath, "--pdf-engine=pdflatex"]
    subprocess.run(pandoc_command, check=True)
    
    with open(pdf_filepath, "rb") as f:
        pdf_bytes = f.read()
    
    os.remove(tex_filepath)
    os.remove(pdf_filepath)
    
    return send_file(BytesIO(pdf_bytes),
                     as_attachment=True,
                     download_name="documento_final.pdf",
                     mimetype="application/pdf")

if __name__ == '__main__':
    app.run(debug=True)
