# Unlock Document Script
# Releases the lock on a document using the owner's auth token
# .\scripts\unlock-document.ps1 -DocId "your-doc-id" -Token "your-auth-token"
param(
    [string]$DocId,
    [string]$Token,
    [string]$BaseUrl = "http://localhost:3000"
)

if (-not $DocId) {
    $DocId = Read-Host "Enter document ID"
}

if (-not $Token) {
    $Token = Read-Host "Enter owner auth token"
}

try {
    $uri = "$BaseUrl/api/documents/$DocId/lock?auth=$Token"
    $result = Invoke-RestMethod -Uri $uri -Method POST -ContentType "application/json" -Body '{"action":"release"}'
    
    if ($result.success) {
        Write-Host "Document unlocked successfully!" -ForegroundColor Green
    } else {
        Write-Host "Failed to unlock document. Lock may not exist." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
