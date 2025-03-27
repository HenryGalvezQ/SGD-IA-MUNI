from flask import Flask, render_template, request, send_file, url_for, jsonify
import jinja2
import pdfkit
import os
from datetime import datetime
from dotenv import load_dotenv
from openai import OpenAI
from spire.doc import *
from spire.doc.common import *
import json
import re

# Cargar variables de entorno desde el archivo .env
load_dotenv()

app = Flask(__name__)
app.secret_key = 'tu_clave_secreta'

# Configurar el cliente de OpenAI con la API key
api_key = os.environ.get("OPENAI_API_KEY")
if not api_key:
    raise Exception("API key no encontrada. Asegúrate de definir OPENAI_API_KEY en el archivo .env.")
client = OpenAI(api_key=api_key)

# Función para cargar la estructura organizacional desde el JSON
def load_estructura():
    with open("estructura.json", "r", encoding="utf-8") as f:
        return json.load(f)

# Eliminar la primera línea si es '```html' y la última línea si es '```'
def limpiar_respuesta(respuesta):
    # Eliminar ```html al principio y ``` al final usando regex
    respuesta = re.sub(r'^```html\n', '', respuesta)  # Eliminar la primera línea (si es ```html)
    respuesta = re.sub(r'\n```$', '', respuesta)      # Eliminar la última línea (si es ```)
    return respuesta.strip()

@app.route("/", methods=["GET"])
def index():
    # Mostrar el formulario para ingresar nombre, fecha e instrucciones para el informe
    return render_template("form.html", estructura=load_estructura())

@app.route("/generate", methods=["POST"])
def generate_document():
    # Recoger datos de la cabecera y del formulario
    nombre = request.form.get("nombre")
    fecha = request.form.get("fecha")
    asunto = request.form.get("asunto")
    instrucciones_usuario = request.form.get("instrucciones")

    # Campos para "A:" y "ATENCIÓN:"
    a = request.form.get("a")
    oficina_a = request.form.get("oficina_a")
    atencion = request.form.get("atencion")
    subgerencia_atencion = request.form.get("subgerencia_atencion")

    if not (nombre and fecha and a and oficina_a and atencion and subgerencia_atencion):
        return jsonify({"error": "Faltan datos"}), 400

    match = re.search(r'de\s+(\w+)\s+de', fecha)
    month = match.group(1).upper() if match else ""
    asunto = asunto + " " + month

    with open("prompts/reglas_prompt.txt", "r", encoding="utf-8") as f:
        reglas = f.read()
    with open("prompts/formato_practicas_prompt.txt", "r", encoding="utf-8") as f:
        formato = f.read()

    prompt = (
        reglas + "\n" +
        f"Genera el cuerpo del informe de prácticas para un estudiante llamado {nombre} con fecha {fecha} con html " +
        (instrucciones_usuario if instrucciones_usuario else "") + "\n" +
        formato
    )

    try:
        response = client.responses.create(
            model="gpt-4o-mini",
            instructions="Genera un informe de prácticas detallado.",
            input=prompt,
        )
        cuerpo = limpiar_respuesta(response.output_text.strip())
    except Exception as e:
        return jsonify({"error": f"Error al generar el cuerpo del informe: {str(e)}"}), 500

    info = {
        "nombre": nombre,
        "a": a,
        "oficina_a": oficina_a,
        "atencion": atencion,
        "subgerencia_atencion": subgerencia_atencion,
        "asunto": asunto,
        "fecha": fecha,
        "cuerpo": cuerpo
    }

    # Generar el HTML del informe usando el template
    ruta_template = r"plantillas/informe_practicas.html"
    ruta_css = r"plantillas/style.css"
    nombre_template = os.path.basename(ruta_template)
    ruta_template_dir = os.path.dirname(ruta_template)
    env = jinja2.Environment(loader=jinja2.FileSystemLoader(ruta_template_dir))
    template = env.get_template(nombre_template)
    contenido_generado = template.render(info)

    return jsonify({"contenido_generado": contenido_generado, "form_data": request.form.to_dict()})

