#!/usr/bin/env bash
# ==============================================================================
# RaspiMC - Instalador Automático para Raspberry Pi OS / Linux
# ==============================================================================

set -e

# Colores para consola
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}${BOLD}"
echo "  ____                  _ __  __  ____ "
echo " |  _ \  __ _ ___ _ __ (_)  \/  |/ ___|"
echo " | |_) |/ _\` / __| '_ \| | |\/| | |    "
echo " |  _ <| (_| \__ \ |_) | | |  | | |___ "
echo " |_| \_\\\\__,_|___/ .__/|_|_|  |_|\____|"
echo "                |_|                    "
echo -e "${NC}"
echo -e "${BOLD}Instalador Ligero de RaspiMC para Raspberry Pi OS / Linux${NC}\n"

# 1. Verificar permisos de superusuario (root)
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[ERROR] Este instalador debe ejecutarse con privilegios de root (sudo).${NC}"
  echo -e "Por favor ejecuta: ${YELLOW}sudo ./install.sh${NC}\n"
  exit 1
fi

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
INSTALL_DIR="/opt/raspimc"

echo -e "${CYAN}[1/6] Actualizando repositorio de paquetes del sistema...${NC}"
apt-get update -qq

echo -e "${CYAN}[2/6] Instalando dependencias nativas del sistema (Java OpenJDK, NetworkManager, Git, Curl)...${NC}"
apt-get install -y -qq \
  curl \
  git \
  ca-certificates \
  build-essential \
  procps \
  network-manager \
  openjdk-21-jre-headless || apt-get install -y -qq default-jre-headless

# 3. Verificar o instalar Node.js 20+
if ! command -v node &> /dev/null || [ $(node -v | cut -d'.' -f1 | tr -d 'v') -lt 18 ]; then
  echo -e "${CYAN}[3/6] Instalando Node.js v20 LTS...${NC}"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
else
  echo -e "${GREEN}[OK] Node.js detectado: $(node -v)${NC}"
fi

# 4. Copiar/Preparar directorio de la aplicación
echo -e "${CYAN}[4/6] Configurando directorio de aplicación en ${INSTALL_DIR}...${NC}"
mkdir -p "${INSTALL_DIR}"
mkdir -p /var/lib/raspimc/servers
mkdir -p /var/lib/raspimc/backups
chmod -R 777 /var/lib/raspimc

if [ "$SCRIPT_DIR" != "$INSTALL_DIR" ]; then
  echo "Copiando archivos del proyecto a ${INSTALL_DIR}..."
  cp -rf "$SCRIPT_DIR"/* "$INSTALL_DIR"/ 2>/dev/null || true
  cp -rf "$SCRIPT_DIR"/.* "$INSTALL_DIR"/ 2>/dev/null || true
fi

cd "$INSTALL_DIR"

# 5. Instalar dependencias npm y compilar aplicación
echo -e "${CYAN}[5/6] Instalando módulos npm y compilando aplicación...${NC}"
npm install --no-audit --no-fund
npm run build

# Find node binary path
NODE_PATH="$(which node || echo '/usr/bin/node')"

# 6. Crear servicio systemd
echo -e "${CYAN}[6/6] Creando servicio del sistema systemd (raspimc.service)...${NC}"
cat << EOF > /etc/systemd/system/raspimc.service
[Unit]
Description=RaspiMC - Panel de Servidores Minecraft para Raspberry Pi 3B
After=network-online.target NetworkManager.service
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=${NODE_PATH} ${INSTALL_DIR}/dist/server.cjs
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

# Crear comando CLI rapido /usr/local/bin/raspimc
cat << 'EOF' > /usr/local/bin/raspimc
#!/usr/bin/env bash
case "$1" in
  start)
    sudo systemctl start raspimc
    echo "Servicio RaspiMC iniciado."
    ;;
  stop)
    sudo systemctl stop raspimc
    echo "Servicio RaspiMC detenido."
    ;;
  restart)
    sudo systemctl restart raspimc
    echo "Servicio RaspiMC reiniciado."
    ;;
  status)
    sudo systemctl status raspimc
    ;;
  logs)
    sudo journalctl -u raspimc -f -n 50
    ;;
  hotspot)
    sudo nmcli device wifi hotspot ifname wlan0 ssid "${2:-RaspiMC-AP}" password "${3:-RaspberryMinecraft}"
    ;;
  *)
    echo "Uso: sudo raspimc {start|stop|restart|status|logs|hotspot}"
    ;;
esac
EOF
chmod +x /usr/local/bin/raspimc

# Recargar y activar servicio systemd
systemctl daemon-reload
systemctl enable raspimc
systemctl restart raspimc

# Obtener dirección IP local
LOCAL_IP="$(hostname -I | awk '{print $1}' || echo 'localhost')"

echo -e "\n${GREEN}${BOLD}=========================================================================${NC}"
echo -e "${GREEN}${BOLD}   ¡Instalación de RaspiMC completada con éxito en Raspberry Pi OS!    ${NC}"
echo -e "${GREEN}${BOLD}=========================================================================${NC}\n"
echo -e "Puedes acceder al panel web desde cualquier navegador en tu red local:"
echo -e "  👉 ${CYAN}${BOLD}http://${LOCAL_IP}:3000${NC}\n"
echo -e "Comandos de gestión rápida disponibles:"
echo -e "  • Estado del servicio: ${YELLOW}sudo raspimc status${NC}  o  ${YELLOW}sudo systemctl status raspimc${NC}"
echo -e "  • Reiniciar servicio:  ${YELLOW}sudo raspimc restart${NC}"
echo -e "  • Ver logs en tiempo real: ${YELLOW}sudo raspimc logs${NC}"
echo -e "  • Activar Hotspot Wi-Fi:   ${YELLOW}sudo raspimc hotspot${NC}\n"
echo -e "Ubicación de servidores Minecraft: ${CYAN}/var/lib/raspimc/servers${NC}\n"
