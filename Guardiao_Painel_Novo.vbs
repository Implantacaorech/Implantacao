' Guardiao do Painel de Implantacao NOVO (Angular + NestJS).
' Sobe o servidor se /api/health nao responder. Roda OCULTO (sem janela).
' Pre-requisito: MIGRACAO_DB_URL / MIGRACAO_JWT_SECRET / MIGRACAO_JWT_REFRESH_SECRET
' definidas como variavel de USUARIO do Windows (mesmo padrao do PAINEL_DB_URL do
' guardiao antigo) - sem elas, Iniciar_Painel_Novo.bat falha rapido e loga o motivo.
' Disparado por uma Tarefa Agendada do Windows PROPRIA (nao reusar a tarefa do
' guardiao antigo - sao dois sistemas em paralelo durante a virada).
' Log em C:\PainelBackups\guardiao_novo.log
Option Explicit
Dim fso, base, http, up, shell, log, porta
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName) & "\"
porta = "5100" ' mesma porta do MIGRACAO_PORT em Iniciar_Painel_Novo.bat

up = False
Set http = CreateObject("MSXML2.XMLHTTP")
On Error Resume Next
http.open "GET", "http://localhost:" & porta & "/api/health", False
http.send
If Err.Number = 0 And http.status = 200 Then up = True
On Error GoTo 0

If up Then WScript.Quit 0     ' ja esta no ar -> nada a fazer

On Error Resume Next          ' registra a queda (nao falha se o log estiver ocupado)
Set log = fso.OpenTextFile("C:\PainelBackups\guardiao_novo.log", 8, True)
log.WriteLine Now & " - Painel novo fora do ar; reiniciando."
log.Close
On Error GoTo 0

Set shell = CreateObject("WScript.Shell")   ' sobe OCULTO (0) e nao espera (False)
shell.CurrentDirectory = base
shell.Run """" & base & "Iniciar_Painel_Novo.bat""", 0, False
