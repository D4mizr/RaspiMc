# RaspiMC - Panel de Servidores Minecraft para Raspberry Pi OS

**RaspiMC** es un panel de control web ultra ligero, de alto rendimiento y bajo consumo de recursos diseñado específicamente para **Raspberry Pi 3B, 4 y 5** ejecutando **Raspberry Pi OS (Linux)**.

Permite administrar servidores de Minecraft (Paper, Vanilla, Fabric, Forge), monitorear el rendimiento del hardware (CPU, RAM, almacenamiento SD y temperatura) en tiempo real, e integrar un **Punto de Acceso Wi-Fi (Hotspot)** local mediante `nmcli` / NetworkManager.

---

## 🚀 Instalación Ultra Fácil en Raspberry Pi OS (Comando Único)

Abre la terminal en tu Raspberry Pi (o conecta por SSH) y ejecuta un solo comando con `sudo`:

```bash
sudo ./install.sh
```

*(O alternativamente: `sudo ./setup.sh`)*

### ¿Qué hace el instalador automáticamente?
1. Instala Java OpenJDK 21 (o Java default-jre) para ejecutar servidores de Minecraft modernos.
2. Instala dependencias nativas del sistema (`NetworkManager`, `procps`, `git`, `curl`).
3. Instala Node.js 20 LTS en caso de no estar presente.
4. Compila la interfaz web y el servidor nativo.
5. Crea y habilita el servicio nativo de Linux `/etc/systemd/system/raspimc.service`.
6. Crea el comando CLI global `/usr/local/bin/raspimc`.
7. Inicia el servicio inmediatamente y lo configura para arrancar automáticamente al encender la Raspberry Pi.

---

## 🎮 Gestión del Servicio y Comandos Útiles

Tras la instalación, puedes gestionar el panel mediante el comando `raspimc` o `systemctl`:

```bash
# Ver estado del panel y servidores
sudo raspimc status

# Ver logs en tiempo real
sudo raspimc logs

# Reiniciar el panel
sudo raspimc restart

# Detener el panel
sudo raspimc stop

# Activar Hotspot Wi-Fi (Punto de acceso)
sudo raspimc hotspot "RaspiMC-AP" "RaspberryMinecraft"
```

O usando el estándar `systemd`:
```bash
sudo systemctl status raspimc
sudo systemctl restart raspimc
```

---

## 🌐 Acceso al Panel Web

Una vez instalado, abre el navegador web desde cualquier dispositivo (PC, móvil, tablet) conectado a la misma red Wi-Fi o red del Hotspot:

```
http://<IP-DE-TU-RASPBERRY-PI>:3000
```

*Ejemplo: `http://192.168.1.150:3000` o `http://192.168.4.1:3000` (si estás conectado al Hotspot).*

---

## 📂 Directorio de Servidores Minecraft

Por defecto en Raspberry Pi OS, los servidores creados e instalados se almacenan de forma organizada en:
```
/var/lib/raspimc/servers
```

Puedes cambiar o agregar ubicaciones adicionales (por ejemplo en un disco USB o SSD externo montado) desde el apartado **Ajustes del Sistema** en la interfaz web.

---

## ⚡ Optimizaciones para Raspberry Pi 3B
- **Consumo Mínimo de RAM y CPU**: Ejecuta una arquitectura basada en demonio Node.js nativo sin Electron ni navegadores pesados en segundo plano.
- **Cierre Seguro (Graceful Shutdown)**: Al detener o reiniciar la Pi, el servicio envía el comando `stop` a todos los servidores de Minecraft activos para guardar el mundo antes de apagar.
- **Control Térmico**: Monitorea continuamente la temperatura de la CPU (`vcgencmd measure_temp` / `/sys/class/thermal/thermal_zone0/temp`).
