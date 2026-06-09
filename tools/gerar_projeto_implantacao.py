# -*- coding: utf-8 -*-
"""Gera o Projeto de Implantação do SIGER® (.docx) FIEL ao template da Rech, a
partir de tools/data/projeto.yaml. Reproduz o boilerplate de Responsabilidades e
Protocolos e a estrutura por área (Módulos Previstos / Detalhamento /
Particularidade / Não previsto).

Uso:
    python gerar_projeto_implantacao.py [data/projeto.yaml]
"""
import os
import sys
from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import _common as C

NAVY = RGBColor(0x1F, 0x4E, 0x78)


def shade_header(row, fill="1F4E78"):
    for cell in row.cells:
        tcPr = cell._tc.get_or_add_tcPr()
        shd = OxmlElement("w:shd"); shd.set(qn("w:val"), "clear"); shd.set(qn("w:fill"), fill)
        tcPr.append(shd)
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF); r.font.bold = True


def add_table(doc, headers, rows, widths=None):
    t = doc.add_table(rows=1, cols=len(headers)); t.style = "Table Grid"
    for i, h in enumerate(headers):
        t.rows[0].cells[i].paragraphs[0].add_run(h)
    shade_header(t.rows[0])
    for row in rows:
        cells = t.add_row().cells
        for i, v in enumerate(row):
            cells[i].text = str(v) if v is not None else ""
    return t


