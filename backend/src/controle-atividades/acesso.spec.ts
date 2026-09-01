import {
  ContextoAcesso,
  cartaoVisivel,
  listaVisivel,
  nasceCompartilhado,
  podeCriarCartao,
  podeDesignarMembro,
  podeEditarQuadro,
  podeInteragirCartao,
  podeLerQuadro,
  podeMoverPara,
  recorteDeCliente,
} from './acesso';

/** As regras de acesso são a superfície onde um engano não dá erro — dá vazamento. Por isso
 * este arquivo cobre as combinações, e não só o caminho feliz. */

const ctx = (over: Partial<ContextoAcesso> = {}): ContextoAcesso => ({
  interno: true,
  codigosCliente: [],
  responsavel: false,
  podeAlterar: true,
  ...over,
});

const RESPONSAVEL = ctx({ responsavel: true });
const CONSULTA = ctx({ responsavel: false });
const CLIENTE = ctx({
  interno: false,
  codigosCliente: ['10482'],
  responsavel: false,
});

describe('acesso do Controle de Atividades', () => {
  describe('leitura de quadro', () => {
    it('interno lê o quadro de QUALQUER cliente — a fronteira é Rech x cliente', () => {
      expect(podeLerQuadro(RESPONSAVEL, '10482')).toBe(true);
      expect(podeLerQuadro(CONSULTA, '99999')).toBe(true);
    });

    it('usuário-cliente lê só os códigos a que está vinculado', () => {
      expect(podeLerQuadro(CLIENTE, '10482')).toBe(true);
      expect(podeLerQuadro(CLIENTE, '20913')).toBe(false);
    });

    it('cliente sem nenhum código não lê nada (fail-closed)', () => {
      const semVinculo = ctx({ interno: false, codigosCliente: [] });
      expect(podeLerQuadro(semVinculo, '10482')).toBe(false);
    });
  });

  describe('escrita', () => {
    it('só o responsável interno edita a estrutura do quadro', () => {
      expect(podeEditarQuadro(RESPONSAVEL)).toBe(true);
      expect(podeEditarQuadro(CONSULTA)).toBe(false);
      expect(podeEditarQuadro(CLIENTE)).toBe(false);
    });

    it('nível de menu sem alteração derruba qualquer escrita', () => {
      expect(
        podeEditarQuadro(ctx({ responsavel: true, podeAlterar: false })),
      ).toBe(false);
      expect(
        podeInteragirCartao(ctx({ interno: false, podeAlterar: false })),
      ).toBe(false);
    });

    it('interno NÃO responsável fica em consulta estrita — nem comentar', () => {
      expect(podeInteragirCartao(CONSULTA)).toBe(false);
    });

    it('cliente interage com o que alcança', () => {
      expect(podeInteragirCartao(CLIENTE)).toBe(true);
    });
  });

  describe('criação de cartão', () => {
    it('o cliente PODE abrir solicitação (decisão do usuário, 2026-09-01)', () => {
      expect(podeCriarCartao(CLIENTE)).toBe(true);
    });

    it('o interno precisa ser responsável para criar', () => {
      expect(podeCriarCartao(RESPONSAVEL)).toBe(true);
      expect(podeCriarCartao(CONSULTA)).toBe(false);
    });

    it('cartão da Rech nasce fechado; do cliente, compartilhado', () => {
      expect(nasceCompartilhado(RESPONSAVEL)).toBe(false);
      expect(nasceCompartilhado(CLIENTE)).toBe(true);
    });
  });

  describe('designação de membro', () => {
    it('o cliente designa APENAS consultor da Rech', () => {
      expect(podeDesignarMembro(CLIENTE, 'interno')).toBe(true);
      expect(podeDesignarMembro(CLIENTE, 'cliente')).toBe(false);
    });

    it('o responsável interno designa os dois lados', () => {
      expect(podeDesignarMembro(RESPONSAVEL, 'interno')).toBe(true);
      expect(podeDesignarMembro(RESPONSAVEL, 'cliente')).toBe(true);
    });

    it('quem está em consulta não designa ninguém', () => {
      expect(podeDesignarMembro(CONSULTA, 'interno')).toBe(false);
    });
  });

  describe('visibilidade de coluna e cartão', () => {
    const aberta = { visivelCliente: true };
    const interna = { visivelCliente: false };

    it('o interno vê coluna e cartão internos', () => {
      expect(listaVisivel(CONSULTA, interna)).toBe(true);
      expect(cartaoVisivel(CONSULTA, { visivelCliente: false }, interna)).toBe(
        true,
      );
    });

    it('o cliente não vê coluna interna', () => {
      expect(listaVisivel(CLIENTE, interna)).toBe(false);
      expect(listaVisivel(CLIENTE, aberta)).toBe(true);
    });

    it('o cliente precisa das DUAS condições — cartão E coluna compartilhados', () => {
      expect(cartaoVisivel(CLIENTE, { visivelCliente: true }, aberta)).toBe(
        true,
      );
      expect(cartaoVisivel(CLIENTE, { visivelCliente: true }, interna)).toBe(
        false,
      );
      expect(cartaoVisivel(CLIENTE, { visivelCliente: false }, aberta)).toBe(
        false,
      );
      expect(cartaoVisivel(CLIENTE, { visivelCliente: false }, interna)).toBe(
        false,
      );
    });

    it('cartão sem coluna resolvida não vaza para o cliente', () => {
      expect(cartaoVisivel(CLIENTE, { visivelCliente: true }, undefined)).toBe(
        false,
      );
    });
  });

  describe('destino do arraste', () => {
    it('o cliente não empurra cartão para dentro do bastidor da Rech', () => {
      expect(podeMoverPara(CLIENTE, { visivelCliente: false })).toBe(false);
      expect(podeMoverPara(CLIENTE, { visivelCliente: true })).toBe(true);
    });

    it('o responsável interno move para qualquer coluna', () => {
      expect(podeMoverPara(RESPONSAVEL, { visivelCliente: false })).toBe(true);
    });

    it('quem está em consulta não move nada', () => {
      expect(podeMoverPara(CONSULTA, { visivelCliente: true })).toBe(false);
    });
  });

  it('o recorte por cliente vale para quem não é interno', () => {
    expect(recorteDeCliente(CLIENTE)).toBe(true);
    expect(recorteDeCliente(RESPONSAVEL)).toBe(false);
  });
});
