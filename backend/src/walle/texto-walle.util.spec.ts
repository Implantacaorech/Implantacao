import {
  classificar,
  decodificarTexto,
  detectarOrigem,
  extrairAssuntos,
  extrairEntidades,
  extrairResumo,
  extrairTitulo,
  normalizar,
} from './texto-walle.util';

/** As funções puras de extração são a "inteligência" determinística do módulo Wall-e —
 * cada heurística documentada aqui é o contrato que a indexação e a busca assumem. */
describe('texto-walle.util', () => {
  describe('normalizar', () => {
    it('remove acento e caixa — pergunta com/sem acento acha o mesmo documento', () => {
      expect(normalizar('Integração côm Análise')).toBe('integracao com analise');
    });
  });

  describe('decodificarTexto', () => {
    it('mantém UTF-8 válido', () => {
      expect(decodificarTexto(Buffer.from('integração', 'utf8'))).toBe('integração');
    });
    it('redecodifica latin1 quando o UTF-8 vem crivado de U+FFFD', () => {
      const latino = Buffer.from('não existe configuração', 'latin1');
      expect(decodificarTexto(latino)).toContain('não existe');
    });
  });

  describe('extrairTitulo', () => {
    it('usa o primeiro H1 do markdown', () => {
      expect(extrairTitulo('# Há robô na rotina?\n\ntexto', 'x.md', 'md')).toBe(
        'Há robô na rotina?',
      );
    });
    it('usa o primeiro comentário com letras do SQL (pula separadores)', () => {
      const sql = '-- ============\n-- Mover movimentos da Ficha 322037\nSELECT 1;';
      expect(extrairTitulo(sql, 'mover.sql', 'sql')).toBe(
        'Mover movimentos da Ficha 322037',
      );
    });
    it('embeleza o nome do arquivo quando não há título no conteúdo', () => {
      expect(extrairTitulo('', 'robo-integracao-whatsapp.md', 'md')).toBe(
        'robo integracao whatsapp',
      );
    });
  });

  describe('extrairResumo', () => {
    it('pega o primeiro parágrafo útil do markdown, fora de heading/código/tabela', () => {
      const md = '# Título\n\n```sql\nSELECT 1;\n```\n\n**Resposta curta: sim.**\nContinua.\n\nOutro parágrafo.';
      const resumo = extrairResumo(md, 'md');
      expect(resumo).toContain('Resposta curta: sim.');
      expect(resumo).not.toContain('SELECT 1');
      expect(resumo).not.toContain('Outro parágrafo');
    });
  });

  describe('classificar', () => {
    it('extensões decidem primeiro: sql/log/imagem', () => {
      expect(classificar('a.sql', 'sql', '')).toBe('sql');
      expect(classificar('a.log', 'log', '')).toBe('log');
      expect(classificar('a.jpg', 'jpg', '')).toBe('imagem');
    });
    it('markdown com "causa raiz" vence a classificação genérica', () => {
      expect(classificar('analise-853-porque-carimbou.md', 'md', 'texto')).toBe('causa-raiz');
    });
    it('estatística e investigação são reconhecidas', () => {
      expect(classificar('estatistica-interacao.md', 'md', '')).toBe('estatistica');
      expect(classificar('x.md', 'md', '# Há robô na rotina de integração?')).toBe(
        'investigacao',
      );
    });
    it('markdown sem sinal específico cai em análise', () => {
      expect(classificar('doc.md', 'md', 'conteúdo qualquer')).toBe('analise');
    });
  });

  describe('detectarOrigem', () => {
    it('log e imagem são insumo; md/sql são entrega do bot', () => {
      expect(detectarOrigem('log', '')).toBe('insumo');
      expect(detectarOrigem('jpg', '')).toBe('insumo');
      expect(detectarOrigem('md', 'análise')).toBe('produzido');
      expect(detectarOrigem('sql', '-- move')).toBe('produzido');
    });
    it('assinatura do bot confirma "produzido"', () => {
      expect(detectarOrigem('md', 'Elaborado por Wall-e (técnico 900)')).toBe('produzido');
    });
    it('extensão desconhecida fica indeterminado', () => {
      expect(detectarOrigem('bin', '')).toBe('indeterminado');
    });
  });

  describe('extrairEntidades', () => {
    it('extrai RNS completa e citada, Ficha, tabela, repositório, erro e cliente', () => {
      const texto =
        'A RNS 563996-1 gerou a Ficha 324397. O ri-wall-e lê a FILA_WALLE e o ITEMPED; ' +
        'erro ORA-01400 no cliente 4070. Repo: gitlab.rech.com.br/gitlab/rech/delphi/riconcha.';
      const e = extrairEntidades(texto);
      const chaves = e.map((x) => `${x.tipo}:${x.valor}`);
      expect(chaves).toContain('rns:563996-1');
      expect(chaves).toContain('ficha:324397');
      expect(chaves).toContain('tabela:FILA_WALLE');
      expect(chaves).toContain('tabela:ITEMPED');
      expect(chaves).toContain('repositorio:ri-wall-e');
      expect(chaves).toContain('repositorio:riconcha');
      expect(chaves).toContain('erro:ORA-01400');
      expect(chaves).toContain('cliente:4070');
    });
    it('não confunde palavra-chave SQL maiúscula com tabela', () => {
      const e = extrairEntidades('SELECT * FROM X WHERE TO_DATE(A) ORDER BY B');
      expect(e.filter((x) => x.tipo === 'tabela')).toHaveLength(0);
    });
    it('reconhece tecnologia por palavra inteira, sem acento', () => {
      const e = extrairEntidades('Integração com WhatsApp via webhook em Node');
      const tecs = e.filter((x) => x.tipo === 'tecnologia').map((x) => x.valor);
      expect(tecs).toEqual(expect.arrayContaining(['whatsapp', 'webhook', 'node']));
    });
  });

  describe('extrairAssuntos', () => {
    it('junta vocabulário do domínio, tecnologias e palavras do título', () => {
      const entidades = extrairEntidades('bot no WhatsApp');
      const assuntos = extrairAssuntos(
        'Integração com WhatsApp',
        'Análise da automação do robô.',
        entidades,
      );
      expect(assuntos).toEqual(
        expect.arrayContaining(['integracao', 'whatsapp', 'automacao']),
      );
      expect(assuntos).not.toContain('com'); // stopword não vira assunto
    });
  });
});
