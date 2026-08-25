import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  ConsultorSigerService,
  interpretar,
  normalizar,
} from './consultor-siger.service';

/** Base derivada de FIXTURE — mesmo esquema do indexador (F:\CONSULTOR-SIGER), com um
 * recorte mínimo de Faturamento. Os testes NUNCA tocam a base real nem a fonte F:\SIGER. */
function criarBaseFixture(caminho: string): void {
  const db = new Database(caminho);
  db.exec(`
    create table entidade(
      id integer primary key, tipo text, codigo text, nome text,
      modulo text, arquivo text, linha int, versao text, extra text);
    create table relacao(origem int, destino int, tipo text, detalhe text);
    create table chunk(
      id integer primary key, entidade int, tipo text, modulo text,
      referencia text, arquivo text, linha int, versao text, texto text);
    create virtual table chunk_fts using fts5(
      texto, referencia, content='chunk', content_rowid='id',
      tokenize="unicode61 remove_diacritics 2");
  `);
  const ent = db.prepare(
    `insert into entidade(tipo,codigo,nome,modulo,arquivo,linha,versao,extra)
     values(?,?,?,?,?,?,?,?)`,
  );
  const chunk = db.prepare(
    `insert into chunk(entidade,tipo,modulo,referencia,arquivo,linha,versao,texto)
     values(?,?,?,?,?,?,?,?)`,
  );
  const fts = db.prepare(
    'insert into chunk_fts(rowid,texto,referencia) values(?,?,?)',
  );
  const inserir = (
    entidade: number | null,
    tipo: string,
    modulo: string | null,
    referencia: string,
    texto: string,
  ): void => {
    const r = chunk.run(
      entidade,
      tipo,
      modulo,
      referencia,
      'F:\\FIXTURE\\arq.cbl',
      10,
      '23.10b',
      texto,
    );
    fts.run(r.lastInsertRowid, semAcento(texto), referencia);
  };
  const semAcento = (t: string): string =>
    t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const modFat = ent.run(
    'modulo',
    'FAT',
    'Programa de menus do sistema de Faturamento',
    'FAT',
    'F:\\FIXTURE\\FAT005.CBL',
    2,
    '23.10b',
    null,
  ).lastInsertRowid as number;
  for (const [i, contexto] of [
    'Menu 1 - Cadastros',
    'Menu 2 - Rotinas Diárias',
    'Menu 3 - Relatórios',
  ].entries()) {
    ent.run(
      'menu_opcao',
      null,
      `opção ${i}`,
      'FAT',
      'F:\\FIXTURE\\FAT005.CBL',
      100 + i,
      '23.10b',
      JSON.stringify({ contexto }),
    );
  }
  inserir(modFat, 'modulo', 'FAT', 'módulo FAT', 'Módulo FAT — Faturamento');
  inserir(
    null,
    'help',
    null,
    'ajuda da tela tabloc — Configurações NF',
    'Configurações para emissão de Nota Fiscal: emite boleto automaticamente no faturamento do pedido.',
  );
  inserir(
    null,
    'parametro',
    null,
    'parâmetro mk-dfn (PARAMSIS.CPY)',
    'Parâmetro mk-dfn: atualiza data do faturamento ao emitir NF do pedido.',
  );
  inserir(
    null,
    'tela_validacao',
    'FAT',
    'validações FAT031 — Ordem de despacho',
    'Validações da tela Ordem de despacho: número da nota fiscal obrigatório no faturamento.',
  );
  inserir(
    null,
    'menu',
    'FAT',
    'FAT · Menu 2 - Rotinas Diárias',
    'Menu do módulo FAT (Faturamento) — Menu 2 - Rotinas Diárias: 2-Preparação de Nota Fiscal',
  );
  // Instrução interna do programa de menus — o filtro de ruído tem de descartar isto.
  inserir(
    null,
    'menu',
    'FAT',
    'FAT · instrução interna',
    'O 3º caractere corresponde à opção de 3º nível do faturamento',
  );
  db.close();
}

const servicosAbertos: ConsultorSigerService[] = [];

function servicoCom(caminho: string): ConsultorSigerService {
  const config = { get: () => caminho } as unknown as ConfigService;
  const servico = new ConsultorSigerService(config);
  servicosAbertos.push(servico);
  return servico;
}

describe('ConsultorSigerService', () => {
  let pasta: string;
  let caminhoDb: string;

  beforeAll(() => {
    pasta = mkdtempSync(join(tmpdir(), 'consultor-siger-'));
    caminhoDb = join(pasta, 'consultor.db');
    criarBaseFixture(caminhoDb);
  });

  afterAll(() => {
    // No Windows o arquivo aberto não deleta (EPERM) — fecha as conexões antes.
    for (const s of servicosAbertos) s.fechar();
    rmSync(pasta, { recursive: true, force: true });
  });

  it('responde pergunta real com seções, evidências e confiança calculada', () => {
    const r = servicoCom(caminhoDb).pesquisar(
      'Como funciona o faturamento de pedidos?',
    );
    expect(r.disponivel).toBe(true);
    expect(r.aviso).toBeNull();
    // Resumo de módulo: a pergunta cita o sistema Faturamento e o fixture tem 3 grupos de menu.
    expect(r.secoes['resumo']?.[0].texto).toContain(
      'Faturamento é um dos módulos',
    );
    expect(
      r.secoes['configuracoes']?.some((i) => i.texto.includes('mk-dfn')),
    ).toBe(true);
    expect(r.fontes.length).toBeGreaterThan(0);
    expect(r.fontes[0].arquivo).toContain('FIXTURE');
    expect(['alta', 'media']).toContain(r.confianca);
  });

  it('intenção de configuração prioriza parâmetros e a detecção de ação acerta', () => {
    expect(interpretar('O que preciso configurar para emitir NF?').acao).toBe(
      'configuracao',
    );
    expect(interpretar('Por que o sistema bloqueia o pedido?').acao).toBe(
      'diagnostico',
    );
    const r = servicoCom(caminhoDb).pesquisar(
      'quais parâmetros controlam o faturamento?',
    );
    expect(r.secoes['configuracoes']?.length).toBeGreaterThan(0);
  });

  it('instrução interna do programa de menus não aparece como opção de menu', () => {
    const r = servicoCom(caminhoDb).pesquisar('como funciona o faturamento?');
    const menus = [
      ...(r.secoes['telasMenus'] ?? []),
      ...(r.secoes['configuracoes'] ?? []),
    ];
    expect(menus.some((i) => i.texto.includes('3º caractere'))).toBe(false);
  });

  it('pergunta sem lastro na fonte responde "não confirmado", nunca inventa', () => {
    const r = servicoCom(caminhoDb).pesquisar('zzkw qqxy plphm');
    expect(r.confianca).toBe('nao_confirmado');
    expect(r.aviso).toContain('Não foi localizada evidência');
    expect(Object.keys(r.secoes)).toHaveLength(0);
  });

  it('base derivada ausente degrada com aviso claro, sem exceção', () => {
    const r = servicoCom(join(pasta, 'inexistente.db')).pesquisar(
      'faturamento',
    );
    expect(r.disponivel).toBe(false);
    expect(r.aviso).toContain('não está disponível');
    const s = servicoCom(join(pasta, 'inexistente.db')).status();
    expect(s.disponivel).toBe(false);
    expect(s.chunks).toBe(0);
  });

  it('normalizar remove acento e caixa (busca acha "Conversão" por "conversao")', () => {
    expect(normalizar('Conversão de Históricos')).toBe(
      'conversao de historicos',
    );
  });
});
