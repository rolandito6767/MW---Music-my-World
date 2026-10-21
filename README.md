# MW — Music my World · v0.5.0

**Tu música. A tu manera.** Reproductor de música personal hecho con HTML5, CSS3, JavaScript, Web Audio API, IndexedDB y Vite. **No requiere Spotify, cuenta musical, APIs de pago ni servidor de audio.**

## Instalación en Windows desde Sublime Text

1. Haz una copia de seguridad de tu carpeta actual de MW.
2. Descomprime el ZIP de la Fase 5. Copia **el contenido** de la carpeta `MW-Music-my-World` dentro de la carpeta de tu proyecto actual. Confirma «Reemplazar archivos». Conserva `node_modules` y `package-lock.json` existentes; no copies archivos de audio al proyecto.
3. Abre la carpeta actual de MW desde Sublime Text (`File > Open Folder`).
4. En el Explorador, entra en esa misma carpeta, escribe `cmd` en la barra de direcciones y pulsa Enter.
5. Ejecuta `npm install` (seguro si ya instalaste las dependencias) y `npm run dev`.
6. Abre la dirección que indica Vite, normalmente `http://127.0.0.1:5173/`.

**Actualizaciones de datos:** las playlists y las copias en IndexedDB sobreviven a una actualización de código mientras se siga usando el mismo navegador y el **mismo origen** (protocolo + dominio + puerto). No borres los datos del sitio. `localhost:5173`, `127.0.0.1:5173` y el dominio Netlify no comparten el almacenamiento local.

## Funciones

- Bienvenida animada y logo propio SVG; favicon y manifiesto web.
- Tres accesos en portada: «Usar ya», «¿Cómo usar?» y «Términos de uso y condiciones».
- MP3 y WAV (compatibilidad dependiente del navegador), metadatos y carátulas cuando las etiquetas lo permiten.
- Álbumes, artistas, búsqueda, playlists, aleatorio, repetición, volumen, progreso, ecualizador y visualizador.
- Copias locales opcionales en IndexedDB. Sin sincronización ni subida de música.
- Interfaz móvil con barra de seis destinos y controles de audio accesibles.
- **Media Session API**: información de la canción y controles del sistema compatibles (pausa, siguiente, anterior, buscar). Algunos teléfonos pueden mostrar controles en pantalla bloqueada; **no está garantizado** que el audio siga sonando con la pantalla apagada o si el sistema suspende el navegador.
- Al entrar a MW en otro dispositivo, importa tu música allí. Las canciones no se comparten entre dispositivos ni a través de Netlify.

## Pruebas

```bash
npm test
npm run build
npm run preview
```

Para probar manualmente en Windows: abre la portada, prueba los tres botones y sus cierres, importa dos MP3, reproduce/pausa/cambia, crea una playlist, comprueba EQ, guarda copias locales y recarga el navegador. Confirma que se recuperen canciones. Haz una prueba en modo móvil de las seis pestañas inferiores y otra en un teléfono real con pantalla bloqueada.

## Subir código a GitHub, publicar con Netlify

**No subas MP3, WAV ni tu colección personal a GitHub.** `.gitignore` excluye formatos musicales habituales. Si utilizas GitHub Desktop, añade la carpeta del proyecto como repositorio local, crea un commit y publícalo (puedes usar repositorio privado). Al subir, revisa la lista de archivos para asegurarte de que no hay audio personal, contraseñas ni archivos de `node_modules`. No uses carpetas `dist` como repositorio: Vite las regenera.

En Netlify, si tu cuenta tiene acceso a la función, conecta el repositorio GitHub como nuevo sitio. Esta versión trae `netlify.toml`, por lo que Netlify puede configurar automáticamente:

| Opción | Valor |
|---|---|
| Comando de compilación | `npm run build` |
| Carpeta de publicación | `dist` |
| Node.js | `24` |

No tienes que añadir APIs ni claves. Si prefieres publicar manualmente sin conectar GitHub, ejecuta `npm run build` y sube la carpeta `dist` a una plataforma compatible con sitios estáticos (por ejemplo, Netlify). Comprueba que el HTML y recursos cargan correctamente a través de HTTPS.

**Importante:** el sitio público distribuye **el código del reproductor**, no tus canciones. Las copias IndexedDB quedan en cada navegador de cada persona. Que el código de MW sea público no concede licencias de la música importada.

### Limitaciones conocidas

- La compatibilidad con MP3/WAV, Media Session y Web Audio depende del navegador y de sus permisos.
- Android puede funcionar mejor en Chrome cuando la reproducción ya se inició mediante un gesto de usuario; iOS Safari puede suspender pestañas en segundo plano. No hay garantía universal ni forma web de forzar reproducción continua.
- La reproducción se detiene al cerrar la pestaña o el navegador; algunos sistemas también detienen audio al suspender la página.
- Los archivos guardados pueden perderse cuando se eliminan datos del sitio, se usa navegación privada o el navegador necesita liberar espacio. Conserva los originales.
- Algunas portadas blob podrían no mostrarse en la pantalla de bloqueo, aunque el título se muestre.

### Seguridad y derechos

MW no contiene música incluida ni convierte canciones protegidas en material libre. Reproduce únicamente obras obtenidas legalmente. Para distribuir, transmitir, usar comercialmente o monetizar grabaciones de terceros se requieren los derechos o las licencias apropiadas. La guía en la propia web es informativa y no sustituye asesoramiento jurídico.
