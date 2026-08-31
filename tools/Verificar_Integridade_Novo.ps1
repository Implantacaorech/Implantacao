# Verificacao diaria de integridade do Painel NOVO (Angular + NestJS) - equivalente ao
# Verificar_Integridade.bat / webapp/robo_integridade.py do Flask antigo, adaptado ao
# stack novo: (1) site no ar, (2) backup recente, (3) suite de testes do backend.
# Resultado em C:\PainelBackups\integridade_novo.log. Agendar via Tarefa do Windows
# (diaria, mesmo horario 07:30 sugerido para o guardiao antigo).
$ErrorActionPreference = "Continue"
# F1 da migracao p/ servidor dedicado: pasta e porta vem do ambiente quando definidas.
$dest = if ($env:MIGRACAO_BACKUP_DIR) { $env:MIGRACAO_BACKUP_DIR } else { "C:\PainelBackups" }
$logFile = Join-Path $dest "integridade_novo.log"
$porta = if ($env:MIGRACAO_PORT) { $env:MIGRACAO_PORT } else { 5100 }
$falhas = @()

# UTF-8 sem BOM pelo .NET: `Out-File -Append` na PowerShell 5.1 grava UTF-16 quando nao se
# passa -Encoding, e carimba BOM no meio do arquivo quando se passa. Foi o que deixou o log
# do backup ilegivel justamente nas linhas de ERRO - ver Painel_Novo_Backup_MariaDB.ps1.
$script:Utf8SemBom = New-Object System.Text.UTF8Encoding($false)
function Log($msg) {
  $linha = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg`r`n"
  [System.IO.File]::AppendAllText($logFile, $linha, $script:Utf8SemBom)
}

Log "=== Verificacao de integridade iniciada ==="

# 1) Site no ar --------------------------------------------------------------------
try {
  $resp = Invoke-WebRequest -Uri "http://localhost:$porta/api/health" -UseBasicParsing -TimeoutSec 10
  if ($resp.StatusCode -eq 200) {
    Log "OK -> site no ar (/api/health)"
  } else {
    $falhas += "site respondeu HTTP $($resp.StatusCode)"
  }
} catch {
  $falhas += "site fora do ar ($($_.Exception.Message))"
}

# 2) Backup recente (menos de 26h, folga sobre o backup diario as 22:00) -----------
$ultimoBackup = Get-ChildItem $dest -Filter "painel_novo_*.zip" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $ultimoBackup) {
  $falhas += "nenhum backup encontrado em $dest"
} elseif ($ultimoBackup.LastWriteTime -lt (Get-Date).AddHours(-26)) {
  $falhas += "ultimo backup e velho ($($ultimoBackup.Name), $($ultimoBackup.LastWriteTime))"
} else {
  Log "OK -> backup recente ($($ultimoBackup.Name))"
}

# 3) Suite de testes do backend (jest) ----------------------------------------------
Push-Location "$PSScriptRoot\..\backend"
try {
  # M7 (auditoria 2026-08-12): `Out-File -Append` sem -Encoding gravava a saida do npm em
  # UTF-16, enquanto o Log() grava UTF-8 sem BOM - o arquivo virava uma mistura e toda linha
  # FALHA futura sairia ilegivel (mesmo defeito que escondeu as falhas de backup). Capturamos
  # a saida e a anexamos pelo MESMO caminho UTF-8 sem BOM.
  $saidaTeste = (npm test 2>&1 | Out-String)
  $exitTeste = $LASTEXITCODE
  [System.IO.File]::AppendAllText($logFile, $saidaTeste, $script:Utf8SemBom)
  if ($exitTeste -eq 0) {
    Log "OK -> suite de testes do backend passou"
  } else {
    $falhas += "suite de testes do backend falhou (ver log acima)"
  }
} finally {
  Pop-Location
}

# --- Resultado final ----------------------------------------------------------------
if ($falhas.Count -eq 0) {
  Log "=== Tudo OK ==="
  exit 0
} else {
  foreach ($f in $falhas) { Log "FALHA -> $f" }
  Log "=== Verificacao encontrou $($falhas.Count) problema(s) ==="
  # TODO: notificar por e-mail quando Config -> E-mail estiver configurado no stack novo
  # (mesmo padrao do INTEGRIDADE_PARA do robo_integridade.py do Flask).
  exit 1
}
