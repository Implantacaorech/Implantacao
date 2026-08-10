@echo off
REM ============================================================
REM  Certificado do Painel emitido pela CA INTERNA da Rech.
REM
REM  Por que este e melhor que o autoassinado
REM  (Ativar_HTTPS_Painel.bat): a CA rechinfo-PR-ADCS-VS25-CA ja
REM  e confiavel em TODO computador do dominio, distribuida pelo
REM  proprio AD. Com um certificado dela, ninguem precisa
REM  instalar nada em maquina nenhuma e nao aparece aviso.
REM
REM  Pede elevacao sozinho (a chave privada vai para a loja da
REM  maquina). NAO reinicia o painel.
REM ============================================================
setlocal EnableDelayedExpansion
cd /d "%~dp0"

net session >nul 2>&1
if errorlevel 1 (
  echo Pedindo elevacao ^(UAC^)...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b 0
)

set "CA=PR-ADCS-VS25.rechinfo.local\rechinfo-PR-ADCS-VS25-CA"
set "MODELO=WebServer"
set "SENHA=painel"
set "DESTINO=%~dp0backend\certs\painel-ca.pfx"
set "TRAB=%TEMP%\painel-cert"

REM Nomes e IPs desta maquina, para o SAN. IP entra como IPAddress -- o
REM navegador nao aceita IP declarado como nome DNS.
for /f "usebackq delims=" %%a in (`powershell -NoProfile -Command "$env:COMPUTERNAME"`) do set "CURTO=%%a"
for /f "usebackq delims=" %%a in (`powershell -NoProfile -Command "[System.Net.Dns]::GetHostEntry($env:COMPUTERNAME).HostName"`) do set "FQDN=%%a"
for /f "usebackq delims=" %%a in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown' } ^| Select-Object -ExpandProperty IPAddress) -join ','"`) do set "IPS=%%a"

echo.
echo ===============================================================
echo   Certificado do Painel pela CA interna da Rech
echo ===============================================================
echo   CA     : %CA%
echo   Modelo : %MODELO%
echo   Nomes  : %CURTO% , %FQDN%
echo   IPs    : %IPS%
echo.

if not exist "%TRAB%" mkdir "%TRAB%"
if not exist "%~dp0backend\certs" mkdir "%~dp0backend\certs"

REM --- Monta o pedido -------------------------------------------------
> "%TRAB%\pedido.inf" echo [Version]
>> "%TRAB%\pedido.inf" echo Signature="$Windows NT$"
>> "%TRAB%\pedido.inf" echo.
>> "%TRAB%\pedido.inf" echo [NewRequest]
>> "%TRAB%\pedido.inf" echo Subject="CN=%FQDN%"
>> "%TRAB%\pedido.inf" echo KeyLength=2048
>> "%TRAB%\pedido.inf" echo KeySpec=1
>> "%TRAB%\pedido.inf" echo KeyUsage=0xA0
>> "%TRAB%\pedido.inf" echo MachineKeySet=True
>> "%TRAB%\pedido.inf" echo Exportable=True
>> "%TRAB%\pedido.inf" echo HashAlgorithm=SHA256
>> "%TRAB%\pedido.inf" echo ProviderName="Microsoft RSA SChannel Cryptographic Provider"
>> "%TRAB%\pedido.inf" echo RequestType=PKCS10
>> "%TRAB%\pedido.inf" echo.
>> "%TRAB%\pedido.inf" echo [Extensions]
>> "%TRAB%\pedido.inf" echo 2.5.29.17="{text}"
>> "%TRAB%\pedido.inf" echo _continue_="dns=%FQDN%&"
>> "%TRAB%\pedido.inf" echo _continue_="dns=%CURTO%&"
for %%i in (%IPS%) do >> "%TRAB%\pedido.inf" echo _continue_="ipaddress=%%i&"
>> "%TRAB%\pedido.inf" echo.
>> "%TRAB%\pedido.inf" echo [EnhancedKeyUsageExtension]
>> "%TRAB%\pedido.inf" echo OID=1.3.6.1.5.5.7.3.1

del /q "%TRAB%\pedido.req" "%TRAB%\emitido.cer" 2>nul

echo [1/4] Gerando o pedido...
certreq -new "%TRAB%\pedido.inf" "%TRAB%\pedido.req"
if errorlevel 1 goto :erro

echo [2/4] Enviando para a CA...
certreq -submit -config "%CA%" -attrib "CertificateTemplate:%MODELO%" "%TRAB%\pedido.req" "%TRAB%\emitido.cer"
if errorlevel 1 (
  echo.
  echo [ATENCAO] A CA nao emitiu automaticamente.
  echo   Causa comum: esta conta nao tem permissao de inscricao no modelo
  echo   "%MODELO%", ou o pedido ficou PENDENTE de aprovacao da TI.
  echo   Peca a TI: permissao de Enroll no modelo WebServer para esta
  echo   maquina/usuario, ou que aprovem o pedido pendente.
  echo   Enquanto isso, o Ativar_HTTPS_Painel.bat ^(autoassinado^) resolve.
  goto :erro
)

echo [3/4] Instalando o certificado com a chave privada...
certreq -accept "%TRAB%\emitido.cer"
if errorlevel 1 goto :erro

echo [4/4] Exportando o .pfx para o painel...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$c = Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.Subject -like '*%FQDN%*' -and $_.Issuer -like '*rechinfo*' } | Sort-Object NotAfter -Descending | Select-Object -First 1;" ^
  "if (-not $c) { Write-Error 'certificado emitido nao encontrado na loja'; exit 1 };" ^
  "$p = ConvertTo-SecureString -String '%SENHA%' -AsPlainText -Force;" ^
  "Export-PfxCertificate -Cert $c -FilePath '%DESTINO%' -Password $p | Out-Null;" ^
  "[Environment]::SetEnvironmentVariable('MIGRACAO_HTTPS_PFX', '%DESTINO%', 'Machine');" ^
  "[Environment]::SetEnvironmentVariable('MIGRACAO_HTTPS_PFX_SENHA', '%SENHA%', 'Machine');" ^
  "Write-Host ('Emitido por: ' + $c.Issuer);" ^
  "Write-Host ('Valido ate : ' + $c.NotAfter);" ^
  "Write-Host ('SAN        : ' + ($c.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.17' }).Format($false))"
if errorlevel 1 goto :erro

del /q "%TRAB%\pedido.inf" "%TRAB%\pedido.req" "%TRAB%\emitido.cer" 2>nul

echo.
echo ===============================================================
echo   PRONTO. O painel passa a usar o certificado da CA interna.
echo   Como toda maquina do dominio ja confia nessa CA, NINGUEM
echo   precisa instalar nada -- e nao aparece aviso no navegador.
echo.
echo   Falta so reiniciar o painel:
echo     Iniciar_Painel_Novo.bat
echo ===============================================================
pause
exit /b 0

:erro
echo.
echo [ERRO] Nao foi possivel concluir. Veja a mensagem acima.
pause
exit /b 1
