# WinMc

Un panel de control web moderno, elegante y reactivo diseñado para el monitoreo de una Raspberry Pi y la administración simplificada de servidores de Minecraft. Esta aplicación te permite registrar redes Wi-Fi, instalar nuevos servidores de Minecraft (Paper, Spigot, Vanilla, etc.), controlar su estado de energía, visualizar estadísticas de rendimiento en tiempo real, interactuar con la consola y ajustar configuraciones de forma intuitiva.

---

## Requisitos Previos

Antes de ejecutar la aplicación de manera local o compilarla para Windows, asegúrate de contar con los siguientes componentes en tu sistema:

- **Node.js**: Versión `18.x` o superior (se recomienda Node.js 20 LTS o superior).
- **Gestor de paquetes**: `npm` (incluido con Node.js) o `bun`.
- **Entorno Java (JRE / JDK)**: Java 17 o Java 21 instalado en el sistema y añadido a la variable de entorno `PATH` de Windows (necesario para ejecutar los servdores de Minecraft `.jar`).
- **Build Tools / Herramientas de Compilación**:
  - `electron` (v34+)
  - `electron-builder` (v25+)
  - `esbuild` y `vite` (configurados en `package.json`)

---

## Instrucciones de Instalación y Ejecución Local

Sigue estos sencillos pasos para poner en marcha el proyecto en tu máquina local:

### 1. Clonar o descargar el proyecto
Si descargaste el archivo ZIP, extráelo en una carpeta. Si usas Git, clona el repositorio:
```bash
git clone https://github.com/D4mizr/WinMc.git
cd raspberry-pi-minecraft-dashboard
cd WinMc
```

### 2. Instalar las dependencias
El proyecto incluye todas las librerías necesarias especificadas en el `package.json` (incluyendo React 19, Vite, Tailwind CSS v4, Electron y Electron Builder).

Instala las dependencias utilizando npm o Bun:

```bash
npm install
```

### 3. Iniciar el servidor de desarrollo
Inicia el entorno de desarrollo interactivo:

```bash
npm run dev
```

El servidor web estará disponible en:
**[http://localhost:3000](http://localhost:3000)**