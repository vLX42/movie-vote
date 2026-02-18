#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
#  Movie Night Voting App — Unraid Setup Script
#  Run this once to set everything up, or again to update.
# ─────────────────────────────────────────────────────────────

APPDATA_DIR="/mnt/appdata/movienightapp"
NETWORK_NAME="movienightnet"

# ── Colours ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# ── Helpers ───────────────────────────────────────────────────
info()    { echo -e "${CYAN}→${RESET} $*"; }
success() { echo -e "${GREEN}✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}!${RESET} $*"; }
error()   { echo -e "${RED}✗${RESET} $*" >&2; }
header()  { echo -e "\n${BOLD}$*${RESET}"; }
divider() { echo -e "${DIM}────────────────────────────────────────────${RESET}"; }

ask() {
  # ask <var_name> <prompt> [default]
  local var="$1" prompt="$2" default="${3:-}"
  local display_default=""
  if [[ -n "$default" ]]; then
    display_default=" ${DIM}[${default}]${RESET}"
  fi
  echo -ne "${BOLD}${prompt}${RESET}${display_default}: "
  read -r value
  if [[ -z "$value" && -n "$default" ]]; then
    value="$default"
  fi
  printf -v "$var" '%s' "$value"
}

ask_secret() {
  # ask_secret <var_name> <prompt>
  local var="$1" prompt="$2"
  echo -ne "${BOLD}${prompt}${RESET} ${DIM}(input hidden)${RESET}: "
  read -rs value
  echo
  printf -v "$var" '%s' "$value"
}

ask_yn() {
  # ask_yn <prompt> — returns 0 for yes, 1 for no
  echo -ne "${BOLD}$1${RESET} ${DIM}[y/N]${RESET}: "
  read -r yn
  [[ "$yn" =~ ^[Yy]$ ]]
}

gen_secret() {
  # Generate a random 40-char hex string
  if command -v openssl &>/dev/null; then
    openssl rand -hex 20
  else
    tr -dc 'a-f0-9' </dev/urandom | head -c 40
  fi
}

docker_compose() {
  # Prefer standalone docker-compose, fall back to docker compose plugin
  if command -v docker-compose &>/dev/null; then
    docker-compose "$@"
  else
    docker compose "$@"
  fi
}

