' Guardiao do Painel de Implantacao NOVO (Angular + NestJS).
' Vigia DOIS servicos e sobe o que estiver fora do ar. Roda OCULTO (sem janela).
'
'   painel     (5100) -> Iniciar_Painel_Novo.bat  (NestJS + Angular)
'   docservice (8001) -> docservice\iniciar.bat   (geracao de documentos + transcricao)
'
' Por que os dois: sao processos SEPARADOS, e o Iniciar_Painel_Novo.bat so sobe o
' docservice quando ele mesmo e executado. Vigiar so a 5100 deixava um buraco real —
' em 2026-08-04 o painel reiniciou as 05:35 e o docservice ficou para tras, sem ninguem
' para reergue-lo. O sintoma chega ao usuario como "Nao foi possivel iniciar a gravacao:
' ECONNREFUSED 127.0.0.1:8001", varias horas depois, sem relacao aparente com a causa.
'
' Pre-requisito: MIGRACAO_DB_URL / MIGRACAO_JWT_SECRET / MIGRACAO_JWT_REFRESH_SECRET
' definidas como variavel de ambiente (sem elas, Iniciar_Painel_Novo.bat falha rapido e
' loga o motivo). Disparado por uma Tarefa Agendada do Windows PROPRIA.
' Log em C:\PainelBackups\guardiao_novo.log
Option Explicit
Dim fso, base, shell, subiu

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
base = fso.GetParentFolderName(WScript.ScriptFullName) & "\"
shell.CurrentDirectory = base
subiu = False

' O painel PRIMEIRO: o Iniciar_Painel_Novo.bat ja sobe o docservice junto quando a 8001
' esta livre, entao nesse caso a checagem seguinte nao tem mais o que fazer.
If Not NoAr("http://localhost:5100/api/health") Then
    Registrar "Painel novo fora do ar; reiniciando."
    shell.Run """" & base & "Iniciar_Painel_Novo.bat""", 0, False
    subiu = True
    WScript.Sleep 15000   ' da tempo de o .bat subir o docservice antes de conferir
End If

If Not NoAr("http://127.0.0.1:8001/health") Then
    Registrar "docservice fora do ar; reiniciando."
    shell.Run """" & base & "docservice\iniciar.bat""", 0, False
End If

WScript.Quit 0


' Devolve True se o endereco respondeu 200. Qualquer falha (conexao recusada, timeout)
' conta como fora do ar.
Function NoAr(url)
    Dim http
    NoAr = False
    Set http = CreateObject("MSXML2.XMLHTTP")
    On Error Resume Next
    http.open "GET", url, False
    http.send
    If Err.Number = 0 And http.status = 200 Then NoAr = True
    On Error GoTo 0
End Function


' Registra a queda no log (nao falha se o arquivo estiver ocupado).
Sub Registrar(msg)
    Dim log
    On Error Resume Next
    Set log = fso.OpenTextFile("C:\PainelBackups\guardiao_novo.log", 8, True)
    log.WriteLine Now & " - " & msg
    log.Close
    On Error GoTo 0
End Sub