def main(projeto_path="data/projeto.yaml"):
    d = C.load_yaml(os.path.basename(projeto_path))
    cliente = d.get("cliente", "")
    nome_curto = d.get("cliente_nome_curto", cliente)

    doc = Document()
    doc.styles["Normal"].font.name = "Calibri"
    doc.styles["Normal"].font.size = Pt(11)

    def H(txt, level=1):
        h = doc.add_heading(txt, level=level)
        for r in h.runs:
            r.font.color.rgb = NAVY
        return h

    def P(txt="", bold=False):
        p = doc.add_paragraph()
        run = p.add_run(txt); run.bold = bold
        return p

    def B(items):
        for it in items or []:
            doc.add_paragraph(str(it), style="List Bullet")

    # --- Título e identificação ---
    t = doc.add_heading("Projeto de Implantação do SIGER®", level=0)
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    P("").add_run(f"Nome do Cliente: {cliente}").bold = True

    # --- Objetivos ---
    H("Objetivos", 1); B(d.get("objetivos"))

    # --- Escopo ---
    H("Escopo do projeto", 1)
    H("Geral", 2)
    P("Empresas contempladas no projeto", bold=True)
    P("Estão contempladas no referido projeto as seguintes empresas:")
    B(d.get("empresas"))

    conv = d.get("conversoes", {})
    H("Conversões", 3)
    if conv.get("nota"):
        P(conv["nota"])
    rows = [[c.get("modulo",""), c.get("converter",""), c.get("dados",""), c.get("obs","")]
            for c in conv.get("tabela", [])]
    add_table(doc, ["Módulo/Área", "Conversão (Sim/Não)", "Dados a Converter",
                    "Observações/Particularidades"], rows)

    cad = d.get("cadastros", {})
    H("Cadastros", 3)
    P("Clientes e Fornecedores", bold=True); B(cad.get("clientes_fornecedores"))
    P("Produtos/Serviços", bold=True); B(cad.get("produtos"))
    P("Outros pontos gerais do projeto", bold=True); B(cad.get("outros"))

    # --- Detalhamento das Rotinas (por área) ---
    H("Detalhamento das Rotinas", 1)
    for a in d.get("areas", []):
        H(a.get("grupo", ""), 2)
        H(a.get("sub", ""), 3)
        P("- Módulos Previstos", bold=True); B(a.get("modulos_previstos"))
        P("Detalhamento das rotinas que serão atendidas na área conforme identificado no levantamento", bold=True)
        B(a.get("detalhamento"))
        P("Particularidade específica identificada na área", bold=True)
        B(a.get("particularidades"))
        P("Não está previsto neste projeto:", bold=True)
        B(a.get("nao_previsto"))

    # --- Responsabilidades (boilerplate fixo) ---
    H("Responsabilidades na Execução do Projeto", 1)
    P("1. Responsabilidades da Rech Informática Ltda", bold=True)
    P("A Rech Informática será responsável exclusivamente pelas atividades relacionadas ao software SIGER®, conforme segue:")
    P("1.1 - Atividades Incluídas:", bold=True)
    B(["Consultoria especializada no software SIGER®;",
       "Treinamentos de utilização do SIGER®, conforme escopo definido neste projeto."])
    P("1.2 - Atividades Não Incluídas:", bold=True)
    B(["Instalação e/ou treinamento referente a softwares auxiliares, incluindo: softwares governamentais; softwares de terceiros.",
       "Configuração, manutenção ou suporte relacionado a hardwares, envolvendo: equipamentos; infraestrutura de rede."])
    P("1.3 - Condições Gerais:", bold=True)
    B(["A Rech Informática reserva-se o direito de realizar substituição de técnicos da equipe de implantação e treinamento, quando necessário;",
       "O cronograma poderá ser remanejado por necessidade técnica, sem prejuízo ao andamento do treinamento para o cliente;",
       "Caso a empresa cliente não execute as tarefas necessárias para o avanço à próxima etapa, poderá ocorrer readequação do cronograma, impactando nos prazos de conclusão da implantação;",
       "Os horários definidos no cronograma deverão ser rigorosamente respeitados;",
       f"Os treinamentos serão destinados exclusivamente aos usuários previamente definidos no projeto. Qualquer necessidade de treinamento adicional deverá ser suprida pela {nome_curto}, ou poderá ser contratada à parte junto à Rech Informática."])
    P(f"2. Responsabilidades do cliente {nome_curto}", bold=True)
    P("2.1 - Infraestrutura e Recursos:", bold=True)
    B(["Garantir a disponibilidade técnica de equipamentos e infraestrutura necessários para a instalação e utilização do sistema."])
    P("2.2 - Equipe Interna:", bold=True)
    B(["Organizar e disponibilizar sua equipe de colaboradores para participação nos treinamentos, conforme datas e horários estabelecidos no cronograma;",
       f"Em caso de substituição de usuários já treinados, caberá à {nome_curto} transferir o conhecimento ao novo colaborador. Caso seja necessário que a Rech realize novo treinamento, os custos e prazos serão previamente avaliados."])
    P("2.3 - Cronograma e Comunicação:", bold=True)
    B(["Solicitações de alteração no cronograma serão analisadas pela Rech e readequadas conforme disponibilidade da equipe técnica;",
       "Dúvidas surgidas fora dos momentos de treinamento deverão ser direcionadas aos técnicos da equipe de implantação (via telefone, e-mail, Teams ou acesso remoto). O retorno poderá não ser imediato, considerando a possibilidade de atendimentos externos em andamento."])
    P("2.4 - Solicitações de Implementações:", bold=True)
    B([f"Implementações solicitadas após o início do projeto terão sua customização, prazos e viabilidade avaliados, validados e homologados pelo {nome_curto} e pela Rech Informática."])
    P("3. Uso de Protocolos Digitais – Rech Informática", bold=True)
    B(["A Rech Informática adota, como padrão operacional, o uso de protocolos digitais para formalização das entregas e comunicações relacionadas aos projetos;",
       "Os protocolos serão enviados aos usuários ou responsáveis designados neste projeto, de forma setorial ou centralizada, conforme planejamento;",
       "A partir da data de envio do protocolo, o prazo para aceite ou aceite com ressalvas será de 07 (sete) dias úteis;",
       "Na ausência de manifestação dentro desse prazo, o protocolo será considerado aceito automaticamente;",
       "Essas informações constarão também no Termo de Encerramento do Projeto, encaminhado à empresa contratante ao final da implantação."])

    # --- Equipes de Trabalho ---
    H("Equipes de Trabalho", 1)
    eq = d.get("equipe", {})
    P("Rech:", bold=True)
    P(f"Gerente de Contas do Projeto: {eq.get('gerente_contas','')}")
    P(f"Redator do Projeto: {eq.get('redator','')}")
    P(f"Consultor/Implantador: {eq.get('consultor','')}")
    P("Cliente:", bold=True)
    P(f"Encarregado pelo Projeto: {eq.get('encarregado_cliente','')}")

    P("Tabela de Usuários", bold=True)
    add_table(doc, ["Nome", "E-mail", "Área de Atuação no SIGER", "Assina Protocolo"],
              [[u.get("nome",""), u.get("email",""), u.get("area",""), u.get("assina","")]
               for u in d.get("usuarios", [])])

    # --- Cronograma Macro ---
    H("Cronograma Macro", 1)
    add_table(doc, ["Fase", "Etapa", "Período previsto"],
              [[c.get("fase",""), c.get("etapa",""), c.get("periodo","")]
               for c in d.get("cronograma_macro", [])])

    # --- Tempo estimado ---
    P("Tempo Estimado:", bold=True); B(d.get("horas"))
    P("As horas bonificadas somente serão utilizadas se assim o processo requerer, não perfazendo compromisso em manutenção de saldo quando não utilizada totalmente para conclusão do projeto.")

    # --- Assinaturas ---
    doc.add_paragraph()
    P(d.get("cidade_data", ""))
    doc.add_paragraph()
    P("Assinatura Rech\t\t\t\tAssinatura Cliente")

    C.ensure_out()
    fname = f"Projeto_Implantacao_{C.slug(nome_curto or cliente)}.docx"
    path = os.path.join(C.OUT, fname)
    doc.save(path)
    print(f"OK: {fname} ({len(d.get('areas', []))} áreas) -> {path}")


if __name__ == "__main__":
    args = sys.argv[1:]
    main(*args) if args else main()
