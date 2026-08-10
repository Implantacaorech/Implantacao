import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Request, Response } from 'express';
import { assetsEstaticos } from './assets-estaticos';

describe('assetsEstaticos', () => {
  let dist: string;
  let next: jest.Mock;
  let status: jest.Mock;
  let sendStatus: jest.Mock;
  let res: Response;

  beforeEach(() => {
    dist = mkdtempSync(join(tmpdir(), 'dist-'));
    writeFileSync(join(dist, 'main-ATUAL.js'), '// build de agora');
    next = jest.fn();
    status = jest.fn().mockReturnThis();
    sendStatus = jest.fn();
    res = {
      status,
      sendStatus,
      type: jest.fn().mockReturnThis(),
      send: jest.fn(),
    } as unknown as Response;
  });

  function req(path: string, method = 'GET'): Request {
    return { path, method } as Request;
  }

  it('404 no chunk que sumiu no rebuild — nunca index.html', () => {
    assetsEstaticos(dist)(req('/chunk-ANTIGO.js'), res, next);
    expect(status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('deixa passar o arquivo de build que existe', () => {
    assetsEstaticos(dist)(req('/main-ATUAL.js'), res, next);
    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it('rota do Angular (sem extensão) continua caindo no fallback de SPA', () => {
    for (const rota of ['/home', '/projetos/5', '/login']) {
      const seguir = jest.fn();
      assetsEstaticos(dist)(req(rota), res, seguir);
      expect(seguir).toHaveBeenCalled();
    }
    expect(status).not.toHaveBeenCalled();
  });

  it('não se mete com a API', () => {
    assetsEstaticos(dist)(req('/api/auth/login', 'POST'), res, next);
    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it('não deixa `..` escapar da pasta do build', () => {
    assetsEstaticos(dist)(req('/../../segredo.json'), res, next);
    expect(sendStatus).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });
});
