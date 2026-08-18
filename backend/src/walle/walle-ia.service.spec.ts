import { SEM_EVIDENCIA, WalleIaService } from './walle-ia.service';

/** Síntese por IA do módulo Wall-e — o que se cobra aqui é a DEGRADAÇÃO (§21-A.8) e o
 * anti-invenção (§28): sem documento relevante devolve a frase-contrato; sem provedor
 * configurado devolve as fontes; com provedor, chama a finalidade `walle` (só-local). */
describe('WalleIaService', () => {
  const doc = {
    id: 7,
    chatCodigo: 42,
    titulo: 'Investigação WhatsApp',
    caminhoRelativo: '42/robo.md',
    conteudo: 'Há um robô: RNS 563996-1.',
  };
  const resultadoBusca = (itens: Array<{ arquivoId: number }>) => ({
    resumo: '',
    total: itens.length,
    resultados: itens,
    assuntosRelacionados: [],
    tambemPodeSerUtil: [],
    sqlsRelacionados: [],
    sugestoes: [],
    cobertura: '',
  });

  function montar(opts: {
    resultados: Array<{ arquivoId: number }>;
    iaDisponivel: boolean;
    respostaIa?: string;
  }) {
    const ia = {
      disponivel: jest.fn(() => opts.iaDisponivel),
      completar: jest.fn(async () => opts.respostaIa ?? 'Resposta direta: sim [1].'),
    };
    const busca = {
      pesquisar: jest.fn(async () => resultadoBusca(opts.resultados)),
    };
    const arquivos = {
      porId: jest.fn(async (id: number) => (id === doc.id ? doc : null)),
    };
    return {
      servico: new WalleIaService(ia as never, busca as never, arquivos as never),
      ia,
    };
  }

  it('sem documento relevante: devolve a frase-contrato de falta de evidência', async () => {
    const { servico, ia } = montar({ resultados: [], iaDisponivel: true });
    const r = await servico.perguntar('algo inexistente');
    expect(r.resposta).toBe(SEM_EVIDENCIA);
    expect(r.temFundamento).toBe(false);
    expect(ia.completar).not.toHaveBeenCalled();
  });

  it('IA não configurada: degrada para busca-guiada com as fontes (nunca falha)', async () => {
    const { servico, ia } = montar({
      resultados: [{ arquivoId: doc.id }],
      iaDisponivel: false,
    });
    const r = await servico.perguntar('robô no whatsapp?');
    expect(r.iaDisponivel).toBe(false);
    expect(r.temFundamento).toBe(true);
    expect(r.fontes).toHaveLength(1);
    expect(r.fontes[0].caminhoRelativo).toBe('42/robo.md');
    expect(ia.completar).not.toHaveBeenCalled();
  });

  it('com IA: chama a finalidade walle (só-local) com as fontes numeradas no contexto', async () => {
    const { servico, ia } = montar({
      resultados: [{ arquivoId: doc.id }],
      iaDisponivel: true,
    });
    const r = await servico.perguntar('robô no whatsapp?', 'gci@rech.com.br');
    expect(r.temFundamento).toBe(true);
    expect(ia.completar).toHaveBeenCalledWith(
      'walle',
      expect.objectContaining({
        messages: [
          expect.objectContaining({
            content: expect.stringContaining('[1] Investigação WhatsApp'),
          }),
        ],
      }),
      expect.objectContaining({ solicitante: 'gci@rech.com.br' }),
    );
  });

  it('resposta da IA começando com a frase-contrato marca temFundamento=false', async () => {
    const { servico } = montar({
      resultados: [{ arquivoId: doc.id }],
      iaDisponivel: true,
      respostaIa: `${SEM_EVIDENCIA} Assuntos próximos: integração.`,
    });
    const r = await servico.perguntar('outra coisa');
    expect(r.temFundamento).toBe(false);
  });
});
