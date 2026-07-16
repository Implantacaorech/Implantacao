import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FluxoService } from '../../core/services/fluxo.service';
import { CamposFechamento, EstadoFluxoConfirmar, ResultadoCriarFluxo } from '../../core/models/fluxo.model';

@Component({
  selector: 'app-fluxo-confirmar',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './fluxo-confirmar.component.html',
  styleUrl: './fluxo-confirmar.component.css',
})
export class FluxoConfirmarComponent {
  private readonly service = inject(FluxoService);
  private readonly router = inject(Router);

  readonly fonte = signal('');
  readonly assunto = signal<string | undefined>(undefined);
  readonly semOrigem = signal(false);
  readonly enviando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly resultado = signal<ResultadoCriarFluxo | null>(null);

  cliente = '';
  cnpj = '';
  ramo = '';
  numeroProjeto = '';
  numeroProposta = '';
  contatoNome = '';
  contatoEmail = '';
  contatoTel = '';
  contatos = '';
  modulos = '';
  horasCobradas = '';
  horasBonificadas = '';
  dataLevantamento = '';
  dataUsoOficial = '';
  observacoes = '';
  consultor = '';
  tecnicos = '';
  emailsResponsaveis = '';
  gerarLevantamento = true;
  gerarCronograma = true;

  constructor() {
    const estado = history.state as EstadoFluxoConfirmar | undefined;
    if (!estado?.campos) {
      this.semOrigem.set(true);
      return;
    }
    this.fonte.set(estado.fonte);
    this.assunto.set(estado.assunto);
    this.preencher(estado.campos);
  }

  private preencher(c: CamposFechamento): void {
    this.cliente = c.cliente || '';
    this.cnpj = c.cnpj || '';
    this.ramo = c.ramo || '';
    this.numeroProjeto = c.numeroProjeto || '';
    this.contatoNome = c.contatoNome || '';
    this.contatoEmail = c.contatoEmail || '';
    this.contatoTel = c.contatoTel || '';
    this.modulos = c.modulos || '';
    this.horasCobradas = c.horasCobradas || '';
    this.horasBonificadas = c.horasBonificadas || '';
    this.observacoes = c.observacoes || '';
  }

  async criar(): Promise<void> {
    this.enviando.set(true);
    this.erro.set(null);
    try {
      const gerar: string[] = [];
      if (this.gerarLevantamento) gerar.push('levantamento');
      if (this.gerarCronograma) gerar.push('cronograma');
      const r = await this.service.criar({
        cliente: this.cliente,
        cnpj: this.cnpj,
        ramo: this.ramo,
        numeroProjeto: this.numeroProjeto,
        numeroProposta: this.numeroProposta,
        contatoNome: this.contatoNome,
        contatoEmail: this.contatoEmail,
        contatoTel: this.contatoTel,
        contatos: this.contatos,
        modulos: this.modulos,
        horasCobradas: this.horasCobradas,
        horasBonificadas: this.horasBonificadas,
        dataLevantamento: this.dataLevantamento,
        dataUsoOficial: this.dataUsoOficial,
        observacoes: this.observacoes,
        consultor: this.consultor,
        tecnicos: this.tecnicos,
        gerar,
        emailsResponsaveis: this.emailsResponsaveis,
      });
      this.resultado.set(r);
    } catch {
      this.erro.set('Não foi possível criar o fluxo.');
    } finally {
      this.enviando.set(false);
    }
  }

  async irParaFicha(): Promise<void> {
    const r = this.resultado();
    if (!r) return;
    await this.router.navigate(['/projetos', r.projetoId]);
  }
}