@app.route("/convert_document", methods=["POST"])
def convert_document():
    # Obtener el contenido HTML enviado vía formulario (POST)
    contenido_html = request.form.get("contenido_html")
    if not contenido_html:
        return jsonify({"error": "No se recibió contenido"}), 400

    # Definir las opciones de configuración para la generación del PDF
    options = {
        'page-size': 'A4',
        'margin-top': '1in',
        'margin-right': '1in',
        'margin-bottom': '1in',
        'margin-left': '1in',
        'encoding': 'UTF-8'
    }

    # Crear un timestamp para nombrar de forma única los archivos de salida
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    # Definir las rutas de salida para el PDF y el documento Word
    ruta_pdf_salida = f'salidas/salida_{timestamp}.pdf'
    ruta_word_salida = f'salidas/salida_{timestamp}.docx'

    # Ruta del archivo CSS para estilizar el PDF y configuración de wkhtmltopdf
    ruta_css = r"plantillas/style.css"
    config = pdfkit.configuration(wkhtmltopdf='C:/Program Files/wkhtmltopdf/bin/wkhtmltopdf.exe')

    # Generar el PDF a partir del contenido HTML proporcionado
    try:
        pdfkit.from_string(contenido_html, ruta_pdf_salida, css=ruta_css, options=options, configuration=config)
    except Exception as e:
        return jsonify({"error": f"Error al generar el PDF: {str(e)}"}), 500

    # Crear la ruta para un archivo HTML temporal que servirá para generar el DOCX
    temp_html_path = f'salidas/temp_{timestamp}.html'

    # Leer el estilo específico para Word desde un archivo de plantilla
    with open("plantillas/style_word.txt", "r", encoding="utf-8") as f:
        estilo = f.read()

    # Combinar el estilo con el contenido HTML y agregar las etiquetas de cierre de HTML
    contenido_html = estilo + contenido_html + "\n </body>\n</html>"

    # Escribir el contenido HTML modificado en el archivo temporal
    with open(temp_html_path, 'w', encoding='utf-8') as f:
        f.write(contenido_html)

    try:
        # Crear el documento de Word usando Spire.Doc
        document = Document()
        # Cargar el contenido del archivo HTML temporal en el documento
        document.LoadFromFile(temp_html_path, FileFormat.Html)
        # Guardar el documento en formato DOCX
        document.SaveToFile(ruta_word_salida, FileFormat.Docx2016)
        # Cerrar el documento y liberar recursos
        document.Close()
        document.Dispose()
    except Exception as e:
        return jsonify({"error": f"Error al generar el Word document: {str(e)}"}), 500
    finally:
        # Eliminar el archivo HTML temporal para limpiar recursos
        try:
            if os.path.exists(temp_html_path):
                os.remove(temp_html_path)
        except:
            pass

    # Obtener solo el nombre de los archivos para facilitar su descarga
    pdf_filename = os.path.basename(ruta_pdf_salida)
    word_filename = os.path.basename(ruta_word_salida)

    return jsonify({
        "preview_pdf": pdf_filename,
        "pdf_download_url": url_for('download', tipo='pdf', filename=pdf_filename),
        "word_download_url": url_for('download', tipo='word', filename=word_filename)
    })

@app.route("/download/<tipo>/<filename>")
def download(tipo, filename):
    base_dir = r"salidas/"
    filepath = os.path.join(base_dir, filename)

    if not os.path.exists(filepath):
        return "Archivo no encontrado", 404

    # Si se solicita preview, se muestra inline
    if request.args.get('preview'):
        return send_file(filepath, as_attachment=False)
    return send_file(filepath, as_attachment=True)

if __name__ == "__main__":
    app.run(debug=True)