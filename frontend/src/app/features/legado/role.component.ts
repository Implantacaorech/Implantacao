import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AcaoLegado, RoleLegado, getRole } from '../../core/models/legado.model';

function rotaAcao(rid: string, acao: AcaoLegado): string[] {
  switch (acao.tipo) {
    case 'saude':
      return ['/legado', rid, 'saude'];
    case 'criar_templates':
      return ['/legado', rid, 'criar-templates'];
    case 'verbal':
      return ['/legado', rid, 'verbal'];
    case 'form_modulos':
      return ['/legado', rid, 'modulos', acao.id];
    case 'import':
      return ['/legado', rid, 'importar', acao.id];
    case 'gerar':
      return ['/legado', rid, 'gerar', acao.id];
  }
}

@Component({
  selector: 'app-legado-role',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './role.component.html',
  styleUrl: './role.component.css',
})
export class LegadoRoleComponent {
  private readonly route = inject(ActivatedRoute);

  readonly rid = this.route.snapshot.paramMap.get('rid') ?? '';
  readonly role: RoleLegado | undefined = getRole(this.rid);

  rota(acao: AcaoLegado): string[] {
    return rotaAcao(this.rid, acao);
  }
}
