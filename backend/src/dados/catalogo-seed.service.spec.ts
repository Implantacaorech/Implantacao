import { ConsultaBdService } from './consulta-bd.service';
import { CATALOGO } from './catalogo/catalogo';
import { CatalogoSeedService } from './catalogo-seed.service';

/** Slugs que o catálogo declara como editáveis — a semeadura tem de cobrir exatamente
 * esses, nem mais nem menos. Derivado do catálogo, nunca digitado à mão. */
const SLUGS_EDITAVEIS = [
  ...new Set(
    CATALOGO.filter((c) => c.origem.tipo === 'consulta_salva').map(
      (c) => (c.origem as { slug: string }).slug,
    ),
  ),
];

function montar(existentes: string[] = []) {
  const porSlug = jest
    .fn()
    .mockImplementation((slug: string) =>
      Promise.resolve(
        existentes.includes(slug) ? { slug, sql: 'já existe' } : null,
      ),
    );
  const salvar = jest.fn().mockResolvedValue(null);
  const consultas = { porSlug, salvar } as unknown as ConsultaBdService;
  return { servico: new CatalogoSeedService(consultas), porSlug, salvar };
}

/** A semeadura passou a ser DERIVADA do catálogo (fase 1 do ADR-0003): antes cada módulo
 * semeava a sua, e a lista que o Administrador via em Consultas BD dependia de quais
 * módulos tinham subido. */
describe('CatalogoSeedService', () => {
  it('semeia exatamente as consultas editáveis do catálogo', async () => {
    const { servico, salvar } = montar();
    const criadas = await servico.semear();

    expect(criadas).toBe(SLUGS_EDITAVEIS.length);
    const semeados = salvar.mock.calls.map((c) => c[0] as string).sort();
    expect(semeados).toEqual([...SLUGS_EDITAVEIS].sort());
  });

  it('não semeia o mesmo slug duas vezes, mesmo com duas entradas apontando para ele', async () => {
    // `sicla.rns.listar` e `sicla.rns.detalhar` compartilham `rns_lista_itemped`.
    const { servico, salvar } = montar();
    await servico.semear();
    const rns = salvar.mock.calls.filter((c) => c[0] === 'rns_lista_itemped');
    expect(rns).toHaveLength(1);
  });

  it('NUNCA sobrescreve um slug que já existe — o texto do ADM é a verdade em produção', async () => {
    const { servico, salvar, porSlug } = montar(SLUGS_EDITAVEIS);
    const criadas = await servico.semear();
    expect(criadas).toBe(0);
    expect(salvar).not.toHaveBeenCalled();
    expect(porSlug).toHaveBeenCalledTimes(SLUGS_EDITAVEIS.length);
  });

  it('semeia com o SQL e os metadados de tela declarados no catálogo', async () => {
    const { servico, salvar } = montar();
    await servico.semear();

    const [, dados] = salvar.mock.calls.find(
      (c) => c[0] === 'previsao_inicio_oficial',
    ) as [string, Record<string, unknown>];
    expect(dados).toMatchObject({
      nome: 'Previsão Início Oficial',
      ordem: 1,
      mostrarGrafico: true,
      colunaData: 'PREVISAO_INICIO_OFICIAL',
      colunaSituacao: 'SITUACAO',
      conexao: 'sicla',
    });
    expect(dados.sql as string).toContain('POWERBI_IMP_RNIMPLANTACAO_2');
  });

  it('a consulta do Portal é semeada com conexao=portal — senão o Testar roda no Oracle', () => {
    const visitas = CATALOGO.find((c) => c.nome === 'portal.visitas.listar');
    const origem = visitas?.origem as { semente: { conexao?: string } };
    // `portal` é o vocabulário da TELA (coluna `conexao` de consultas_bd), mais antigo que
    // o `portal_rech` do catálogo — a divergência é proposital e está documentada no tipo.
    expect(origem.semente.conexao).toBe('portal');
  });

  it('o boot não quebra se a semeadura falhar', async () => {
    const { servico } = montar();
    jest
      .spyOn(servico, 'semear')
      .mockRejectedValue(new Error('banco indisponível'));
    const nodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      // Semear é conveniência de primeira subida: uma falha aqui não pode derrubar o
      // processo — as consultas `fixo` continuam funcionando.
      await expect(servico.onModuleInit()).resolves.toBeUndefined();
    } finally {
      process.env.NODE_ENV = nodeEnv;
    }
  });

  it('não semeia em ambiente de teste', async () => {
    const { servico, salvar } = montar();
    await servico.onModuleInit();
    expect(salvar).not.toHaveBeenCalled();
  });
});
