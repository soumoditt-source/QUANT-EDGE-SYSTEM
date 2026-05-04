# QuantEdge Launch Script
# ========================
# This script launches both the backend and frontend for local development.

# ─── Configuration ────────────────────────────────────────────────────────────
$BACKEND_PORT = 8000
$FRONTEND_PORT = 5173

Write-Host "🚀 Initializing QuantEdge Intelligence Platform..." -ForegroundColor Cyan

# ─── Environment Check ────────────────────────────────────────────────────────
if (-not (Test-Path "backend/.env")) {
    Write-Host "⚠️  Warning: backend/.env not found." -ForegroundColor Yellow
    Write-Host "Creating template .env file..."
    "MISTRAL_API_KEY=your_api_key_here" | Out-File "backend/.env"
}

# ─── Backend Startup ──────────────────────────────────────────────────────────
Write-Host "Starting Backend on port $BACKEND_PORT..." -ForegroundColor Green
$BackendProcess = Start-Process py -ArgumentList "-3.11 -m uvicorn app.api.main:app --host 0.0.0.0 --port $BACKEND_PORT" -WorkingDirectory "backend" -PassThru -NoNewWindow

# ─── Frontend Startup ─────────────────────────────────────────────────────────
Write-Host "Starting Frontend on port $FRONTEND_PORT..." -ForegroundColor Green
$FrontendProcess = Start-Process npm.cmd -ArgumentList "run dev" -WorkingDirectory "frontend" -PassThru -NoNewWindow

Write-Host "`n✅ QuantEdge is now running!" -ForegroundColor Green
Write-Host "👉 Frontend: http://localhost:$FRONTEND_PORT" -ForegroundColor White
Write-Host "👉 Backend API: http://localhost:$BACKEND_PORT" -ForegroundColor White
Write-Host "👉 WebSocket: ws://localhost:$BACKEND_PORT/ws" -ForegroundColor White

Write-Host "`nPress Ctrl+C to terminate both processes." -ForegroundColor Gray

# ─── Keep script alive and handle termination ─────────────────────────────────
try {
    while ($true) {
        if ($BackendProcess.HasExited) {
            Write-Host "❌ Backend process crashed!" -ForegroundColor Red
            break
        }
        if ($FrontendProcess.HasExited) {
            Write-Host "❌ Frontend process crashed!" -ForegroundColor Red
            break
        }
        Start-Sleep -Seconds 2
    }
}
finally {
    Write-Host "`n🛑 Shutting down QuantEdge..." -ForegroundColor Yellow
    Stop-Process -Id $BackendProcess.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $FrontendProcess.Id -ErrorAction SilentlyContinue
    Write-Host "Done." -ForegroundColor Green
}
