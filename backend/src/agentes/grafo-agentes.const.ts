export type CategoriaAgente = 'negocio' | 'software';

export interface NoAgente {
  id: string;
  categoria: CategoriaAgente;
  rotulo: string;
}

export interface ArestaAgente {
  de: string;
  para: string;
  // Relação real, extraída do texto de cada `.claude/agents/*.md` (seção "Como agir"/"NÃO
  // é seu") — não é um layout gráfico inventado.
  relacao: string;
}

/** Os 13 agentes reais definidos em `.claude/agents/` (2026-07-19) e as relações
 * documentadas entre eles. Estático de propósito — a topologia não muda a cada execução,
 * só quem está "ativo" agora (isso vem de `agente_execucoes`, ver `AgentesService.grafo`). */
export const NOS_AGENTES: NoAgente[] = [
  {
    id: 'coordenador-implantacao',
    categoria: 'negocio',
    rotulo: 'Coordenador Implantação',
  },
  { id: 'setor-adm', categoria: 'negocio', rotulo: 'Setor Adm' },
  {
    id: 'consultor-implantacao',
    categoria: 'negocio',
    rotulo: 'Consultor (GCI)',
  },
  { id: 'gerente-projeto', categoria: 'negocio', rotulo: 'Gerente do Projeto' },
  {
    id: 'equipe-conversao',
    categoria: 'negocio',
    rotulo: 'Equipe de Conversão',
  },
  { id: 'gestao-mudanca', categoria: 'negocio', rotulo: 'Gestão da Mudança' },
  {
    id: 'controle-pendencias',
    categoria: 'negocio',
    rotulo: 'Controle de Pendências',
  },
  { id: 'painel-core', categoria: 'software', rotulo: 'Painel-Core' },
  { id: 'qualidade', categoria: 'software', rotulo: 'Qualidade' },
  {
    id: 'documentos-geracao',
    categoria: 'software',
    rotulo: 'Documentos & Geração',
  },
  {
    id: 'integracoes-operacao',
    categoria: 'software',
    rotulo: 'Integrações & Operação',
  },
  {
    id: 'documentacao-contexto',
    categoria: 'software',
    rotulo: 'Documentação & Contexto',
  },
  {
    id: 'seguranca-permissoes',
    categoria: 'software',
    rotulo: 'Segurança & Permissões',
  },
];

export const ARESTAS_AGENTES: ArestaAgente[] = [
  {
    de: 'painel-core',
    para: 'qualidade',
    relacao: 'aciona ao terminar (suíte + revisão antes do push)',
  },
  {
    de: 'documentos-geracao',
    para: 'qualidade',
    relacao: 'aciona ao terminar',
  },
  {
    de: 'integracoes-operacao',
    para: 'qualidade',
    relacao: 'aciona se a mudança tocar código',
  },
  {
    de: 'integracoes-operacao',
    para: 'seguranca-permissoes',
    relacao: 'aciona se envolver segredos/exposição',
  },
  {
    de: 'seguranca-permissoes',
    para: 'qualidade',
    relacao: 'devolve para validar a correção',
  },
  {
    de: 'painel-core',
    para: 'documentos-geracao',
    relacao: 'encaminha geração fiel de documentos',
  },
  {
    de: 'painel-core',
    para: 'integracoes-operacao',
    relacao: 'encaminha e-mail/disponibilidade/infra',
  },
  {
    de: 'painel-core',
    para: 'seguranca-permissoes',
    relacao: 'encaminha permissões/segredos aprofundados',
  },
  {
    de: 'documentacao-contexto',
    para: 'painel-core',
    relacao: 'documenta como passo final, sob demanda',
  },
  {
    de: 'documentacao-contexto',
    para: 'documentos-geracao',
    relacao: 'documenta como passo final, sob demanda',
  },
  {
    de: 'documentacao-contexto',
    para: 'integracoes-operacao',
    relacao: 'documenta como passo final, sob demanda',
  },
  {
    de: 'coordenador-implantacao',
    para: 'setor-adm',
    relacao: 'designa/aciona abertura de RNS',
  },
  {
    de: 'coordenador-implantacao',
    para: 'consultor-implantacao',
    relacao: 'designa para levantamento/implantação',
  },
  {
    de: 'setor-adm',
    para: 'consultor-implantacao',
    relacao: 'prepara documentos que o consultor executa',
  },
  {
    de: 'consultor-implantacao',
    para: 'equipe-conversao',
    relacao: 'encaminha RNS de conversão refinada',
  },
  {
    de: 'consultor-implantacao',
    para: 'gerente-projeto',
    relacao: 'reporta data de uso oficial/encerramento',
  },
  {
    de: 'gestao-mudanca',
    para: 'consultor-implantacao',
    relacao: 'transversal — apoia toda a implantação',
  },
  {
    de: 'controle-pendencias',
    para: 'coordenador-implantacao',
    relacao: 'registra/consulta pendências em aberto',
  },
];
