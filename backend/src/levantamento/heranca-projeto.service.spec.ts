import { readFileSync } from 'fs';
import { join } from 'path';
import { HerancaProjetoService } from './heranca-projeto.service';
import { AREAS_PROJETO } from './areas-projeto.constants';

function montar(opcoes: {
  modulos?: string;
  levantamento?: Record<string, string>;
  respostas?: Array<{
    moduloSigla: string;
    topico: string;
    resposta: string;
    naoUtilizado?: boolean;
  }>;
  semProjeto?: boolean;
}) {
  const campos = new Map(
    Object.entries(opcoes.levantamento ?? {}).map(([campo, valor]) => [
      campo,
      valor,
    ]),
  );
  const respostas = (opcoes.respostas ?? []).map((r, i) => ({
    ordem: i,
    naoUtilizado: false,
    ...r,
  }));
  const levantamento = {
    camposDoLevantamento: jest.fn().mockResolvedValue(campos),
    respostasDoProjeto: jest.fn().mockResolvedValue(respostas),
  } as any;
  const projetos = {
    porId: jest
      .fn()
      .mockResolvedValue(
        opcoes.semProjeto ? null : { id: 1, modulos: opcoes.modulos ?? 'FAT' },
      ),
  } as any;
  const indice = {
    modulos: jest.fn().mockResolvedValue([
      { sigla: 'FAT', nome: 'Faturamento' },
      { sigla: 'PDV', nome: 'Frente de Caixa' },
      { sigla: 'EST', nome: 'Estoque' },
      { sigla: 'FIN', nome: 'Financeiro' },
    ]),
  } as any;
  return new HerancaProjetoService(levantamento, projetos, indice);
}

describe('HerancaProjetoService — etapa 3 (Levantamento) alimenta a etapa 10 (Projeto)', () => {
  it('herda objetivos e empresas dos campos equivalentes do Levantamento', async () => {
    const svc = montar({
      levantamento: {
        objetivos: 'Padronizar o processo comercial.',
        filiais: 'Matriz em Novo Hamburgo e filial em Campo Bom.',
      },
    });

    const v = await svc.valores(1);

    expect(v.objetivos).toBe('Padronizar o processo comercial.');
    // "Empresas contempladas no projeto" é a mesma informação que o Levantamento anota como
    // "Localização / Filiais".
    expect(v.empresas).toBe('Matriz em Novo Hamburgo e filial em Campo Bom.');
  });

  it('herda as 5 linhas de usuários-chave, com Atribuições virando Área de Atuação', async () => {
    const levantamento: Record<string, string> = {};
    for (let i = 0; i < 5; i++) {
      levantamento[`usu_${i}_nome`] = `Pessoa ${i}`;
      levantamento[`usu_${i}_email`] = `pessoa${i}@cliente.com.br`;
      levantamento[`usu_${i}_atrib`] = `Atribuição ${i}`;
    }
    const svc = montar({ levantamento });

    const v = await svc.valores(1);

    // A 5ª linha é a que se perdia quando a Tabela de Usuários do Projeto tinha só 4.
    expect(v.usu_4_nome).toBe('Pessoa 4');
    expect(v.usu_4_email).toBe('pessoa4@cliente.com.br');
    expect(v.usu_4_area).toBe('Atribuição 4');
    // "Assina Protocolo" não existe na etapa 3 — fica para o GCI decidir na tela.
    expect(v.usu_4_assina).toBeUndefined();
  });

  it('monta o Detalhamento de Rotinas da área com as respostas do questionário', async () => {
    const svc = montar({
      modulos: 'FAT, PDV',
      respostas: [
        {
          moduloSigla: 'FAT',
          topico: 'Emissão de pedido',
          resposta: 'Digitado pelo representante.',
        },
        {
          moduloSigla: 'PDV',
          topico: 'Fechamento de caixa',
          resposta: 'Conferência diária por turno.',
        },
      ],
    });

    const v = await svc.valores(1);

    expect(v.det_vendas_modulos).toBe(
      'FAT — Faturamento, PDV — Frente de Caixa',
    );
    expect(v.det_vendas_detalhamento).toBe(
      'Emissão de pedido: Digitado pelo representante.\n' +
        'Fechamento de caixa: Conferência diária por turno.',
    );
  });

  it('tópico marcado "Não será utilizado" vai para "Não está previsto", não para o detalhamento', async () => {
    const svc = montar({
      modulos: 'FAT',
      respostas: [
        {
          moduloSigla: 'FAT',
          topico: 'Emissão de pedido',
          resposta: 'Digitado pelo representante.',
        },
        {
          moduloSigla: 'FAT',
          topico: 'Venda por consignação',
          resposta:
            'Este campo foi desconsiderado, pois esta funcionalidade não será utilizada pelo cliente.',
          naoUtilizado: true,
        },
      ],
    });

    const v = await svc.valores(1);

    expect(v.det_vendas_detalhamento).toBe(
      'Emissão de pedido: Digitado pelo representante.',
    );
    expect(v.det_vendas_naoprevisto).toBe('Venda por consignação');
    // A frase padrão do "não será utilizado" não pode poluir o detalhamento das rotinas
    // atendidas — é o oposto do que a seção diz.
    expect(v.det_vendas_detalhamento).not.toContain('desconsiderado');
  });

  it('área sem módulo contratado não entra no Projeto', async () => {
    const svc = montar({
      modulos: 'FAT',
      respostas: [
        {
          moduloSigla: 'FIN',
          topico: 'Contas a receber',
          resposta: 'Boleto CNAB.',
        },
      ],
    });

    const v = await svc.valores(1);

    expect(v.det_vendas_modulos).toBe('FAT — Faturamento');
    expect(v.det_financeiro_modulos).toBeUndefined();
    expect(v.det_financeiro_detalhamento).toBeUndefined();
  });

  it('projeto inexistente devolve mapa vazio em vez de estourar', async () => {
    const svc = montar({ semProjeto: true });
    await expect(svc.valores(999)).resolves.toEqual({});
  });

  it('as áreas do Projeto são as mesmas do docservice (a lista está duplicada nas duas camadas)', () => {
    // AREAS_PROJETO existe em três lugares por necessidade (backend, frontend, docservice).
    // Se alguém acrescentar uma área ou mover uma sigla num só, a etapa 10 e o .docx passam
    // a discordar sobre o que é "área contratada" — este teste falha antes disso chegar ao
    // cliente.
    const py = readFileSync(
      join(__dirname, '..', '..', '..', 'docservice', 'gerador', 'doc_edit.py'),
      'utf-8',
    );
    const bloco = py.slice(py.indexOf('_PROJ_AREAS = ['));
    const linhas = bloco.slice(0, bloco.indexOf(']\n')).split('\n');
    const doPython = linhas
      .map((l) => /\("(\w+)",\s*"([^"]+)",\s*\[([^\]]+)\]\)/.exec(l))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => ({
        chave: m[1],
        nome: m[2],
        siglas: m[3].split(',').map((s) => s.trim().replace(/"/g, '')),
      }));

    expect(doPython).toHaveLength(AREAS_PROJETO.length);
    expect(doPython).toEqual(AREAS_PROJETO);
  });
});
