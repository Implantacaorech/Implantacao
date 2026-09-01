// Espelha webapp/fluxo.py:_LABELS — rótulo normalizado -> campo interno do parser.
export const LABELS: Array<[string[], string]> = [
  [['cliente', 'razao social'], 'cliente'],
  [['cnpj'], 'cnpj'],
  [['ramo'], 'ramo'],
  [['cidade', 'cidade/uf', 'localizacao', 'cidade / uf'], 'cidade'],
  [['contato', 'contato (nome)', 'nome do contato'], 'contatoNome'],
  [
    ['e-mail do contato', 'email do contato', 'e-mail', 'email'],
    'contatoEmail',
  ],
  [['telefone', 'fone', 'celular'], 'contatoTel'],
  [
    [
      'no da proposta/projeto',
      'no proposta',
      'no projeto',
      'no da proposta',
      'proposta',
      'numero do projeto',
      'projeto',
      'no',
    ],
    'numeroProjeto',
  ],
  [
    ['modulos contratados', 'modulos contratados (siglas)', 'modulos'],
    'modulos',
  ],
  [['horas cobradas', 'horas contratadas'], 'horasCobradas'],
  [['horas bonificadas', 'bonificadas'], 'horasBonificadas'],
  [
    [
      'produto / observacoes',
      'produto/observacoes',
      'produto',
      'observacoes',
      'obs',
    ],
    'observacoes',
  ],
];

// Espelha webapp/fluxo.py:MODELO_FECHAMENTO — instrução exibida ao Comercial para
// formatar o e-mail de fechamento (não é enviado pelo sistema, só exibido na tela).
export const MODELO_FECHAMENTO = `Assunto: [IMPLANTAÇÃO] Fechamento - <Razão Social>

Cliente (Razão Social):
CNPJ:
Ramo:
Cidade/UF:
Contato (nome):
E-mail do contato:
Telefone:
Nº da proposta/projeto:
Módulos contratados (siglas):
Horas cobradas:
Horas bonificadas:
Produto / Observações:
`;
