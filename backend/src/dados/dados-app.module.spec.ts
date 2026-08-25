import { readFileSync } from 'fs';
import { join } from 'path';

/** CATRACA DA SUPERFÍCIE DA INSTÂNCIA 1 (Portal de Conexões).
 *
 * Este é o processo que fica na rede interna **com a credencial do banco**. O que protege o
 * banco não é o código do módulo de dados — é o fato de mais nada estar exposto na porta em
 * que essa credencial vive. Essa propriedade não se mantém sozinha: basta alguém precisar
 * de "só mais um endpoint" no Portal de Conexões e acrescentar um import.
 *
 * Por isso o teste lê o CÓDIGO-FONTE em vez de instanciar o módulo: instanciar provaria que
 * ele sobe; ler prova o que ele **não** tem. */
const ARQ_MODULO = join(__dirname, 'dados-app.module.ts');
const ARQ_MAIN = join(__dirname, '..', 'main-dados.ts');

/** Os únicos módulos que a instância 1 pode montar, cada um com o motivo de estar aqui.
 * Acrescentar item é decisão de arquitetura: cada módulo é rota exposta na máquina que tem
 * a senha do banco. */
const PERMITIDOS: Record<string, string> = {
  ConfigModule: 'configuração (env)',
  ThrottlerModule:
    'rate limit — a instância fica atrás do túnel, não sem defesa',
  ServeStaticModule: 'serve o build do Angular para a tela de administração',
  DatabaseModule: 'painel_novo: clientes de API, consultas salvas, usuários',
  AuthModule: 'login de PESSOA — quem administra não é cliente de máquina',
  UsersModule: 'identidade do administrador',
  PermissoesModule:
    'gate por menu do usuário do Painel (@Global, exigido pelo guard)',
  HealthModule: '/api/health — o que o túnel e o guardião consultam',
  DadosModule: 'a API de Dados em si: o motivo da instância existir',
};

function importados(fonte: string): string[] {
  const bloco = /@Module\(\{[\s\S]*?imports:\s*\[([\s\S]*?)\n {2}\],/.exec(
    fonte,
  );
  if (!bloco) throw new Error('Não achei o bloco `imports` de DadosAppModule.');
  const nomes = bloco[1].match(/\b[A-Z][A-Za-z0-9]*Module\b/g) ?? [];
  return [...new Set(nomes)];
}

describe('Portal de Conexões — superfície da instância 1', () => {
  const fonte = readFileSync(ARQ_MODULO, 'utf8');

  it('monta SÓ os módulos da lista — nenhum módulo de negócio', () => {
    const extras = importados(fonte).filter((m) => !(m in PERMITIDOS));
    expect(extras).toEqual([]);
  });

  it('a lista de permitidos não cresce em silêncio', () => {
    // Se este número mudar, alguém ampliou a superfície da máquina que tem a credencial —
    // e precisa dizer por quê no PR, não só ajustar o teste.
    expect(Object.keys(PERMITIDOS)).toHaveLength(9);
  });

  it('não sobe o AppModule inteiro por atalho', () => {
    // O erro fácil: "é mais rápido subir o Painel todo numa porta e só publicar /dados".
    // Isso devolveria à instância interna TODA a API do Painel.
    const main = readFileSync(ARQ_MAIN, 'utf8');
    expect(main).not.toMatch(/from '\.\/app\.module'/);
    expect(main).toContain('DadosAppModule');
  });

  it('usa porta própria — nunca a 5100 do Painel', () => {
    // Compartilhar a porta significaria compartilhar o processo, que é justamente o que a
    // separação evita.
    const main = readFileSync(ARQ_MAIN, 'utf8');
    expect(main).toContain('MIGRACAO_DADOS_PORT');
    const padrao = /const PORTA_PADRAO = (\d+);/.exec(main)?.[1];
    expect(padrao).toBeDefined();
    expect(padrao).not.toBe('5100');
  });
});
