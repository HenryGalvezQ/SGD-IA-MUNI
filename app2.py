from flask import Flask, render_template, request, send_file, url_for
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

# Función para crear el PDF y el Word siguiendo tu ejemplo
def crea_pdf_y_word(ruta_template, info, rutacss=''):
    # Cargar el template
    nombre_template = ruta_template.split('/')[-1]
    ruta_template_dir = ruta_template.replace(nombre_template, '')
    env = jinja2.Environment(loader=jinja2.FileSystemLoader(ruta_template_dir))
    template = env.get_template(nombre_template)

    # Renderizar el HTML con la información proporcionada
    html = template.render(info)

    # Opciones para generar el PDF
    options = {
        'page-size': 'A4',
        'margin-top': '1in',
        'margin-right': '1in',
        'margin-bottom': '1in',
        'margin-left': '1in',
        'encoding': 'UTF-8'
    }

    # Crear rutas de salida con timestamp para evitar conflictos
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    ruta_pdf_salida = f'C:/Users/ADVANCE/Documents/tesis/plantillas/salida_{timestamp}.pdf'
    ruta_word_salida = f'C:/Users/ADVANCE/Documents/tesis/plantillas/salida_{timestamp}.docx'

    # Configuración de PDF con wkhtmltopdf
    config = pdfkit.configuration(wkhtmltopdf='C:/Program Files/wkhtmltopdf/bin/wkhtmltopdf.exe')
    pdfkit.from_string(html, ruta_pdf_salida, options=options, configuration=config)

    # Crear archivo temporal HTML para generar el DOCX
    temp_html_path = f'C:/Users/ADVANCE/Documents/tesis/plantillas/temp_{timestamp}.html'
    with open(temp_html_path, 'w', encoding='utf-8') as f:
        f.write(html)

    try:
        # Crear el archivo de Word usando Spire.Doc
        document = Document()
        
        # Cargar desde el archivo HTML temporal
        document.LoadFromFile(temp_html_path, FileFormat.Html)
        
        # Guardar como DOCX
        document.SaveToFile(ruta_word_salida, FileFormat.Docx2016)
        
        # Cerrar el documento y liberar recursos
        document.Close()
        document.Dispose()
    finally:
        # Limpiar archivos temporales
        try:
            if os.path.exists(temp_html_path):
                os.remove(temp_html_path)
        except:
            pass
    
    return ruta_pdf_salida, ruta_word_salida

# Eliminar la primera línea si es '```html' y la última línea si es '```'
def limpiar_respuesta(respuesta):
    # Eliminar ```html al principio y ``` al final usando regex
    respuesta = re.sub(r'^```html\n', '', respuesta)  # Eliminar la primera línea (si es ```html)
    respuesta = re.sub(r'\n```$', '', respuesta)     # Eliminar la última línea (si es ```)
    return respuesta.strip()

@app.route("/", methods=["GET"])
def index():
    # Mostrar el formulario para ingresar nombre, fecha e instrucciones para el informe
    estructura = load_estructura()
    return render_template("form.html", estructura=estructura)

