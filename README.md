## Requisitos

Este proyecto requiere Python 3.11 y las siguientes dependencias:

- Flask==3.0.3
- Flask-Cors==4.0.1
- openai==1.68.0
- pdfkit==1.0.0
- python-dotenv==1.0.1
- Spire.Doc==13.1.0
- jinja2==3.0.1
- requests==2.32.3

## Instalación de dependencias

Para instalar las dependencias de Python necesarias, ejecuta el siguiente comando:

```bash
pip3.11 install -r requirements.txt

## Instalación de `wkhtmltopdf` en Windows:
   - Descarga el instalador desde [aquí](https://wkhtmltopdf.org/downloads.html), instálalo en `C:/Program Files/wkhtmltopdf/bin/` y configura la ruta en el código.
## Instalación de `wkhtmltopdf` en Linux:
   - En Linux, instala con `sudo apt-get install wkhtmltopdf` y ajusta la ruta en el código según donde se instale.
