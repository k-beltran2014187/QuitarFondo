# QuitarFondo

Sitio web estático para quitar el fondo de imágenes y descargarlas en PNG transparente.
El procesamiento se hace en el navegador con [@imgly/background-removal](https://github.com/imgly/background-removal-js).

## Probar en local
    python3 -m http.server 8000   # y abrir http://localhost:8000

## Google AdSense
1. En `index.html` descomenta el script de AdSense y pon tu `ca-pub-XXXXXXXXXXXXXXXX`.
2. Reemplaza los bloques `.ad` por tus `<ins class="adsbygoogle">`.
3. Crea `ads.txt` en la raíz con tu línea de editor.
4. AdSense exige páginas de Privacidad, Términos y Contacto (pendientes).