@app.route("/generate", methods=["POST"])
def generate_document():
    # Recoger datos de la cabecera y del formulario
    nombre = request.form.get("nombre")
    fecha = request.form.get("fecha")
    instrucciones_usuario = request.form.get("instrucciones")
    
    # Campos del bloque para "A:"
    a = request.form.get("a")               # Trabajador para A:
    oficina_a = request.form.get("oficina_a")  # Oficina seleccionada para A:

    # Campos del bloque para "ATENCIÓN:"
    atencion = request.form.get("atencion")               # Trabajador para Atención:
    subgerencia_atencion = request.form.get("subgerencia_atencion")  # Área seleccionada para Atención:

    if not (nombre and fecha and a and oficina_a and atencion and subgerencia_atencion):
        return "Faltan datos", 400

    # Extraer el mes de la fecha formateada usando regex (se asume que la fecha viene en el formato "La Joya, DD de Mes de YYYY")
    match = re.search(r'de\s+(\w+)\s+de', fecha)
    month = match.group(1).upper() if match else ""
    asunto = f"INFORME DE PRÁCTICAS DEL MES {month}"

    # Generar el cuerpo del informe usando la IA (modelo gpt-4o-mini)
    prompt = (
        f"Genera el cuerpo del informe de prácticas para un estudiante llamado {nombre} con fecha {fecha}. con html "
        f"{instrucciones_usuario if instrucciones_usuario else ''} "
        f"""Redacta un informe formal y detallado que incluya actividades realizadas y logros obtenidos durante el mes. asi como este ejemplo:     <p>Mediante la presente me dirijo a usted para hacerle llegar mis cordiales saludos y a su vez informarle sobre la realizacioacute;n de las actividades como practicante de Ingenier&iacute;a de Sistemas en el &aacute;rea de
        Inform&aacute;tica y Estad&iacute;stica correspondiente al mes de Febrero del presente a&ntilde;o.</p>
    <p>Detalle de las actividades del mes:</p>
    <ul>
        <li>Apoyo en la instalaci&oacute;n de esc&aacute;ner (Anexo 1)</li>
        <li>Apoyo en la instalaci&oacute;n de equipos (Anexo 2)</li>
        <li>Apoyo en la instalaci&oacute;n y configuraci&oacute;n de impresora Canon(Anexo 3)</li>
        <li>Apoyo en la configuraci&oacute;n de impresi&oacute;n (Anexo 4)</li>
        <li>Apoyo en la instalaci&oacute;n y configuraci&oacute;n de impresora Epson (Anexo 5)</li>
        <li>Apoyo en el mantenimiento de impresora (Anexo 6)</li>
        <li>Apoyo en la canalizaci&oacute;n para el cableado de red ethernet y telefon&iacute;a (Anexo 7)</li>
        <li>Apoyo en el mantenimiento de impresora Konica Minolta (Anexo 8)</li>
        <li>Apoyo en la implementaci&oacute;n de Banner en el sistema web de la Municipalidad (Anexo 9)</li>
        <li>Apoyo en la conexi&oacute;n en red de impresora (Anexo 10)</li>
        <li>Apoyo en pruebas de uso de Deep Seek R1 en local (Anexo 11)</li>
        <li>Apoyo en la instalaci&oacute;n y configuraci&oacute;n de switch (Anexo 12)</li>
        <li>Apoyo en la detecci&oacute;n de intento de hackeo de la p&aacute;gina web de la Municipalidad (Anexo 13)
        </li>
        <li>Apoyo en la eliminaci&oacute;n de archivos maliciosos del sistema web de la Municipalidad (Anexo 14)</li>
        <li>Apoyo en la instalaci&oacute;n y configuraci&oacute;n de impresora Brother (Anexo 15)</li>
        <li>Apoyo en el mejoramiento de la seguridad del sistema web de la Municipalidad (Anexo 16)</li>
        <li>Apoyo en el testeo de seguridad del sistema web de la Municipalidad (Anexo 17)</li>
        <li>Apoyo en la instalaci&oacute;n de la central telef&oacute;nica (Anexo 18)</li>
        <li>Apoyo en el mantenimiento de impresora Brother (Anexo 19)</li>
        <li>Apoyo en la instalaci&oacute;n de scaner de impresora Brother (Anexo 20)</li>
        <li>Apoyo en en el mantenimiento de impresora Epson (Anexo 21)</li>
        <li>Apoyo en la implementaci&oacute;n de vistas de las resoluciones del a&ntilde;o 2025 en la p&aacute;gina web
            de la Municipalidad (Anexo 22)</li>
        <li>Apoyo en el mantenimiento de computadora (Anexo 23)</li>
        <li>Apoyo en la implementaci&oacute;n de un CRUD para manejar el banner de la p&aacute;gina web de la
            Municipalidad (Anexo 24)</li>
        <li>Apoyo en la recuperaci&oacute;n de computadora con punto de restauraci&oacute;n (Anexo 25)</li>
        <li>Apoyo en la detecci&oacute;n de intento de hackeo en la p&aacute;gina web de la Municipalidad (Anexo 26)
        </li>
        <li>Apoyo en la eliminaci&oacute;n de archivos maliciosos del sistema web de la Municipalidad (Anexo 27)</li>
        <li>Apoyo en la implementaci&oacute;n de tiktok en el header en la p&aacute;gina web de la Municipalidad (Anexo
            28)</li>
        <li>Apoyo en la implementaci&oacute;n de tiktok en el footer en la p&aacute;gina web de la Municipalidad (Anexo
            29)</li>
        <li>Apoyo en la implementaci&oacute;n de un subdominio para el sistema web de la Municipalidad para el
            reforzamiento de seguridad (Anexo 30)</li>
        <li>Apoyo en la instalaci&oacute;n de impresora Canon (Anexo 31)</li>
        <li>Apoyo en la reparaci&oacute;n de inicio de computadora (Anexo 32)</li>
        <li>Apoyo en la limpieza de cola de impresi&oacute;n de equipo (Anexo 33)</li>
        <li>Apoyo en la grabaci&oacute;n de archivos en disco DVD (Anexo 34)</li>
        <li>Apoyo en la reconexi&oacute;n de impresora Brother en red (Anexo 35)</li>
        <li>Apoyo en la reconexi&oacute;n de impresora Epson en red (Anexo 36)</li>
        <li>Apoyo en la reconexi&oacute;n de internet (Anexo 37)</li>
        <li>Apoyo en la subida de documentaci&oacute;n en el SCI (Anexo 38)</li>
        <li>Apoyo en el acceso al soporte de control remoto del SCI (Anexo 39)</li>
        <li>Apoyo en el acceso al sistema del SCI (Anexo 40)</li>
        <li>Apoyo en la ejecuci&oacute;n del Sistema de Agua a trav&eacute;s de Docker en local (Anexo 41)</li>
        <li>Apoyo en la reconexi&oacute;n de computadora con impresora en red (Anexo 42)</li>
        <li>Apoyo en el restablecimiento de las credenciales en el SCI (Anexo 43)</li>
        <li>Apoyo en la instalaci&oacute;n de computador y conexi&oacute;n con impresora Brother (Anexo 44)</li>
        <li>Apoyo en el mantenimiento de impresora Konica Minolta (Anexo 45)</li>
        <li>Apoyo en la instalaci&oacute;n de drivers de impresora Konica Minolta (Anexo 46)</li>
        <li>Apoyo en el restablecimiento de credenciales de usuario de Windows a trav&eacute;s de cmd (Anexo 47)</li>
        <li>Apoyo en la subida de documentaci&oacute;n al SCI (Anexo 48)</li>
    </ul>
    <p>&nbsp;&nbsp;Es todo en cuanto comunico para sus conocimientos y fines convenientes.</p>
    <p>&nbsp;</p>
    <p>&nbsp;</p>
    al momento de responder tienes estrictamente prohibido hablar de cualquier cosa que no sea el informe de prácticas, tu respuesta es defrente eso significa que no quiero que me expliques que haras o al final que digas que ya terminaste ya que copiare tu respuesta tal cual y lo pegare en mi documento limitate solamente a responder, no generes un titulo ya que empezaré en el cuerpo defrente"""
    )
    try:
        response = client.responses.create(
            model="gpt-4o-mini",
            instructions="Genera un informe de prácticas detallado.",
            input=prompt,
        )
        cuerpo = limpiar_respuesta(response.output_text.strip())
    except Exception as e:
        return f"Error al generar el cuerpo del informe: {str(e)}", 500

    # Armar el diccionario de información para el template
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

    # Ruta al template HTML (ajusta la ruta a donde se encuentre tu archivo)
    ruta_template = r"C:/Users/ADVANCE/Documents/SGD-MUNI/plantillas/informe_practicas.html"

    try:
        ruta_pdf, ruta_word = crea_pdf_y_word(ruta_template, info)
        
        # Extraer solo los nombres de archivo de las rutas completas
        pdf_filename = os.path.basename(ruta_pdf)
        word_filename = os.path.basename(ruta_word)
        
        # Re-renderizar form.html con la vista previa y enlaces de descarga
        return render_template(
            "form.html",
            estructura=load_estructura(),
            preview_pdf=pdf_filename,
            pdf_download_url=url_for('download', tipo='pdf', filename=pdf_filename),
            word_download_url=url_for('download', tipo='word', filename=word_filename)
        )
    except Exception as e:
        return f"Error al crear PDF/Word: {str(e)}", 500

@app.route("/download/<tipo>/<filename>")
def download(tipo, filename):
    base_dir = r"C:/Users/ADVANCE/Documents/tesis/plantillas/"
    filepath = os.path.join(base_dir, filename)
    
    if not os.path.exists(filepath):
        return "Archivo no encontrado", 404
    
    # Si se solicita preview, se muestra inline
    if request.args.get('preview'):
        return send_file(filepath, as_attachment=False)
    return send_file(filepath, as_attachment=True)


if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True)
    #app.run(debug=True)
