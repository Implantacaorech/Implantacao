import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Ferramentas (Sistema): a antiga seção "Configurações e saúde" da Visão Geral, agora em
 * tela própria (decisão do usuário em 2026-07-28 — a Visão Geral ficou só com as
 * informações da carteira). É o hub das telas de integração/configuração; o item
 * "Ferramentas" do menu Sistema aponta para cá, no lugar da âncora /home#ferramentas.
 * Gate = menu `ferramentas` do painel de Permissões (fixo-ADM). */
@Component({
  selector: 'app-ferramentas',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './ferramentas.component.html',
  styleUrl: './ferramentas.component.css',
})
export class FerramentasComponent {}
