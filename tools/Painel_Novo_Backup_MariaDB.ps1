# Backup do MariaDB do Painel NOVO: dump comprimido em C:\PainelBackups.
# Banco de producao do painel novo desde a troca de Postgres->MariaDB em 2026-07-17 (ver
# docs/migracao/03-documento-conversao.md §21/§22) - PowerShell + Tarefa Agendada do
# Windows, retencao de 14 dias, log em C:\PainelBackups.
#
# IMPORTANTE (2026-07-29): o MariaDB NAO roda mais em Docker (container `painel-db-mariadb`)
# - e um servico NATIVO do Windows (MariaDB 12.2, porta 3306), migrado em 27/07. A versao
# anterior deste script chamava `docker exec painel-db-mariadb mysqldump`; a partir dessa
# migracao o comando passou a falhar, o `Out-File` gravava um arquivo VAZIO e o script ainda
# logava "ok". Resultado: os backups de 27, 28 e 29/07 sairam com 176 bytes (zip com .sql de
# 0 byte) sem ninguem perceber - o ultimo dump bom e o de 23/07 (~1 MB). Por isso agora o
# script (1) chama o cliente local `mariadb-dump`, (2) usa --result-file (nao passa pelo pipe
# do PowerShell, que na 5.1 grava BOM) e (3) VALIDA o dump antes de compactar, falhando alto.
#
# Conexao: lida da MIGRACAO_DB_URL (a mesma do painel - fonte unica, sem senha duplicada).
#   Alternativa: PAINEL_NOVO_MARIADB_HOST/PORTA/USUARIO/BANCO + PAINEL_NOVO_MARIADB_SENHA.
#   Cliente: achado no PATH ou em "C:\Program Files\MariaDB *\bin"; para fixar, defina
#   PAINEL_NOVO_MARIADB_DUMP com o caminho do mariadb-dump.exe.
#
# RESTAURAR um backup:
#   Expand-Archive C:\PainelBackups\painel_novo_mariadb_AAAAMMDD_HHMMSS.zip -DestinationPath .
#   & "C:\Program Files\MariaDB 12.2\bin\mariadb.exe" -u painel -p painel_novo < painel_novo_mariadb_AAAAMMDD_HHMMSS.sql

$ErrorActionPreference = "Stop"
$dest = "C:\PainelBackups"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$logFile = Join-Path $dest "backup_novo_mariadb.log"

function Log($msg) {
  "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg" | Out-File -Append -FilePath $logFile -Encoding utf8
}

function Falhar($msg) {
  Log "ERRO -> $msg"
  exit 1
}

# --- 1. Cliente de dump -------------------------------------------------------------
function Achar-Dump {
  if ($env:PAINEL_NOVO_MARIADB_DUMP) { return $env:PAINEL_NOVO_MARIADB_DUMP }
  $noPath = Get-Command "mariadb-dump.exe" -ErrorAction SilentlyContinue
  if ($noPath) { return $noPath.Source }
  # Mais novo primeiro, para acompanhar upgrades do MariaDB sem editar o script.
  $cand = Get-ChildItem "C:\Program Files\MariaDB *\bin\mariadb-dump.exe" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1
  if ($cand) { return $cand.FullName }
  return $null
}

$dump = Achar-Dump
if (-not $dump) {
  Falhar "cliente mariadb-dump.exe nao encontrado (PATH nem 'C:\Program Files\MariaDB *\bin'). Defina PAINEL_NOVO_MARIADB_DUMP."
}

# --- 2. Dados de conexao ------------------------------------------------------------
$dbHost = $null; $porta = 3306; $usuario = $null; $banco = $null; $senha = $null

if ($env:MIGRACAO_DB_URL) {
  try {
    $u = [uri]$env:MIGRACAO_DB_URL
    $dbHost = $u.Host
    if ($u.Port -gt 0) { $porta = $u.Port }
    $banco = $u.AbsolutePath.TrimStart('/')
    $partes = $u.UserInfo -split ':', 2
    $usuario = [uri]::UnescapeDataString($partes[0])
    if ($partes.Count -eq 2) { $senha = [uri]::UnescapeDataString($partes[1]) }
  } catch {
    Falhar "MIGRACAO_DB_URL invalida: $($_.Exception.Message)"
  }
}

# Os PAINEL_NOVO_MARIADB_* so PREENCHEM o que a MIGRACAO_DB_URL nao trouxe - nao sobrescrevem.
#
# Era o contrario ate 02/08/2026, e foi o que quebrou o backup: havia um
# PAINEL_NOVO_MARIADB_SENHA ANTIGO no ambiente (32 caracteres) mascarando a senha correta da
# URL (24). O painel continuava no ar normalmente - ele usa a MIGRACAO_DB_URL -, entao nada
# denunciava a divergencia, e todo backup a partir de 30/07 morria em
# "Access denied for user 'painel'@'localhost'". Backup que autentica com credencial
# diferente da aplicacao e um alarme falso esperando para acontecer: a fonte da verdade e a
# conexao que a aplicacao usa.
if (-not $dbHost -and $env:PAINEL_NOVO_MARIADB_HOST) { $dbHost = $env:PAINEL_NOVO_MARIADB_HOST }
if (-not $env:MIGRACAO_DB_URL -and $env:PAINEL_NOVO_MARIADB_PORTA) { $porta = [int]$env:PAINEL_NOVO_MARIADB_PORTA }
if (-not $usuario -and $env:PAINEL_NOVO_MARIADB_USUARIO) { $usuario = $env:PAINEL_NOVO_MARIADB_USUARIO }
if (-not $banco -and $env:PAINEL_NOVO_MARIADB_BANCO) { $banco = $env:PAINEL_NOVO_MARIADB_BANCO }
if (-not $senha -and $env:PAINEL_NOVO_MARIADB_SENHA) { $senha = $env:PAINEL_NOVO_MARIADB_SENHA }

