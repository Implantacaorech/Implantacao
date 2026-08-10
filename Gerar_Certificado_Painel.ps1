<#
.SYNOPSIS
  Gera o certificado HTTPS do Painel de Implantacao (autoassinado) e exporta o .pfx que o
  backend le direto.

.DESCRIPTION
  O navegador so libera microfone e captura de tela em CONTEXTO SEGURO (HTTPS ou
  localhost). Sem TLS, a gravacao de reuniao fica bloqueada em qualquer maquina que nao
  seja a do proprio servidor.

  O detalhe que costuma derrubar essa tentativa: o certificado precisa cobrir EXATAMENTE o
  que aparece na barra de enderecos. Para acesso por IP, o endereco tem de estar no SAN
  como iPAddress -- o Chrome/Edge NAO aceita IP declarado como nome DNS. Este script monta
  o SAN com o nome curto, o FQDN e os IPs informados, cada um no tipo certo.

  Rode como ADMINISTRADOR (a instalacao na raiz confiavel exige elevacao).

.PARAMETER Nomes
  Nomes DNS a cobrir. Padrao: nome curto da maquina + FQDN.

.PARAMETER Ips
  IPs a cobrir. Padrao: os IPv4 nao-loopback da maquina.

.PARAMETER Senha
  Senha do .pfx. Padrao: "painel".

.PARAMETER Saida
  Caminho do .pfx. Padrao: backend\certs\painel.pfx (ao lado deste script).

.EXAMPLE
  .\Gerar_Certificado_Painel.ps1
  .\Gerar_Certificado_Painel.ps1 -Ips '10.0.0.15' -Senha 'segredo'
#>
[CmdletBinding()]
param(
  [string[]] $Nomes,
  [string[]] $Ips,
  [string]   $Senha = 'painel',
  [string]   $Saida
)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not $Saida) { $Saida = Join-Path $raiz 'backend\certs\painel.pfx' }

if (-not $Nomes) {
  $curto = $env:COMPUTERNAME
  $fqdn = [System.Net.Dns]::GetHostEntry($curto).HostName
  $Nomes = @($curto, $fqdn) | Select-Object -Unique
}
if (-not $Ips) {
  $Ips = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown' } |
    Select-Object -ExpandProperty IPAddress -Unique
}

Write-Host ''
Write-Host '===============================================================' -ForegroundColor Cyan
Write-Host '  Certificado HTTPS do Painel de Implantacao' -ForegroundColor Cyan
Write-Host '===============================================================' -ForegroundColor Cyan
Write-Host ("  Nomes DNS : " + ($Nomes -join ', '))
Write-Host ("  IPs       : " + ($Ips -join ', '))
Write-Host ("  Saida     : " + $Saida)
Write-Host ''

# SAN montado a mao: 'DNS=' para nome, 'IPAddress=' para IP. Usar -DnsName com um IP
# gravaria o IP como dNSName, e o navegador recusa isso ao acessar por IP.
$partes = @()
foreach ($n in $Nomes) { $partes += "DNS=$n" }
foreach ($i in $Ips)   { $partes += "IPAddress=$i" }
$san = '2.5.29.17={text}' + ($partes -join '&')

$cert = New-SelfSignedCertificate `
  -Subject "CN=$($Nomes[0])" `
  -TextExtension @($san, '2.5.29.37={text}1.3.6.1.5.5.7.3.1') `
  -KeyExportPolicy Exportable `
  -KeyLength 2048 `
  -KeyAlgorithm RSA `
  -HashAlgorithm SHA256 `
  -NotAfter (Get-Date).AddYears(5) `
  -CertStoreLocation 'Cert:\LocalMachine\My'

Write-Host ("Certificado criado. Thumbprint: " + $cert.Thumbprint) -ForegroundColor Green

$pasta = Split-Path -Parent $Saida
if (-not (Test-Path $pasta)) { New-Item -ItemType Directory -Force $pasta | Out-Null }

$senhaSegura = ConvertTo-SecureString -String $Senha -AsPlainText -Force
Export-PfxCertificate -Cert $cert -FilePath $Saida -Password $senhaSegura | Out-Null
Write-Host ("PFX exportado em: " + $Saida) -ForegroundColor Green