# ─────────────────────────────────────────────────────────────
#  Banner
# ─────────────────────────────────────────────────────────────
clear
echo -e "${BOLD}"
cat <<'BANNER'
  __  __            _         _   _ _       _     _
 |  \/  | _____   _(_) ___   | \ | (_) __ _| |__ | |_
 | |\/| |/ _ \ \ / / |/ _ \  |  \| | |/ _` | '_ \| __|
 | |  | | (_) \ V /| |  __/  | |\  | | (_| | | | | |_
 |_|  |_|\___/ \_/ |_|\___|  |_| \_|_|\__, |_| |_|\__|
                                        |___/
BANNER
echo -e "${RESET}"
echo -e "  ${DIM}Unraid setup script — Movie Night Voting App${RESET}"
divider

# ─────────────────────────────────────────────────────────────
#  Check prerequisites
# ─────────────────────────────────────────────────────────────
header "Checking prerequisites"

if ! command -v docker &>/dev/null; then
  error "Docker is not installed or not in PATH."
  exit 1
fi
success "Docker found ($(docker --version | head -c 40))"

if ! (command -v docker-compose &>/dev/null || docker compose version &>/dev/null 2>&1); then
  error "Neither docker-compose nor the Docker Compose plugin is available."
  exit 1
fi
success "Docker Compose found"

if ! command -v git &>/dev/null; then
  error "git is not installed."
  exit 1
fi
success "git found"

# ─────────────────────────────────────────────────────────────
#  Detect existing installation
# ─────────────────────────────────────────────────────────────
IS_UPDATE=false
if [[ -d "$APPDATA_DIR/.git" ]]; then
  echo
  warn "Existing installation detected at ${APPDATA_DIR}"
  if ask_yn "Pull latest code and redeploy? (existing .env will be kept)"; then
    IS_UPDATE=true
  else
    echo "Aborting."
    exit 0
  fi
fi

# ─────────────────────────────────────────────────────────────
#  Directory setup
# ─────────────────────────────────────────────────────────────
header "Setting up directories"

if [[ "$IS_UPDATE" == false ]]; then
  if [[ -d "$APPDATA_DIR" && "$(ls -A "$APPDATA_DIR" 2>/dev/null)" ]]; then
    warn "${APPDATA_DIR} already exists and is not empty."
    if ! ask_yn "Continue and write into it?"; then
      exit 0
    fi
  fi
fi

mkdir -p "${APPDATA_DIR}/db"
success "Directory ready: ${APPDATA_DIR}"

# ─────────────────────────────────────────────────────────────
#  Clone or update code
# ─────────────────────────────────────────────────────────────
header "Fetching application code"

REPO_URL="https://github.com/vlx42/movie-vote.git"

if [[ "$IS_UPDATE" == true ]]; then
  info "Pulling latest code..."
  git -C "$APPDATA_DIR" pull
  success "Code updated"
else
  if [[ ! -f "${APPDATA_DIR}/docker-compose.yml" ]]; then
    # Try to copy from current script location first
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [[ -f "${SCRIPT_DIR}/docker-compose.yml" ]]; then
      info "Copying from local source: ${SCRIPT_DIR}"
      cp -r "${SCRIPT_DIR}/." "${APPDATA_DIR}/"
      success "Files copied"
    else
      info "Cloning repository..."
      ask REPO_URL "GitHub repo URL" "$REPO_URL"
      git clone "$REPO_URL" "$APPDATA_DIR"
      success "Repository cloned"
    fi
  else
    success "Source files already present"
  fi
fi

# ─────────────────────────────────────────────────────────────
#  Environment configuration
# ─────────────────────────────────────────────────────────────
ENV_FILE="${APPDATA_DIR}/.env"

if [[ "$IS_UPDATE" == true && -f "$ENV_FILE" ]]; then
  success "Keeping existing .env file (skipping config prompts)"
else
  header "Configuration"
  echo -e "  ${DIM}You'll need your Jellyfin and Jellyseerr API keys.${RESET}"
  echo -e "  ${DIM}Jellyfin key:    Dashboard → API Keys → + New${RESET}"
  echo -e "  ${DIM}Jellyseerr key:  Settings → General → API Key${RESET}"
  divider
  echo

  # Jellyfin
  ask       JELLYFIN_URL     "Jellyfin URL (internal Docker name or IP)" "http://jellyfin:8096"
  ask_secret JELLYFIN_API_KEY "Jellyfin API key"
  while [[ -z "$JELLYFIN_API_KEY" ]]; do
    error "Jellyfin API key cannot be empty."
    ask_secret JELLYFIN_API_KEY "Jellyfin API key"
  done

  echo
  # Jellyseerr
  if ask_yn "Do you use Jellyseerr?"; then
    ask       JELLYSEERR_URL     "Jellyseerr URL" "http://jellyseerr:5055"
    ask_secret JELLYSEERR_API_KEY "Jellyseerr API key"
  else
    JELLYSEERR_URL=""
    JELLYSEERR_API_KEY=""
    warn "Jellyseerr skipped — movie requests will be disabled"
  fi

  echo
  # Secrets
  echo -e "  ${DIM}Generating secure random secrets for ADMIN_SECRET and COOKIE_SECRET...${RESET}"
  DEFAULT_ADMIN_SECRET="$(gen_secret)"
  DEFAULT_COOKIE_SECRET="$(gen_secret)"

  if ask_yn "Use auto-generated secrets? (recommended)"; then
    ADMIN_SECRET="$DEFAULT_ADMIN_SECRET"
    COOKIE_SECRET="$DEFAULT_COOKIE_SECRET"
  else
    ask_secret ADMIN_SECRET  "Admin secret (you'll use this to log into /admin)"
    ask_secret COOKIE_SECRET "Cookie signing secret"
    while [[ -z "$ADMIN_SECRET" || -z "$COOKIE_SECRET" ]]; do
      error "Both secrets are required."
      ask_secret ADMIN_SECRET  "Admin secret"
      ask_secret COOKIE_SECRET "Cookie signing secret"
    done
  fi

  # Write .env
  cat > "$ENV_FILE" <<EOF
# Jellyfin
JELLYFIN_URL=${JELLYFIN_URL}
JELLYFIN_API_KEY=${JELLYFIN_API_KEY}

# Jellyseerr
JELLYSEERR_URL=${JELLYSEERR_URL}
JELLYSEERR_API_KEY=${JELLYSEERR_API_KEY}

# App secrets — keep these private
ADMIN_SECRET=${ADMIN_SECRET}
COOKIE_SECRET=${COOKIE_SECRET}
EOF

  chmod 600 "$ENV_FILE"
  success ".env written to ${ENV_FILE}"

  # Save admin secret for display at the end
  SAVED_ADMIN_SECRET="$ADMIN_SECRET"
fi

# Read admin secret from .env for final display (update path)
if [[ -z "${SAVED_ADMIN_SECRET:-}" ]]; then
  SAVED_ADMIN_SECRET="$(grep '^ADMIN_SECRET=' "$ENV_FILE" | cut -d= -f2-)"
fi

# ─────────────────────────────────────────────────────────────
#  Docker network
# ─────────────────────────────────────────────────────────────
header "Docker network"

if docker network inspect "$NETWORK_NAME" &>/dev/null; then
  success "Network '${NETWORK_NAME}' already exists"
else
  info "Creating Docker network '${NETWORK_NAME}'..."
  docker network create "$NETWORK_NAME"
  success "Network created"
  echo
  warn "Jellyfin and Jellyseerr need to be on this network."
  echo -e "  ${DIM}Run these commands to connect them:${RESET}"
  echo -e "  ${CYAN}docker network connect ${NETWORK_NAME} jellyfin${RESET}"
  echo -e "  ${CYAN}docker network connect ${NETWORK_NAME} jellyseerr${RESET}"
  echo
  if ! ask_yn "Have you connected them (or will do so now)?"; then
    warn "Continuing anyway — the app will start but backend won't reach Jellyfin until you connect it."
  fi
fi

# ─────────────────────────────────────────────────────────────
#  Build and start
# ─────────────────────────────────────────────────────────────
header "Building and starting containers"
echo -e "  ${DIM}First build takes 3-5 minutes (compiling SQLite, bundling React).${RESET}"
echo

cd "$APPDATA_DIR"

# Pull any updated base images
info "Pulling base images..."
docker_compose pull --ignore-pull-failures 2>/dev/null || true

info "Building images..."
docker_compose build

info "Starting containers..."
docker_compose up -d

# ─────────────────────────────────────────────────────────────
#  Health check
# ─────────────────────────────────────────────────────────────
header "Waiting for backend to be ready"

MAX_WAIT=60
WAITED=0
printf "  "
while [[ $WAITED -lt $MAX_WAIT ]]; do
  if curl -sf http://localhost:3001/api/health &>/dev/null; then
    echo
    success "Backend is up"
    break
  fi
  printf "."
  sleep 2
  WAITED=$((WAITED + 2))
done

if [[ $WAITED -ge $MAX_WAIT ]]; then
  echo
  warn "Backend didn't respond in ${MAX_WAIT}s — it may still be starting."
  warn "Check logs with: docker-compose -f ${APPDATA_DIR}/docker-compose.yml logs backend"
fi

# ─────────────────────────────────────────────────────────────
#  Get host IP for display
# ─────────────────────────────────────────────────────────────
HOST_IP="$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}' || echo "YOUR_UNRAID_IP")"

# ─────────────────────────────────────────────────────────────
#  Done
# ─────────────────────────────────────────────────────────────
echo
divider
echo -e "${GREEN}${BOLD}  All done!${RESET}"
divider
echo
echo -e "  ${BOLD}App URL:${RESET}       http://${HOST_IP}:8090"
echo -e "  ${BOLD}Admin panel:${RESET}   http://${HOST_IP}:8090/admin"
echo -e "  ${BOLD}Admin secret:${RESET}  ${CYAN}${SAVED_ADMIN_SECRET}${RESET}"
echo
echo -e "  ${DIM}Next steps:${RESET}"
echo -e "  ${DIM}1. Open the admin panel and create your first session${RESET}"
echo -e "  ${DIM}2. Copy the invite link and share it with your guests${RESET}"
echo -e "  ${DIM}3. Guests open the link and start voting${RESET}"
echo
echo -e "  ${DIM}To view logs:${RESET}"
echo -e "  ${CYAN}docker-compose -f ${APPDATA_DIR}/docker-compose.yml logs -f${RESET}"
echo
echo -e "  ${DIM}To stop:${RESET}"
echo -e "  ${CYAN}docker-compose -f ${APPDATA_DIR}/docker-compose.yml down${RESET}"
echo
divider
