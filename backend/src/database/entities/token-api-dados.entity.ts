import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Token que o **Portal Implantação** usa para consultar o **Portal API** (instância
 * interna), pelo túnel. É o lado CONSUMIDOR do desenho de duas instâncias.
 *
 * O espelho de `api_clientes`, com um detalhe que os separa: lá a chave é guardada só como
 * **hash** (o Portal API só precisa *conferir* a chave que chega); aqui ela é guardada
 * **inteira**, porque este lado precisa *enviá-la* a cada consulta. Não há como contornar
 * isso — um segredo que se apresenta não pode ser de mão única.
 *
 * A consequência está assumida e é o ponto do desenho: o que vaza numa invasão à instância
 * publicada é este token, e ele vale **exatamente as consultas listadas em `consultas`** —
 * não a credencial do Oracle, que nunca sai da rede interna. Revogar é um clique no Portal
 * API, sem tocar no banco.
 *
 * `consultas` não é digitada: vem do próprio Portal API no "Testar" — o catálogo que ele
 * devolve para um token já vem recortado pelo que aquele token autoriza. */
@Entity({ name: 'api_dados_tokens' })
export class TokenApiDados {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 160, default: '' })
  nome: string;

  /** Base do Portal API, sem `/api` (ex.: `http://I7M1700-01-EVE:5110`). Fica no token, e
   * não numa variável de ambiente, porque nada impede que dois tokens venham de instâncias
   * diferentes — e porque trocar o endereço não pode exigir redeploy. */
  @Column({ length: 300, default: '' })
  url: string;

  /** A chave em claro (`rd_<prefixo>_<segredo>`). Nunca volta ao navegador: as respostas
   * levam só o prefixo. */
  @Column({ type: 'text' })
  chave: string;

  /** Nomes de consulta que este token autoriza, separados por vírgula — descobertos no
   * "Testar", não digitados. */
  @Column({ type: 'text' })
  consultas: string;

  @Column({ default: true })
  ativo: boolean;

  @Column({ length: 255, default: '' })
  observacao: string;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @Column({ name: 'ultimo_uso_em', type: 'datetime', nullable: true })
  ultimoUsoEm: Date | null;

  /** Última falha ao usar este token. Responde "por que a tela ficou sem dado?" sem obrigar
   * ninguém a abrir log — token revogado do outro lado é o caso comum. */
  @Column({ name: 'ultimo_erro', type: 'text', nullable: true })
  ultimoErro: string | null;
}