# Instala na raiz confiavel DESTA maquina: sem isso o proprio servidor mostra aviso de
# certificado. Nas demais maquinas, distribua o .cer por GPO (ver instrucoes ao final).
try {
  $loja = New-Object System.Security.Cryptography.X509Certificates.X509Store('Root', 'LocalMachine')
  $loja.Open('ReadWrite')
  $loja.Add($cert)
  $loja.Close()
  Write-Host 'Instalado na raiz confiavel desta maquina.' -ForegroundColor Green
} catch {
  Write-Warning "Nao foi possivel instalar na raiz confiavel (rode como Administrador): $_"
}

$cer = [System.IO.Path]::ChangeExtension($Saida, '.cer')
Export-Certificate -Cert $cert -FilePath $cer | Out-Null

# Porta do HTTPS no firewall. A 5100 ja tem regra (o painel roda ha meses); a 5443 e nova,
# e sem isso o HTTPS responde so na propria maquina -- sintoma identico a "nao funcionou".
$portaHttps = if ($env:MIGRACAO_HTTPS_PORT) { $env:MIGRACAO_HTTPS_PORT } else { '5443' }
$regra = 'Painel de Implantacao - HTTPS'
try {
  if (-not (Get-NetFirewallRule -DisplayName $regra -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $regra -Direction Inbound -Protocol TCP `
      -LocalPort $portaHttps -Action Allow -Profile Domain,Private | Out-Null
    Write-Host ("Firewall: porta $portaHttps liberada para a rede interna.") -ForegroundColor Green
  } else {
    Write-Host ("Firewall: regra '$regra' ja existia.") -ForegroundColor Green
  }
} catch {
  Write-Warning "Nao foi possivel criar a regra de firewall (rode como Administrador): $_"
}

# Variaveis de ambiente da MAQUINA (nivel Machine, para valerem no servico/tarefa
# agendada). Feito aqui, e nao a mao, porque errar o caminho do .pfx e o jeito mais facil
# de o painel subir sem HTTPS "sem motivo" -- o backend falha o boot nesse caso, de
# proposito, mas o susto e desnecessario.
try {
  [Environment]::SetEnvironmentVariable('MIGRACAO_HTTPS_PFX', $Saida, 'Machine')
  [Environment]::SetEnvironmentVariable('MIGRACAO_HTTPS_PFX_SENHA', $Senha, 'Machine')
  [Environment]::SetEnvironmentVariable('MIGRACAO_HTTPS_PORT', $portaHttps, 'Machine')
  Write-Host 'Variaveis de ambiente da maquina configuradas.' -ForegroundColor Green
} catch {
  Write-Warning "Nao foi possivel gravar as variaveis de ambiente (rode como Administrador): $_"
}

$ips = ($Ips -join ', ')
Write-Host ''
Write-Host '--- Proximos passos -------------------------------------------' -ForegroundColor Yellow
Write-Host '1) Reinicie o painel para o HTTPS entrar no ar:'
Write-Host '     Build_Painel_Novo.bat   (se o codigo mudou -- aplica migrations)'
Write-Host '     Iniciar_Painel_Novo.bat'
Write-Host '   A porta 5100 (HTTP) CONTINUA no ar: quem ja usa o painel nao e afetado.'
Write-Host '2) Acesse pela URL segura (gravacao de reuniao so funciona por aqui):'
foreach ($n in $Nomes) { Write-Host ("     https://" + $n + ":" + $portaHttps) }
foreach ($i in $Ips)   { Write-Host ("     https://" + $i + ":" + $portaHttps) }
Write-Host '3) Nas demais maquinas, instale o certificado publico para nao aparecer aviso:'
Write-Host ("     " + $cer)
Write-Host '     (duplo clique > Instalar > Computador local > Autoridades de Certificacao'
Write-Host '      Raiz Confiaveis; ou distribua por GPO)'
Write-Host ''
Write-Host 'Sem instalar o certificado, o navegador mostra um aviso -- aceitando uma vez,'
Write-Host 'a gravacao ja funciona (a pagina vira contexto seguro mesmo assim).'
Write-Host '---------------------------------------------------------------' -ForegroundColor Yellow