# Aviso alto quando o override existe e DISCORDA da URL: nao e erro (a URL vence), mas quase
# sempre significa variavel de ambiente esquecida depois de uma troca de senha.
if ($env:MIGRACAO_DB_URL -and $env:PAINEL_NOVO_MARIADB_SENHA -and
    $env:PAINEL_NOVO_MARIADB_SENHA -cne $senha) {
  Log "AVISO -> PAINEL_NOVO_MARIADB_SENHA existe e diverge da MIGRACAO_DB_URL; usando a da URL. Remova a variavel obsoleta."
}

if (-not $dbHost) { $dbHost = "127.0.0.1" }
if (-not $usuario) { Falhar "usuario do banco desconhecido - defina MIGRACAO_DB_URL ou PAINEL_NOVO_MARIADB_USUARIO" }
if (-not $banco) { Falhar "banco desconhecido - defina MIGRACAO_DB_URL ou PAINEL_NOVO_MARIADB_BANCO" }
if (-not $senha) { Falhar "senha do banco nao definida - deixe-a na MIGRACAO_DB_URL ou em PAINEL_NOVO_MARIADB_SENHA" }

# --- 3. Dump ------------------------------------------------------------------------
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$sqlFile = Join-Path $dest "painel_novo_mariadb_$ts.sql"
$zipFile = Join-Path $dest "painel_novo_mariadb_$ts.zip"

# A senha vai por --defaults-extra-file (arquivo temporario, apagado no finally), e NAO por
# --password= (ficaria visivel na lista de processos) nem por MYSQL_PWD.
#
# Por que nao MYSQL_PWD: era assim ate 02/08/2026 e nao funcionava mais com o cliente do
# MariaDB 12.2 - ele ignora a variavel e tenta conectar sem senha, falhando com
# "Access denied for user 'painel'@'localhost' (using password: YES)" e o aviso contraditorio
# "insecure passwordless login". Foi o que quebrou TODO backup a partir de 30/07 (antes
# disso, 27-29/07, o problema era outro: zips de 176 bytes). O --defaults-extra-file e o
# caminho suportado e continua mantendo a senha fora da linha de comando.
#
# --defaults-extra-file TEM de ser o primeiro argumento - o cliente ignora se vier depois.
# --result-file faz o proprio cliente gravar o arquivo, sem o pipe do PowerShell no meio (na
# 5.1 o pipe grava UTF-8 com BOM e quebra o restore).
# --single-transaction: dump consistente sem travar as tabelas (InnoDB). --routines/
# --triggers nao se aplicam (o schema nao usa nenhum dos dois).
$cnf = Join-Path $env:TEMP ("painel_novo_dump_{0}.cnf" -f [guid]::NewGuid().ToString('N'))
try {
  # ASCII sem BOM: o cliente nao le o arquivo se vier com BOM.
  $conteudo = "[client]`npassword=$senha`n"
  [System.IO.File]::WriteAllText($cnf, $conteudo, [System.Text.Encoding]::ASCII)
  & $dump "--defaults-extra-file=$cnf" --host=$dbHost --port=$porta --user=$usuario `
    --single-transaction --default-character-set=utf8mb4 --result-file=$sqlFile $banco
  $codigo = $LASTEXITCODE
} finally {
  Remove-Item $cnf -Force -ErrorAction SilentlyContinue
}

if ($codigo -ne 0) {
  Remove-Item $sqlFile -ErrorAction SilentlyContinue
  Falhar "mariadb-dump saiu com codigo $codigo (nenhum backup gerado)"
}

# --- 4. Validacao: um dump que "deu certo" mas veio vazio ja passou meses sem alarme ---
if (-not (Test-Path $sqlFile)) { Falhar "mariadb-dump nao gerou o arquivo $sqlFile" }
$tamanho = (Get-Item $sqlFile).Length
if ($tamanho -lt 10240) {
  Remove-Item $sqlFile -ErrorAction SilentlyContinue
  Falhar "dump suspeito: apenas $tamanho bytes (esperado >= 10 KB) - backup descartado"
}
$fim = Get-Content $sqlFile -Tail 5 -ErrorAction SilentlyContinue
if (-not ($fim -match "Dump completed")) {
  Remove-Item $sqlFile -ErrorAction SilentlyContinue
  Falhar "dump incompleto (sem o rodape 'Dump completed') - backup descartado"
}
if (-not (Select-String -Path $sqlFile -Pattern "CREATE TABLE" -SimpleMatch -Quiet)) {
  Remove-Item $sqlFile -ErrorAction SilentlyContinue
  Falhar "dump sem nenhum CREATE TABLE - backup descartado"
}

# --- 5. Compacta, mantem 14 dias ----------------------------------------------------
try {
  Compress-Archive -Path $sqlFile -DestinationPath $zipFile -Force
  Remove-Item $sqlFile
  Get-ChildItem $dest -Filter "painel_novo_mariadb_*.zip" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } |
    Remove-Item -Force
} catch {
  Falhar $_.Exception.Message
}

$mb = [math]::Round((Get-Item $zipFile).Length / 1MB, 2)
Log "ok -> painel_novo_mariadb_$ts.zip ($mb MB, dump de $([math]::Round($tamanho/1MB,2)) MB)"
