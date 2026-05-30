# Render MCP Server Setup

## ¿Qué es?

Render MCP (Model Context Protocol) permite a OpenCode (y otras AI apps) gestionar tu infraestructura de Render directamente desde comandos naturales. Ej:

- `List my Render services`
- `Create a new Postgres database named user-db`
- `Query my database for daily signup counts`
- `What was the busiest traffic day for my service this month?`
- `Pull the most recent error-level logs for my API service`

## Requisitos

- Cuenta en [Render](https://dashboard.render.com)
- Proyecto desplegado en Render (o listo para desplegar)

## Paso 1: Crear API Key

1. Ve a [Account Settings](https://dashboard.render.com/u/settings) en Render Dashboard
2. En la sección **API Keys**, haz clic en **Create API Key**
3. Dale un nombre (ej: `opencode-mcp`)
4. Copia la API Key generada — **guárdala de forma segura**, solo se muestra una vez

## Paso 2: Configurar MCP en OpenCode

El archivo `.cursor/mcp.json` en la raíz del proyecto ya está creado con la configuración base.

Abre `E:\Sistema_de_ventas\.cursor\mcp.json` y reemplaza `<YOUR_RENDER_API_KEY>` con tu API Key de Render:

```json
{
  "mcpServers": {
    "render": {
      "url": "https://mcp.render.com/mcp",
      "headers": {
        "Authorization": "Bearer tu-api-key-aqui"
      }
    }
  }
}
```

> **⚠️ Seguridad**: No commitees este archivo con tu API Key real. El archivo actual ya está en `.gitignore` (verifica). Si no, agrega `.cursor/` al `.gitignore`.

## ⚠️ Nota: Bug conocido del MCP hosteado

El MCP server hosteado de Render (`https://mcp.render.com/mcp`) tiene un bug conocido
([issue #10](https://github.com/render-oss/render-mcp-server/issues/10))
donde las API keys funcionan con la REST API pero el MCP devuelve "unauthorized".

**Solución**: Usar el MCP server **local** en vez del hosteado.

### Instalación local (Windows)

1. Descarga el binario para Windows desde:
   https://github.com/render-oss/render-mcp-server/releases/download/v0.3.0/render-mcp-server_0.3.0_windows_amd64.zip

2. Extrae el contenido del zip en `C:\tools\render-mcp-server\`

3. El `.cursor/mcp.json` ya está configurado para apuntar al ejecutable local:

```json
{
  "mcpServers": {
    "render": {
      "command": "C:\\tools\\render-mcp-server\\render-mcp-server.exe",
      "args": [],
      "env": {
        "RENDER_API_KEY": "<YOUR_API_KEY>"
      }
    }
  }
}
```

## Paso 3: Verificar conexión

Una vez configurado, abre OpenCode y prueba con estos comandos:

1. **Seleccionar workspace**:
   ```
   Set my Render workspace to [NOMBRE_DE_TU_WORKSPACE]
   ```

2. **Listar servicios**:
   ```
   List my Render services
   ```

3. **Verificar health check**:
   ```
   What is the status of my servicio-de-ventas-backend service?
   ```

## Comandos útiles para el proyecto

### Despliegue

```
Create a web service from repo https://github.com/tu-usuario/sistema-de-ventas
```

### Base de datos

```
Create a Postgres database named sistema-ventas-db with 1 GB storage
```

### Monitoreo

```
Show me the CPU and memory metrics for sistema-de-ventas-backend in the last 24 hours
```

### Logs

```
Pull the most recent error-level logs for sistema-de-ventas-backend
```

## Acciones soportadas

| Recurso | Acciones disponibles |
|---------|---------------------|
| **Workspaces** | Listar, seleccionar, obtener detalles |
| **Servicios** | Crear (web, static, cron, Postgres, KV), listar, obtener detalles, actualizar env vars |
| **Deploys** | Listar historial, obtener detalles |
| **Logs** | Listar con filtros, listar valores de labels |
| **Métricas** | CPU, memoria, instancias, conexiones, requests, bandwidth |
| **Postgres** | Crear, listar, obtener detalles, ejecutar SQL read-only |
| **Key Value** | Crear, listar, obtener detalles |

## Limitaciones

- No soporta eliminación de recursos
- No soporta triggers de deploy
- No soporta modificar scaling settings
- Solo crea: web services, static sites, cron jobs, Postgres, Key Value

## Troubleshooting

| Problema | Solución |
|----------|----------|
| `Authorization failed` | Verifica que la API Key sea correcta y no haya expirado |
| `No workspace selected` | Ejecuta `Set my Render workspace to [name]` |
| `Tool not found` | Verifica que `.cursor/mcp.json` tenga el formato correcto |
| MCP no responde | Reinicia OpenCode después de modificar `mcp.json` |

## Referencias

- [Render MCP Server Docs](https://render.com/docs/mcp-server)
- [GitHub: render-oss/render-mcp-server](https://github.com/render-oss/render-mcp-server)
- [MCP Protocol](https://modelcontextprotocol.io/introduction)
