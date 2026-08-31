import { readFileSync } from 'fs';
import { join } from 'path';
import { INSTANCIAS, VAR_PERFIL, perfilDaInstancia } from './instancia';

/** Qual das duas instâncias este processo é. O front-end monta o menu a partir disto, então
 * errar aqui esconde o sistema inteiro de todo mundo — daí o padrão ser o Painel completo. */
describe('perfil da instância', () => {
  const original = process.env[VAR_PERFIL];
  afterEach(() => {
    if (original === undefined) delete process.env[VAR_PERFIL];
    else process.env[VAR_PERFIL] = original;
  });

  it('sem variável, é o Painel — o padrão seguro é o sistema completo', () => {
    delete process.env[VAR_PERFIL];
    expect(perfilDaInstancia()).toBe('painel');
  });

  it('valor desconhecido também cai no Painel', () => {
    // Um Painel que se acha Portal API esconderia o menu de todos; o inverso é bem mais
    // visível. Entre os dois erros, escolhemos o visível.
    process.env[VAR_PERFIL] = 'portal-de-conexoes';
    expect(perfilDaInstancia()).toBe('painel');
  });

  it('reconhece o Portal API', () => {
    process.env[VAR_PERFIL] = 'portal-api';
    expect(perfilDaInstancia()).toBe('portal-api');
    expect(INSTANCIAS['portal-api'].rotaInicial).toBe('/config/api-dados');
  });

  it('o entrypoint da instância interna se declara Portal API', () => {
    // Sem isto, o Portal API serviria o menu inteiro do Painel — oferecendo portas que não
    // abrem, porque os módulos por trás delas não estão montados lá.
    const fonte = readFileSync(join(__dirname, '..', 'main-dados.ts'), 'utf8');
    expect(fonte).toContain("process.env[VAR_PERFIL] = 'portal-api'");
  });

  it('o Portal API é VIGIADO pelo guardião', () => {
    // Achado real: a instância subiu em 25/08 e caiu durante a noite; ninguém a reergueu,
    // porque o guardião só conhecia o Painel e o docservice. É a MESMA falha de 2026-08-04
    // com o docservice — serviço novo sem vigilância é serviço que some no primeiro
    // reboot, e o sintoma chega como "tela sem dado", sem relação aparente com a causa.
    const vbs = readFileSync(
      join(__dirname, '..', '..', '..', 'Guardiao_Painel_Novo.vbs'),
      'utf8',
    );
    expect(vbs).toContain('MIGRACAO_DADOS_PORT');
    expect(vbs).toContain('Iniciar_Portal_Conexoes.bat');
  });
});
