import { Request, Response } from 'express';
import {
  CABECALHO_REQUEST_ID,
  correlacaoMiddleware,
  requestIdAtual,
} from './correlacao';

/** Roda o middleware com os cabeçalhos dados e captura o id visto DENTRO do contexto e o que
 * foi ecoado na resposta. */
function rodar(headers: Record<string, string>): {
  dentro: string;
  ecoado: string;
} {
  const req = { headers } as unknown as Request;
  const ecoados: Record<string, string> = {};
  const res = {
    setHeader: (k: string, v: string) => {
      ecoados[k] = v;
    },
  } as unknown as Response;
  let dentro = '';
  correlacaoMiddleware(req, res, () => {
    dentro = requestIdAtual();
  });
  return { dentro, ecoado: ecoados[CABECALHO_REQUEST_ID] };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('correlacao (M9)', () => {
  it('fora de um request, requestIdAtual é vazio', () => {
    expect(requestIdAtual()).toBe('');
  });

  it('gera um id quando não vem nenhum e o ecoa na resposta', () => {
    const { dentro, ecoado } = rodar({});
    expect(dentro).toMatch(UUID);
    expect(ecoado).toBe(dentro);
  });

  it('aceita um id de entrada são e o propaga', () => {
    const { dentro, ecoado } = rodar({ 'x-request-id': 'abc-123_XY.7' });
    expect(dentro).toBe('abc-123_XY.7');
    expect(ecoado).toBe('abc-123_XY.7');
  });

  it('recusa um id de entrada inválido (com espaço) e gera outro', () => {
    const { dentro } = rodar({ 'x-request-id': 'nao vale espaco' });
    expect(dentro).not.toContain(' ');
    expect(dentro).toMatch(UUID);
  });

  it('recusa um id gigante (evita valor descontrolado como id)', () => {
    const { dentro } = rodar({ 'x-request-id': 'a'.repeat(200) });
    expect(dentro).toMatch(UUID);
  });

  it('cada request tem o seu id (não vaza entre contextos)', () => {
    const a = rodar({ 'x-request-id': 'aaa' });
    const b = rodar({ 'x-request-id': 'bbb' });
    expect(a.dentro).toBe('aaa');
    expect(b.dentro).toBe('bbb');
    // Fora dos dois, volta a ser vazio.
    expect(requestIdAtual()).toBe('');
  });
});
