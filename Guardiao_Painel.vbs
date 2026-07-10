' Guardiao do Painel de Implantacao.
' Sobe o servidor se /health nao responder. Roda OCULTO (sem janela).
' Disparado pela Tarefa Agendada do Windows: no logon e a cada 5 minutos.
' Log em C:\PainelBackups\guardiao.log
Option Explicit
Dim fso, base, http, up, shell, log
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName) & "\"

up = False
Set http = CreateObject("MSXML2.XMLHTTP")
On Error Resume Next
http.open "GET", "http://localhost:5000/health", False
http.send
If Err.Number = 0 And http.status = 200 Then up = True
On Error GoTo 0

If up Then WScript.Quit 0     ' ja esta no ar -> nada a fazer

On Error Resume Next          ' registra a queda (nao falha se o log estiver ocupado)
Set log = fso.OpenTextFile("C:\PainelBackups\guardiao.log", 8, True)
log.WriteLine Now & " - Painel fora do ar; reiniciando."
log.Close
On Error GoTo 0

Set shell = CreateObject("WScript.Shell")   ' sobe OCULTO (0) e nao espera (False)
shell.CurrentDirectory = base
shell.Run """" & base & "Iniciar_Servidor.bat""", 0, False
